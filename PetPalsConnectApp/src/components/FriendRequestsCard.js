import React from "react";
import { View, Image } from "react-native";
import { useSelector } from "react-redux";

import { Button, Card, Text } from "./ui";
import { useTailwind } from "../styles/tailwind";
import { useTokens } from "../context/AppThemeContext";
import { radius } from "../styles/tokens";
import { broughtBy, petPhoto } from "../utils/petIdentity";
import { Ionicons } from "@expo/vector-icons";

/**
 * One pending request to be pals.
 *
 * Three things were wrong here, and they compounded.
 *
 * `isSender` compared `pet._id` against `friendRequest.sender._id` - a pet id
 * against a user id - so it was always false. Every request rendered as one
 * you had received, including the ones you sent, and the Accept and Decline
 * buttons appeared under your own outgoing requests.
 *
 * The pet's photo was rendered as `<Text>Pet Photo: {url}</Text>`, so the card
 * printed an https URL where the animal's face should be, and the string
 * "No photo available" when there was none.
 *
 * And the pet was picked as `sender.pets[0]` - an arbitrary animal from that
 * household. The request now records which pets it is actually between, so the
 * card names them.
 */
const FriendRequestsCard = ({ friendRequest, onAccept, onDecline }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const userId = useSelector((state) => state.user.userId);

  const senderId = String(friendRequest?.sender?._id ?? friendRequest?.sender ?? "");
  const isSender = Boolean(userId) && senderId === String(userId);

  // The pet at the other end, and the person bringing them.
  const theirPet = isSender
    ? friendRequest?.receiverPet ?? friendRequest?.receiver?.pets?.[0]
    : friendRequest?.senderPet ?? friendRequest?.sender?.pets?.[0];
  const them = isSender ? friendRequest?.receiver : friendRequest?.sender;

  const name = theirPet?.name ?? them?.username ?? "A pal";
  const photo = petPhoto(theirPet);
  const owner = broughtBy(them);

  const when = friendRequest?.createdDate
    ? new Date(friendRequest.createdDate).toLocaleDateString()
    : null;

  const pending = friendRequest?.status === "pending";

  return (
    <Card testID={`friend-request-${friendRequest?._id}`}>
      <View style={tailwind("flex-row items-center")}>
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
            <Ionicons name="paw" size={26} color={tokens.textFaint} />
          </View>
        )}

        <View style={tailwind("flex-1 ml-md")}>
          <Text variant="label">{name}</Text>
          {owner ? (
            <Text variant="caption" tone="muted">
              {owner}
            </Text>
          ) : null}
          <Text variant="caption" tone="faint">
            {isSender ? "You asked" : "Wants to be pals"}
            {when ? ` · ${when}` : ""}
          </Text>
        </View>
      </View>

      {!isSender && pending ? (
        <View style={tailwind("flex-row mt-md")}>
          <Button
            testID="accept-request"
            title="Become pals"
            onPress={() => onAccept(friendRequest)}
            style={tailwind("flex-1 mr-sm")}
          />
          <Button
            testID="decline-request"
            title="Not now"
            variant="soft"
            onPress={() => onDecline(friendRequest)}
            style={tailwind("flex-1")}
          />
        </View>
      ) : null}
    </Card>
  );
};

export default FriendRequestsCard;
