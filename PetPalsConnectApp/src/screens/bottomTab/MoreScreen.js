// MoreScreen.js
import React, { useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { copilot, walkthroughable, CopilotStep } from "react-native-copilot";
import CustomTooltip from "../../components/CustomTooltip";

// Walkthroughable components
const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);
const WalkthroughableText = walkthroughable(Text);

const MoreScreen = ({ route, start, navigation }) => {
  useEffect(() => {
    if (route.params?.showTutorial) {
      start(); // Start copilot tutorial
    }
  }, [route.params?.showTutorial]);
  1;

  return (
    <View style={styles.container}>
      {/* Copilot Steps for each feature on the More screen */}
      <CopilotStep
        text="Create a group chat for pet lovers here."
        order={1}
        name="groupChatCreation"
      >
        <WalkthroughableTouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("GroupChatCreation")}
        >
          <WalkthroughableText style={styles.buttonText}>
            Group Chat Creation
          </WalkthroughableText>
        </WalkthroughableTouchableOpacity>
      </CopilotStep>

      <CopilotStep
        text="View and manage all your favorites."
        order={2}
        name="favorites"
      >
        <WalkthroughableTouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("Favorites")}
        >
          <WalkthroughableText style={styles.buttonText}>
            Favorites
          </WalkthroughableText>
        </WalkthroughableTouchableOpacity>
      </CopilotStep>

      <CopilotStep
        text="Check your latest notifications."
        order={3}
        name="notifications"
      >
        <WalkthroughableTouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("Notifications")}
        >
          <WalkthroughableText style={styles.buttonText}>
            Notifications
          </WalkthroughableText>
        </WalkthroughableTouchableOpacity>
      </CopilotStep>

      {/* PROFILE */}
      <CopilotStep text="View and edit your profile." order={5} name="profile">
        <WalkthroughableTouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("Profile")}
        >
          <WalkthroughableText style={styles.buttonText}>
            Profile
          </WalkthroughableText>
        </WalkthroughableTouchableOpacity>
      </CopilotStep>

      <CopilotStep
        text="Add a new pet to your profile."
        order={4}
        name="addPet"
      >
        <WalkthroughableTouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("AddPet")}
        >
          <WalkthroughableText style={styles.buttonText}>
            Add Pet
          </WalkthroughableText>
        </WalkthroughableTouchableOpacity>
      </CopilotStep>

      {/* Add other CopilotSteps for additional buttons as needed */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  button: {
    backgroundColor: "tomato",
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
    width: "100%",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
  },
});

export default copilot({
  tooltipComponent: CustomTooltip,
})(MoreScreen);
