import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { hit } from "../../styles/tokens";
import { Button, Card, CardSkeleton, EmptyState, Screen, Text, useToast } from "../../components/ui";
import { fetchCatalogue, formatMinor, startCheckout } from "../../api/store";

/**
 * One product: pick a variant, pick a quantity, go to Checkout.
 *
 * There is no cart. Checkout takes several lines at once and nobody has yet
 * bought three things in one go from a shop with twenty; a cart is a persisted
 * selection with merge rules and abandonment, and it earns its place the day
 * somebody needs it. Until then one product at a time is the honest shape.
 *
 * "Buy" opens Stripe's hosted page in the browser. That is the sanctioned
 * route for physical goods on both stores, and it keeps the card, the
 * address form and the tax calculation off this screen entirely.
 */

/** Merch, not wholesale. Mirrors `MAX_QUANTITY` on the server. */
const MAX_QUANTITY = 10;

const CATEGORY_ICONS = {
  tracking: "radio-outline",
  pets: "paw-outline",
  people: "shirt-outline",
};

const ProductDetailScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { productId } = route?.params ?? {};

  const [catalogue, setCatalogue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sku, setSku] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);

  const load = useCallback(async () => {
    try {
      setCatalogue(await fetchCatalogue());
    } catch (error) {
      console.warn("[store]", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const product = useMemo(
    () => catalogue?.products.find((entry) => entry.id === productId) ?? null,
    [catalogue, productId]
  );

  // Defaults to the first variant that can actually be bought, and only once
  // the product is known - a stale sku from a previous product would buy the
  // wrong thing.
  const selected = useMemo(() => {
    if (!product) return null;
    return (
      product.variants.find((variant) => variant.sku === sku) ??
      product.variants.find((variant) => variant.price) ??
      product.variants[0] ??
      null
    );
  }, [product, sku]);

  const purchasable = Boolean(catalogue?.configured && selected?.price);
  const total = selected?.price ? selected.price.amount * quantity : null;

  const buy = async () => {
    if (!selected?.price || buying) return;
    setBuying(true);
    try {
      await startCheckout([{ sku: selected.sku, quantity }]);
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Could not start checkout.");
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <Screen testID="product-loading" scroll>
        <CardSkeleton />
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen testID="product-missing">
        <EmptyState
          icon="pricetag-outline"
          title="That item isn't in the shop"
          message="It may have been removed. Everything else is still there."
          actionLabel="Back to the shop"
          onAction={() => navigation.navigate("Shop")}
        />
      </Screen>
    );
  }

  const photo = product.photos?.[0];

  return (
    <Screen testID="product-detail" scroll>
      <View
        style={[
          tailwind("bg-surfaceAlt rounded-card items-center justify-center mb-lg overflow-hidden"),
          { height: 220 },
        ]}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={tailwind("w-full h-full")} resizeMode="cover" />
        ) : (
          <Ionicons
            name={CATEGORY_ICONS[product.category] ?? "pricetag-outline"}
            size={64}
            color={tokens.textFaint}
          />
        )}
      </View>

      <Text variant="display">{product.name}</Text>
      <Text tone="muted" style={tailwind("mt-sm mb-lg")}>
        {product.description}
      </Text>

      {product.requiresDeviceSetup ? (
        <Card testID="product-tracking-note" style={tailwind("mb-lg")}>
          <Text weight="600" style={tailwind("mb-xs")}>
            What it does in the app
          </Text>
          <Text tone="muted">
            Once it arrives, set it up under your pet&apos;s tracking screen. The map
            then shows where the collar last reported, and you choose which friends
            can see that and for how long.
          </Text>
          <Text variant="caption" tone="faint" style={tailwind("mt-sm")}>
            It shows where a device last reported. It is not a safety device and
            cannot replace a tag, a chip or a leash.
          </Text>
        </Card>
      ) : null}

      {product.variants.length > 1 ? (
        <View style={tailwind("mb-lg")}>
          <Text variant="label" tone="muted" style={tailwind("mb-sm uppercase")}>
            {product.category === "people" ? "Size" : "Option"}
          </Text>
          <View style={tailwind("flex-row flex-wrap")} accessibilityRole="radiogroup">
            {product.variants.map((variant) => {
              const active = variant.sku === selected?.sku;
              const available = Boolean(variant.price);
              return (
                <Pressable
                  key={variant.sku}
                  testID={`variant-${variant.sku}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active, disabled: !available }}
                  accessibilityLabel={`${variant.label}${available ? "" : ", coming soon"}`}
                  disabled={!available}
                  onPress={() => setSku(variant.sku)}
                  style={[
                    tailwind(
                      `border rounded-lg px-md py-sm mr-sm mb-sm ${
                        active ? "bg-primary border-primary" : "bg-surface border-border"
                      }`
                    ),
                    { minHeight: hit.min, justifyContent: "center", opacity: available ? 1 : 0.5 },
                  ]}
                >
                  <Text variant="caption" weight="600" tone={active ? "onPrimary" : "muted"}>
                    {variant.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={tailwind("flex-row items-center justify-between mb-lg")}>
        <Text variant="label" tone="muted" style={tailwind("uppercase")}>
          Quantity
        </Text>
        <View style={tailwind("flex-row items-center")}>
          <Pressable
            testID="quantity-less"
            accessibilityRole="button"
            accessibilityLabel="Fewer"
            disabled={quantity <= 1}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={[
              tailwind("border border-border rounded-pill items-center justify-center bg-surface"),
              { width: hit.min, height: hit.min, opacity: quantity <= 1 ? 0.4 : 1 },
            ]}
          >
            <Ionicons name="remove" size={20} color={tokens.text} />
          </Pressable>
          <Text
            testID="quantity"
            variant="title"
            style={[tailwind("text-center"), { minWidth: 40 }]}
            accessibilityLiveRegion="polite"
          >
            {quantity}
          </Text>
          <Pressable
            testID="quantity-more"
            accessibilityRole="button"
            accessibilityLabel="More"
            disabled={quantity >= MAX_QUANTITY}
            onPress={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
            style={[
              tailwind("border border-border rounded-pill items-center justify-center bg-surface"),
              { width: hit.min, height: hit.min, opacity: quantity >= MAX_QUANTITY ? 0.4 : 1 },
            ]}
          >
            <Ionicons name="add" size={20} color={tokens.text} />
          </Pressable>
        </View>
      </View>

      <View style={tailwind("flex-row items-baseline justify-between mb-md")}>
        <Text tone="muted">Total before tax and shipping</Text>
        <Text testID="product-total" variant="display" tone="primary">
          {total != null ? formatMinor(total, selected.price.currency) : "—"}
        </Text>
      </View>

      <Button
        testID="product-buy"
        title={purchasable ? "Buy on Stripe" : "Coming soon"}
        onPress={buy}
        loading={buying}
        disabled={!purchasable}
      />
      <Text variant="caption" tone="faint" align="center" style={tailwind("mt-md mb-xl")}>
        {catalogue?.configured
          ? "Opens Stripe's secure checkout in your browser for the card, the address and the tax. Ships within the US."
          : "The shop isn't open yet."}
      </Text>
    </Screen>
  );
};

export default ProductDetailScreen;
