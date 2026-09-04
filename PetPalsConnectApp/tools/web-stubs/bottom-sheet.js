/** `@gorhom/bottom-sheet` needs a native gesture handler; MapScreen only. */
import React from "react";
import { View } from "react-native";

const BottomSheet = ({ children, style }) => <View style={style}>{children}</View>;
export const BottomSheetView = ({ children, style }) => <View style={style}>{children}</View>;
export const BottomSheetScrollView = ({ children, style }) => (
  <View style={style}>{children}</View>
);
export default BottomSheet;
