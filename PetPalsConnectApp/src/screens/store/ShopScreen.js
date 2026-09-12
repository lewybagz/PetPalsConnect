import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { Card, CardSkeleton, EmptyState, Screen, Text, useToast } from "../../components/ui";
import { fetchCatalogue, formatMinor, fromPrice } from "../../api/store";

/**
 * The shop.
 *
 * Ten to twenty things, grouped by what they are for, with the collar first
 * because it is the one product that does something in the app afterwards.
 * Buying happens on Stripe's page, not here - this screen and the one behind
 * it only decide what to put in the basket.
 *
 * Three states, told apart honestly: loading, "the shop isn't open yet" (the
 * server has no Stripe key - a deployment state, not a fault), and the
 * catalogue. A product with no price in Stripe still lists, marked as coming
 * soon, rather than vanishing: a gap in a shelf reads as a bug.
 */

/** A stand-in for a product with no photo yet, by what kind of thing it is. */
const CATEGORY_ICONS = {
  tracking: "radio-outline",
  pets: "paw-outline",
  people: "shirt-outline",
};

const ProductCard = ({ product, onPress }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const price = fromPrice(product);
  const photo = product.photos?.[0];

  return (
    <Card
      testID={`product-${product.id}`}
      padded={false}
      style={tailwind("mb-md overflow-hidden")}
      onPress={onPress}
      accessibilityLabel={`${product.name}. ${
        price ? `From ${formatMinor(price.amount, price.currency)}` : "Coming soon"
      }`}
    >
      <View style={[tailwind("bg-surfaceAlt items-center justify-center"), { height: 160 }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={tailwind("w-full h-full")} resizeMode="cover" />
        ) : (
          <Ionicons
            name={CATEGORY_ICONS[product.category] ?? "pricetag-outline"}
            size={48}
            color={tokens.textFaint}
          />
        )}
      </View>
      <View style={tailwind("p-lg")}>
        <View style={tailwind("flex-row items-start justify-between")}>
          <Text variant="title" style={tailwind("flex-1 mr-md")}>
            {product.name}
          </Text>
          {price ? (
            <Text variant="title" tone="primary">
              {product.variants.length > 1 ? "From " : ""}
              {formatMinor(price.amount, price.currency)}
            </Text>
          ) : (
            <Text variant="label" tone="faint">
              Coming soon
            </Text>
          )}
        </View>
        <Text tone="muted" numberOfLines={2} style={tailwind("mt-xs")}>
          {product.description}
        </Text>
      </View>
    </Card>
  );
};

const ShopScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const [catalogue, setCatalogue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setCatalogue(await fetchCatalogue());
    } catch (error) {
      console.warn("[store]", error.message);
      toast.error("Could not load the shop.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    if (!catalogue) return [];
    return catalogue.categories
      .map((category) => ({
        ...category,
        products: catalogue.products.filter((product) => product.category === category.key),
      }))
      .filter((section) => section.products.length > 0);
  }, [catalogue]);

  return (
    <Screen
      testID="shop"
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
      <View style={tailwind("flex-row items-start justify-between mb-xs")}>
        <Text variant="display">Shop</Text>
        <Pressable
          testID="shop-orders"
          accessibilityRole="button"
          accessibilityLabel="Your orders"
          onPress={() => navigation.navigate("Orders")}
          style={tailwind("flex-row items-center py-sm")}
        >
          <Ionicons name="cube-outline" size={18} color={tokens.primary} />
          <Text tone="primary" weight="600" style={tailwind("ml-xs")}>
            Orders
          </Text>
        </Pressable>
      </View>
      <Text tone="muted" style={tailwind("mb-lg")}>
        Things for the walk, and the collar that shows up on the map.
      </Text>

      {loading ? (
        <View testID="shop-loading">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : !catalogue ? (
        <EmptyState
          testID="shop-error"
          icon="cloud-offline-outline"
          title="Could not load the shop"
          message="Pull down to try again."
        />
      ) : !catalogue.configured ? (
        <EmptyState
          testID="shop-closed"
          icon="storefront-outline"
          title="The shop isn't open yet"
          message="We're getting the shelves ready. Check back soon."
        />
      ) : (
        sections.map((section) => (
          <View key={section.key} testID={`shop-section-${section.key}`} style={tailwind("mb-lg")}>
            <Text variant="label" tone="muted" style={tailwind("mb-sm uppercase")}>
              {section.label}
            </Text>
            {section.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={() => navigation.navigate("ProductDetail", { productId: product.id })}
              />
            ))}
          </View>
        ))
      )}

      {catalogue?.configured ? (
        <Text variant="caption" tone="faint" style={tailwind("mt-sm mb-xl")}>
          Paid through Stripe&apos;s secure checkout. Ships within the US.
        </Text>
      ) : null}
    </Screen>
  );
};

export default ShopScreen;
