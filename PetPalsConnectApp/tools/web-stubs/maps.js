/**
 * `react-native-maps` has no web build (its `react-native-web-maps` sibling is
 * unmaintained). MapScreen renders as an empty plane in the gallery; every
 * other screen is unaffected.
 */
import React from "react";
import { View } from "react-native";

const MapView = ({ children, style }) => <View style={style}>{children}</View>;
export const Marker = ({ children }) => <>{children}</>;
export const Callout = ({ children }) => <>{children}</>;
export const Circle = () => null;
export const Polyline = () => null;
export const PROVIDER_GOOGLE = "google";
export const PROVIDER_DEFAULT = undefined;
export default MapView;
