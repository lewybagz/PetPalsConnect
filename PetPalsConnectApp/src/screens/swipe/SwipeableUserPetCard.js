import React, { useState } from "react";
import { Alert, Animated, Image, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

import { ActionSheet, Card, Text, useToast } from "../../components/ui";
import { blockUser } from "../../api/safety";
import { removeFriend, sendFriendRequest } from "../../api/friends";
import { addFavorite } from "../../api/favorites";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { radius } from "../../styles/tokens";

/**
 * One person in the friends list, with a swipe to unfriend.
 *
 * Almost nothing in this rendered. Its only caller passes a *Friend* row -
 * `{ user1, user2, status }` - and this read `data.user._id`, `data.pet._id`,
 * `userData.profileImage`, `userData.location` and `petData.ownerId`, none of
 * which exist on either side of that. It also switched on a `type` prop the
 * caller never passed, so `renderContent` fell through to `<Text>No data</Text>`;
 * mapped an unguarded `reviews.map` over a prop that arrives undefined, which
 * throws; and rendered the kebab menu twice - once nested inside the pet card
 * and once beside it - so two Modals fought over the same `modalVisible`.
 *
 * It takes a `user` now, because that is what a friends list is made of, and
 * the screen resolves which side of the friendship that is.
 */
const SwipeableUserPetCard = ({
  user,
  pet,
  isFriend = true,
  onPress,
  onRemoved,
  navigation,
}) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const userId = user?._id ? String(user._id) : null;
  const petId = pet?._id ? String(pet._id) : null;
  const photo = user?.userPhoto ?? pet?.photos?.[0] ?? null;

  const handleBlock = async () => {
    if (!userId) return;
    try {
      await blockUser(userId);
      toast.success("Blocked");
      onRemoved?.(userId);
    } catch (error) {
      console.warn("[safety] Could not block:", error.message);
      toast.error("Couldn't block that account.");
    }
  };

  const handleFavourite = async () => {
    if (!petId) {
      toast.show("There's no pet on this card to favourite.");
      return;
    }
    try {
      // Sent `user` and `creator` from the client, which the server takes from
      // the token and ignores.
      await addFavorite(petId);
      toast.success("Added to favourites");
    } catch (error) {
      console.warn("[favorites] Could not add:", error.message);
      toast.error("Couldn't add that to favourites.");
    }
  };

  const handleAddFriend = async () => {
    if (!userId) return;
    try {
      await sendFriendRequest(userId);
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

  /**
   * Unfriends the person this card is about.
   *
   * The swipe revealed a red panel with an icon and
   * `console.log("Remove friend action")` behind it, and there was no endpoint
   * to call either, so the gesture looked like it worked and never did
   * anything. It cannot be undone from here, so it asks first - which is what
   * `Alert` is for.
   */
  const handleRemoveFriend = () => {
    if (!userId) return;

    Alert.alert(
      "Remove friend?",
      "You can send them a friend request again later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFriend(userId);
              toast.success("Removed");
              onRemoved?.(userId);
            } catch (error) {
              console.warn("[friends] Could not remove:", error.message);
              toast.error("Couldn't remove that friend.");
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        testID={`remove-friend-${userId}`}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${user?.username ?? "friend"}`}
        style={[
          tailwind("bg-danger items-center justify-center"),
          { width: 100, borderRadius: radius.card },
        ]}
        onPress={handleRemoveFriend}
      >
        <Animated.View style={{ transform: [{ translateX: trans }] }}>
          <Icon name="account-minus" size={28} color={tokens.onPrimary} />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable renderRightActions={isFriend ? renderRightActions : undefined}>
      <Card
        testID={`friend-${userId}`}
        onPress={onPress}
        style={tailwind("mb-sm flex-row items-center")}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: 48, height: 48, borderRadius: radius.pill }}
          />
        ) : (
          <View
            style={[
              tailwind("bg-surfaceAlt items-center justify-center"),
              { width: 48, height: 48, borderRadius: radius.pill },
            ]}
          >
            <Icon name="account" size={26} color={tokens.textFaint} />
          </View>
        )}

        <View style={tailwind("flex-1 ml-md")}>
          <Text variant="label">{user?.username ?? "Someone"}</Text>
          {pet?.name ? (
            <Text variant="caption" tone="muted">
              {pet.breed ? `${pet.name} · ${pet.breed}` : pet.name}
            </Text>
          ) : null}
        </View>

        {!isFriend ? (
          <TouchableOpacity
            testID={`add-friend-${userId}`}
            accessibilityRole="button"
            accessibilityLabel="Add friend"
            onPress={handleAddFriend}
            style={tailwind("p-sm")}
          >
            <Icon name="account-plus" size={22} color={tokens.success} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          testID={`friend-menu-${userId}`}
          accessibilityRole="button"
          accessibilityLabel="More options"
          onPress={() => setMenuOpen(true)}
          style={tailwind("p-sm")}
        >
          <Icon name="dots-vertical" size={20} color={tokens.textMuted} />
        </TouchableOpacity>
      </Card>

      <ActionSheet
        testID="friend-options-sheet"
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={user?.username}
        items={[
          {
            label: "Add pet to favourites",
            icon: "star-outline",
            testID: "friend-option-favourite",
            onPress: handleFavourite,
            disabled: !petId,
          },
          {
            label: "Report",
            icon: "flag-outline",
            testID: "friend-option-report",
            onPress: () => navigation?.navigate("ReportUser", { userId }),
            disabled: !userId,
          },
          {
            label: "Block",
            icon: "ban-outline",
            tone: "danger",
            testID: "friend-option-block",
            onPress: handleBlock,
            disabled: !userId,
          },
        ]}
      />
    </Swipeable>
  );
};

export default SwipeableUserPetCard;
