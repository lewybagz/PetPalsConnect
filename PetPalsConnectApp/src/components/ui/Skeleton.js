import React, { useEffect, useMemo } from "react";
import { Animated, Easing, View } from "react-native";

import { useTailwind } from "../../styles/tailwind";
import { radius, space } from "../../styles/tokens";

/**
 * A placeholder shaped like the thing that is coming.
 *
 * Every wait in the app was an `ActivityIndicator`, including on Discover, Home
 * and the chat list - three screens whose structure is completely predictable
 * before the data arrives, and the three with the most first-session traffic.
 * A skeleton lets somebody start building a mental model of the screen while
 * they wait; a spinner tells them only that something is happening.
 *
 * Spinners stay where they belong: short, unpredictable operations, and a
 * button's own busy state.
 */

const Skeleton = ({ width = "100%", height = 16, rounded = "control", style }) => {
  const tailwind = useTailwind();
  const pulse = useMemo(() => new Animated.Value(0.5), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        tailwind("bg-skeleton"),
        {
          width,
          height,
          borderRadius: radius[rounded] ?? radius.control,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
};

/** The shape of one pet card in the deck. */
export const CardSkeleton = () => {
  const tailwind = useTailwind();

  return (
    <View
      testID="skeleton-card"
      accessibilityLabel="Loading"
      style={tailwind("bg-surface rounded-card border border-border overflow-hidden")}
    >
      <Skeleton width="100%" height={256} rounded="card" />
      <View style={tailwind("p-lg")}>
        <Skeleton width="55%" height={24} />
        <View style={{ height: space.sm }} />
        <Skeleton width="35%" height={14} />
        <View style={{ height: space.lg }} />
        <Skeleton width="80%" height={14} />
        <View style={{ height: space.sm }} />
        <Skeleton width="70%" height={14} />
      </View>
    </View>
  );
};

/** The shape of one row in a list: avatar, title, subtitle. */
export const RowSkeleton = () => {
  const tailwind = useTailwind();

  return (
    <View
      testID="skeleton-row"
      style={tailwind("flex-row items-center p-md")}
    >
      <Skeleton width={48} height={48} rounded="pill" />
      <View style={tailwind("flex-1 ml-md")}>
        <Skeleton width="45%" height={16} />
        <View style={{ height: space.sm }} />
        <Skeleton width="70%" height={13} />
      </View>
    </View>
  );
};

/** `count` rows, for a list that has not arrived. */
export const ListSkeleton = ({ count = 6 }) => (
  <View testID="skeleton-list">
    {Array.from({ length: count }, (_, index) => (
      <RowSkeleton key={index} />
    ))}
  </View>
);

export default Skeleton;
