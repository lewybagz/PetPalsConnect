import React from "react";
import { Image, ScrollView, View } from "react-native";

import { EmptyState, Screen, Text } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { radius } from "../../styles/tokens";

/**
 * Everything shared in a conversation.
 *
 * It received a list of media *ids* and fetched each one individually - N
 * requests to open a gallery - with a token attached by hand that the shared
 * client already sets. The chat endpoints populate the media now, so the two
 * option sheets hand this the documents themselves and there is nothing left
 * to fetch.
 *
 * Accepts either shape: a stored URL string, or a Media document.
 */
const urlOf = (item) => (typeof item === "string" ? item : item?.url ?? null);

const MediaViewScreen = ({ route }) => {
  const tailwind = useTailwind();
  const media = route?.params?.media ?? [];
  const items = media.map(urlOf).filter(Boolean);

  if (items.length === 0) {
    return (
      <Screen testID="media-view">
        <EmptyState
          icon="images-outline"
          title="Nothing shared yet"
          message="Photos sent in this conversation turn up here."
        />
      </Screen>
    );
  }

  return (
    <Screen testID="media-view" padded={false}>
      <ScrollView contentContainerStyle={tailwind("p-lg")}>
        {items.map((url, index) => (
          <View key={`${url}-${index}`} style={tailwind("mb-md")}>
            <Image
              source={{ uri: url }}
              style={{ width: "100%", height: 240, borderRadius: radius.card }}
              resizeMode="cover"
            />
          </View>
        ))}
        <Text variant="caption" tone="muted" align="center">
          {items.length === 1 ? "1 item" : `${items.length} items`}
        </Text>
      </ScrollView>
    </Screen>
  );
};

export default MediaViewScreen;
