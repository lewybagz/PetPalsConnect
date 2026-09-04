import React, { useState, useMemo } from "react";
import { Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import moment from "moment";
import { FontAwesome as Icon } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import CustomActionSheet from "./CustomActionSheet";
import ReactionSelectorComponent from "./ReactionSelectorComponent";
import { useTokens } from "../context/AppThemeContext";

const MessageItemComponent = ({
  message,
  isSender,
  onReply,
  onDelete,
  onReact,
  onCopy,
}) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const isMediaMessage = message.mediaUrl && message.mediaType;
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [showReactionsSelector, setShowReactionsSelector] = useState(false);

  const handleLongPress = () => {
    setActionSheetVisible(true);
  };

  const handleReaction = (reaction) => {
    onReact(message, reaction); // Pass the reaction to the parent component
    setShowReactionsSelector(false); // Hide the selector after reacting
  };
  const formatDate = (timestamp) => {
    return moment(timestamp).local().format("LT");
  };

  const handleActionPress = (action) => {
    switch (action) {
      case "reply":
        onReply(message);
        break;
      case "react":
        setShowReactionsSelector(true);
        break;
      case "copy":
        onCopy();
        break;
      case "delete":
        onDelete(message);
        break;
    }
    setActionSheetVisible(false);
  };
  const renderMediaContent = () => {
    if (isMediaMessage && message.mediaType === "image") {
      return (
        <Image
          source={{ uri: message.mediaUrl }}
          style={styles.media}
          resizeMode="cover"
        />
      );
    }
    // Here's where we handle text messages with potential links
    if (typeof message.contentText === "string") {
      return (
        // react-native-hyperlink (last published 2019) only auto-linked URLs.
        // React Native's own dataDetectorType does the same natively.
        <Text
          style={styles.messageText}
          dataDetectorType="all"
          selectable
        >
          {message.contentText}
        </Text>
      );
    }
    // Placeholder for voice message
    if (message.mediaType === "voice") {
      return (
        <TouchableOpacity style={styles.voiceMessage}>
          {/* Add an icon for voice play */}
          <Icon name="play-circle" size={30} color={tokens.primary} />
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <Swipeable
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.swipeAction}
          onPress={() => onDelete(message)}
        >
          <Icon name="trash" size={20} color={tokens.onPrimary} />
        </TouchableOpacity>
      )}
      renderLeftActions={() => (
        <TouchableOpacity
          style={styles.swipeAction}
          onPress={() => onReply(message)}
        >
          <Icon name="reply" size={20} color={tokens.onPrimary} />
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={[
          styles.container,
          isSender ? styles.senderContainer : styles.receiverContainer,
        ]}
        onLongPress={handleLongPress}
      >
        {renderMediaContent()}
        <Text style={styles.timestamp}>{formatDate(message.timestamp)}</Text>
        {isSender && <Icon name="check-circle" size={12} color="green" />}
        <CustomActionSheet
          visible={actionSheetVisible}
          onClose={() => setActionSheetVisible(false)}
          onActionPress={handleActionPress}
        />
        {showReactionsSelector && (
          <ReactionSelectorComponent onReact={handleReaction} />
        )}
      </TouchableOpacity>
    </Swipeable>
  );
};
const makeStyles = (t) => StyleSheet.create({
  container: {
    marginVertical: 4,
    padding: 10,
    borderRadius: 10,
    maxWidth: "80%",
  },
  senderContainer: {
    backgroundColor: t.successSoft, // Light green for sender
    alignSelf: "flex-end",
  },
  receiverContainer: {
    backgroundColor: t.surfaceAlt, // Light grey for receiver
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
  },
  timestamp: {
    fontSize: 12,
    color: t.textMuted,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  media: {
    width: 200, // or a dynamic width based on the screen size
    height: 150, // or a dynamic height based on the aspect ratio of the image
    borderRadius: 10,
    marginBottom: 5,
  },
  voiceMessage: {
    padding: 10,
    borderRadius: 25,
    backgroundColor: t.surfaceAlt,
    alignItems: "center",
  },
});

export default MessageItemComponent;
