import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { Button, Card, CardSkeleton, EmptyState, Screen, Text, useToast } from "../../components/ui";
import {
  ORDER_STATUS_LABELS,
  fetchOrder,
  fetchOrderBySession,
  formatMinor,
} from "../../api/store";

/**
 * One order, reached two ways.
 *
 * From the list or a "shipped" push it carries `orderId` and simply loads.
 * From Stripe's redirect it carries `sessionId` and the order may not exist
 * yet: the webhook lands a moment after the browser hands back, and until it
 * does the honest screen is "confirming your order", not "paid" and not an
 * error. So this polls the session for a while and then stops - a redirect is
 * not proof of payment, and a screen that claimed otherwise would ship goods
 * for sessions that never settled.
 */

/** How often and how long to ask whether the webhook has landed. */
const POLL_MS = 3000;
const POLL_FOR_MS = 90 * 1000;

const STATUS_ICONS = {
  pending: "time-outline",
  paid: "checkmark-circle-outline",
  fulfilled: "airplane-outline",
  refunded: "return-down-back-outline",
  disputed: "alert-circle-outline",
  failed: "close-circle-outline",
};

const STATUS_DETAIL = {
  pending: "Stripe is still confirming the payment. This usually takes a moment.",
  paid: "We have it. You'll get a notification when it ships.",
  fulfilled: "It's on its way.",
  refunded: "The refund is on its way back to the card you paid with.",
  disputed: "Your card issuer has opened a dispute on this payment. We'll be in touch through support.",
  failed: "The payment didn't go through, so nothing was charged and nothing will ship.",
};

const Line = ({ label, value, strong }) => {
  const tailwind = useTailwind();
  if (value == null || value === "") return null;
  return (
    <View style={tailwind("flex-row justify-between py-xs")}>
      <Text tone={strong ? "default" : "muted"} weight={strong ? "600" : undefined}>
        {label}
      </Text>
      <Text weight={strong ? "600" : undefined}>{value}</Text>
    </View>
  );
};

const OrderDetailScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { orderId, sessionId } = route?.params ?? {};

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  // Only meaningful on the session path: true once we have given up waiting.
  const [timedOut, setTimedOut] = useState(false);
  // Set on the first tick rather than during render, which must stay pure.
  const startedAt = useRef(null);

  const load = useCallback(async () => {
    try {
      if (orderId) {
        setOrder(await fetchOrder(orderId));
        return true;
      }
      if (sessionId) {
        const found = await fetchOrderBySession(sessionId);
        if (found) setOrder(found);
        return Boolean(found);
      }
      return true;
    } catch (error) {
      console.warn("[store]", error.message);
      toast.error("Could not load that order.");
      return true;
    } finally {
      setLoading(false);
    }
  }, [orderId, sessionId, toast]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      startedAt.current ??= Date.now();
      const done = await load();
      if (cancelled || done) return;
      if (Date.now() - startedAt.current > POLL_FOR_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  if (loading) {
    return (
      <Screen testID="order-loading" scroll>
        <CardSkeleton />
      </Screen>
    );
  }

  if (!order && sessionId) {
    return (
      <Screen testID="order-confirming">
        {timedOut ? (
          <EmptyState
            testID="order-confirming-slow"
            icon="time-outline"
            title="Still confirming"
            message="Stripe hasn't told us about this payment yet. If your card was charged, the order will appear under Orders shortly - you don't need to buy again."
            actionLabel="See my orders"
            onAction={() => navigation.navigate("Orders")}
          />
        ) : (
          <View style={tailwind("flex-1 items-center justify-center px-xl")}>
            <ActivityIndicator size="large" color={tokens.primary} />
            <Text variant="title" align="center" style={tailwind("mt-lg")}>
              Confirming your order
            </Text>
            <Text tone="muted" align="center" style={tailwind("mt-sm")}>
              Thanks. Stripe is confirming the payment - this usually takes a few seconds.
            </Text>
          </View>
        )}
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen testID="order-missing">
        <EmptyState
          icon="cube-outline"
          title="Order not found"
          message="It may belong to a different account."
          actionLabel="See my orders"
          onAction={() => navigation.navigate("Orders")}
        />
      </Screen>
    );
  }

  const currency = order.currency ?? "usd";
  const shipping = order.shipping;

  return (
    <Screen testID="order-detail" scroll>
      <Card testID="order-status" style={tailwind("mb-lg")}>
        <View style={tailwind("flex-row items-center")}>
          <Ionicons
            name={STATUS_ICONS[order.status] ?? "cube-outline"}
            size={28}
            color={["refunded", "disputed", "failed"].includes(order.status) ? tokens.danger : tokens.primary}
          />
          <View style={tailwind("ml-md flex-1")}>
            <Text variant="title">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Text>
            <Text tone="muted" style={tailwind("mt-xs")}>
              {STATUS_DETAIL[order.status] ?? ""}
            </Text>
          </View>
        </View>
        {order.trackingNumber ? (
          <View style={tailwind("mt-md pt-md border-t border-border")}>
            <Text variant="caption" tone="faint">
              {order.carrier ? `${order.carrier} tracking` : "Tracking"}
            </Text>
            <Text selectable weight="600">
              {order.trackingNumber}
            </Text>
          </View>
        ) : null}
      </Card>

      <Text variant="label" tone="muted" style={tailwind("mb-sm uppercase")}>
        Items
      </Text>
      <Card style={tailwind("mb-lg")}>
        {order.items.map((item, index) => (
          <View
            key={`${item.sku ?? item.name}-${index}`}
            testID={`order-item-${index}`}
            style={tailwind(
              `flex-row justify-between py-sm ${index > 0 ? "border-t border-border" : ""}`
            )}
          >
            <View style={tailwind("flex-1 mr-md")}>
              <Text weight="600">{item.name}</Text>
              <Text variant="caption" tone="muted">
                {[item.variantLabel, `× ${item.quantity}`].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Text>
              {item.unitAmount != null
                ? formatMinor(item.unitAmount * item.quantity, item.currency ?? currency)
                : ""}
            </Text>
          </View>
        ))}
        <View style={tailwind("mt-sm pt-sm border-t border-border")}>
          <Line label="Subtotal" value={formatMinor(order.amountSubtotal, currency)} />
          <Line label="Shipping" value={formatMinor(order.amountShipping, currency)} />
          <Line label="Tax" value={formatMinor(order.amountTax, currency)} />
          <Line label="Total" value={formatMinor(order.amountTotal, currency)} strong />
          {order.amountRefunded > 0 ? (
            <Line label="Refunded" value={formatMinor(order.amountRefunded, currency)} />
          ) : null}
        </View>
      </Card>

      {shipping?.line1 ? (
        <>
          <Text variant="label" tone="muted" style={tailwind("mb-sm uppercase")}>
            Shipping to
          </Text>
          <Card testID="order-shipping" style={tailwind("mb-lg")}>
            {shipping.name ? <Text weight="600">{shipping.name}</Text> : null}
            <Text tone="muted">{shipping.line1}</Text>
            {shipping.line2 ? <Text tone="muted">{shipping.line2}</Text> : null}
            <Text tone="muted">
              {[shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(", ")}
            </Text>
          </Card>
        </>
      ) : null}

      <Text variant="caption" tone="faint" style={tailwind("mb-md")}>
        Order {String(order._id).slice(-8).toUpperCase()}
        {order.email ? ` · receipt sent to ${order.email}` : ""}
      </Text>

      <Button
        testID="order-help"
        title="Need help with this order?"
        variant="ghost"
        onPress={() => navigation.navigate("HelpSupport")}
      />
    </Screen>
  );
};

export default OrderDetailScreen;
