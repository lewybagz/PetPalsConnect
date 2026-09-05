import React, { Children } from "react";
import { View } from "react-native";

import { useTailwind } from "../../styles/tailwind";
import Text from "./Text";

/**
 * A titled group of settings rows.
 *
 * The Settings screen was twenty-one bordered boxes in one flat column -
 * subscription next to dark mode next to sign out - which is a list, not a
 * screen. Grouping is the only thing that makes a long settings screen
 * findable, and a group needs a heading and a shared card so the boundary is
 * visible rather than implied by a gap.
 *
 * The divider is drawn between children here rather than by each row, because
 * a row does not know whether it is last, and a hairline under the final row of
 * a card is the small wrong thing every hand-rolled settings list has.
 */
const SettingsSection = ({ title, footer, children, testID }) => {
  const tailwind = useTailwind();
  const rows = Children.toArray(children).filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <View testID={testID} style={tailwind("mb-xl")}>
      {title ? (
        <Text
          variant="label"
          tone="muted"
          style={tailwind("mb-sm ml-xs uppercase")}
        >
          {title}
        </Text>
      ) : null}

      <View
        style={tailwind("bg-surface rounded-card border border-border overflow-hidden")}
      >
        {rows.map((row, index) => (
          <View key={row.key ?? index}>
            {index > 0 ? (
              // Inset from the left so the divider reads as separating rows
              // inside one card rather than as the edge of a new one.
              <View style={tailwind("h-px bg-border ml-lg")} />
            ) : null}
            {row}
          </View>
        ))}
      </View>

      {footer ? (
        <Text variant="caption" tone="muted" style={tailwind("mt-sm mx-xs")}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
};

export default SettingsSection;
