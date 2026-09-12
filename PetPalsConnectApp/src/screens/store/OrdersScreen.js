import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { Card, EmptyState, ListSkeleton, Screen, Text, useToast } from "../../components/ui";
import { ORDER_STATUS_LABELS, describeItems, fetchOrders, formatMinor } from "../../api/store";

/** The tone a status reads in. Nothing here is red except money coming back or failing. */
const STATUS_TONES = {
  pending: "muted",
  paid: "primary",
  fulfilled: "primary",
  refunded: "danger",
  disputed: "danger",
  failed: "danger",
};

const formatDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/**
 * What you have bought. Each row is what it was, when, what it cost and where
 * it is now; the detail screen has the rest.
 */
const OrdersScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await fetchOrders());
    } catch (error) {
      console.warn("[store]", error.message);
      toast.error("Could not load your orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen
      testID="orders"
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={tokens.textMuted}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Text variant="display" style={tailwind("mb-lg")}>
        Orders
      </Text>

      {loading ? (
        <ListSkeleton count={3} />
      ) : !orders || orders.length === 0 ? (
        <EmptyState
          testID="orders-empty"
          icon="cube-outline"
          title="No orders yet"
          message="Anything you buy in the shop shows up here, with where it is."
          actionLabel="Go to the shop"
          onAction={() => navigation.navigate("Shop")}
        />
      ) : (
        orders.map((order) => (
          <Card
            key={order._id}
            testID={`order-${order._id}`}
            style={tailwind("mb-md")}
            onPress={() => navigation.navigate("OrderDetail", { orderId: order._id })}
            accessibilityLabel={`${describeItems(order)}, ${ORDER_STATUS_LABELS[order.status] ?? order.status}`}
          >
            <View style={tailwind("flex-row items-start justify-between")}>
              <Text variant="title" style={tailwind("flex-1 mr-md")} numberOfLines={2}>
                {describeItems(order)}
              </Text>
              <Text weight="600">{formatMinor(order.amountTotal, order.currency)}</Text>
            </View>
            <View style={tailwind("flex-row items-center justify-between mt-xs")}>
              <Text variant="caption" tone="faint">
                {formatDate(order.createdDate)}
              </Text>
              <Text variant="caption" weight="600" tone={STATUS_TONES[order.status] ?? "muted"}>
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </Text>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
};

export default OrdersScreen;
