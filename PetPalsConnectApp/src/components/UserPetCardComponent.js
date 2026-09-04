import React, { useState } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

import { ActionSheet, Card, Text, useToast } from "./ui";
import { blockUser } from "../api/safety";
import { sendFriendRequest } from "../api/friends";
import { addFavorite } from "../api/favorites";
import { useTailwind } from "../styles/tailwind";
import { useTokens } from "../context/AppThemeContext";
import { radius } from "../styles/tokens";

/**
 * A pet or a person, on a card.
 *
 * Nine screens render this and they disagree about how: seven pass
 * `data`+`type`, `UsersPetsScreen` passes `data` with no `type` at all - which
 * fell through the switch to a literal `<Text>No data</Text>` - and
 * `PlaydateCardComponent` passes `petData`, a prop this never read, so it
 * rendered an empty card. The pet branch also read `petData.photo` (the field
 * is `photos`, an array) and `petData.ownerId` (it is `owner`), and mapped
 * `reviews.map` over a prop no caller passes, which throws.
 *
 * The kebab menu read `data.user._id` and `data.pet._id` on documents that are
 * a pet or a user, never a wrapper around both, so its three actions all ran
 * against `undefined` - and "Add to Favorites" sent `user` and `creator` from
 * the client, which the server takes from the token.
 *
 * It works out what it was handed now, rather than being told, and accepts
 * either prop name.
 */
const UserPetCard = ({ data, petData, type, onPress, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const item = data ?? petData ?? null;

  // A pet has a breed; a user has a username. Either beats a `type` prop two
  // of the nine callers forget to pass.
  const isPet =
    type === "pet" || (type !== "user" && Boolean(item?.breed || item?.weight));

  const pet = isPet ? item : null;
  const owner = isPet ? item?.owner : item;
  const ownerId = owner?._id ? String(owner._id) : owner ? String(owner) : null;

  const photo = isPet ? item?.photos?.[0] : item?.userPhoto;
  const title = isPet ? item?.name : item?.username;
  const subtitle = isPet ? item?.breed : item?.location;

  if (!item) return null;

  const handleBlock = async () => {
    if (!ownerId) return;
    try {
      await blockUser(ownerId);
      toast.success("Blocked");
    } catch (error) {
      console.warn("[safety] Could not block:", error.message);
      toast.error("Couldn't block that account.");
    }
  };

  const handleFavourite = async () => {
    if (!pet?._id) return;
    try {
      await addFavorite(String(pet._id));
      toast.success("Added to favourites");
    } catch (error) {
      console.warn("[favorites] Could not add:", error.message);
      toast.error("Couldn't add that to favourites.");
    }
  };

  const handleAddFriend = async () => {
    if (!ownerId) {
      toast.error("This pet has no owner to add.");
      return;
    }
    try {
      await sendFriendRequest(ownerId);
      toast.success("Friend request sent");
    } catch (error) {
      console.warn("[friends] Could not send request:", error.message);
      toast.error(
        error.response?.status === 400
          ? "You've already asked, or you can't add this account."
          : "Couldn't send that friend request."
      );
    }
  };

  return (
    <>
      <Card
        testID={`card-${item._id}`}
        onPress={onPress}
        style={tailwind("mb-sm flex-row items-center")}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: 56, height: 56, borderRadius: radius.pill }}
          />
        ) : (
          <View
            style={[
              tailwind("bg-surfaceAlt items-center justify-center"),
              { width: 56, height: 56, borderRadius: radius.pill },
            ]}
          >
            <Icon
              name={isPet ? "paw" : "account"}
              size={28}
              color={tokens.textFaint}
            />
          </View>
        )}

        <View style={tailwind("flex-1 ml-md")}>
          <Text variant="label">{title ?? (isPet ? "A pet" : "Someone")}</Text>
          {subtitle ? (
            <Text variant="caption" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          testID={`card-menu-${item._id}`}
          accessibilityRole="button"
          accessibilityLabel="More options"
          onPress={() => setMenuOpen(true)}
          style={tailwind("p-sm")}
        >
          <Icon name="dots-vertical" size={20} color={tokens.textMuted} />
        </TouchableOpacity>
      </Card>

      <ActionSheet
        testID="card-options-sheet"
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={title}
        items={[
          {
            label: "Add to favourites",
            icon: "star-outline",
            testID: "card-option-favourite",
            onPress: handleFavourite,
            disabled: !pet?._id,
          },
          {
            label: "Add friend",
            icon: "person-add-outline",
            testID: "card-option-friend",
            onPress: handleAddFriend,
            disabled: !ownerId,
          },
          {
            label: "Report",
            icon: "flag-outline",
            testID: "card-option-report",
            onPress: () => navigation?.navigate("ReportUser", { userId: ownerId }),
            disabled: !ownerId || !navigation,
          },
          {
            label: "Block",
            icon: "ban-outline",
            tone: "danger",
            testID: "card-option-block",
            onPress: handleBlock,
            disabled: !ownerId,
          },
        ]}
      />
    </>
  );
};

export default UserPetCard;
