// App.js
import React, { useEffect } from "react";
import messaging from "@react-native-firebase/messaging";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView, State } from "react-native-gesture-handler";
import AuthStack from "./src/screens/navigation/AuthStack";
import MainStackNavigator from "./src/screens/navigation/mainstacknavigator";
import MoreStackNavigator from "./src/screens/navigation/mainstacknavigator";
import ChatStackNavigator from "./src/screens/navigation/ChatStack";
import PetsStackNavigator from "./src/screens/navigation/PetStack";
import PlaydatestackNavigator from "./src/screens/navigation/PlaydateStack";
import ProfileStackNavigator from "./src/screens/navigation/ProfileStack";
import SettingsStackNavigator from "./src/screens/navigation/SettingsStack";
import SubscriptionStackNavigator from "./src/screens/navigation/SubscriptionStack";
import BottomTabNavigator from "./BottomTabNavigator";
import { PanGestureHandler } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { Animated, BackHandler, Alert } from "react-native";
import { AppThemeProvider } from "./src/context/AppThemeContext";
import { sendTokenToServer } from "./utils/tokenutil";

const Stack = createStackNavigator();

function App() {
  const navigation = useNavigation();
  const translateX = new Animated.Value(0);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    // Requesting user permissions for notifications
    requestUserPermission();

    // Listener for messages received while the app is in the foreground
    const unsubscribeOnMessage = messaging().onMessage(
      async (remoteMessage) => {
        Alert.alert(
          "A new notification arrived!",
          JSON.stringify(remoteMessage)
        );
        handleNotification(remoteMessage);
      }
    );

    // Handling the initial notification when the app is opened from a killed state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          handleNotification(remoteMessage);
        }
      });

    // Listener for notifications when the app is in background but not closed
    const onNotificationOpenedAppUnsub = messaging().onNotificationOpenedApp(
      (remoteMessage) => {
        handleNotification(remoteMessage);
      }
    );

    return () => {
      backHandler.remove();
      unsubscribeOnMessage();
      onNotificationOpenedAppUnsub();
    };
  }, [navigation]);

  // Handles navigation based on the notification's type and data
  function handleNotification(remoteMessage) {
    const { type, ...data } = remoteMessage.data;
    switch (type) {
      case "friendRequest":
        navigation.navigate("PlaydateRequests", {
          requesterId: data.requesterId,
          petName: data.petName,
        });
        break;
      case "message":
        navigation.navigate("Chat", { chatId: data.chatId });
        break;
      case "playdate":
        navigation.navigate("PlaydateDetails", { playdateId: data.playdateId });
        break;
      case "reviewReminder":
        navigation.navigate("PlaydateReview", { playdateId: data.playdateId });
        break;
      case "general":
        navigation.navigate("Notifications", {
          notificationId: data.notificationId,
        });
        break;
      default:
        navigation.navigate("Home");
    }
  }

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return true;
    } else {
      Alert.alert(
        "Exit App",
        "Do you want to exit the app?",
        [
          { text: "Cancel", onPress: () => null, style: "cancel" },
          {
            text: "Yes",
            onPress: () => BackHandler.exitApp(),
          },
        ],
        { cancelable: false }
      );
      return true;
    }
  };
  const onGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      if (event.nativeEvent.translationX < -100) {
        navigation.navigate("Map");
      } else if (event.nativeEvent.translationX > 100) {
        navigation.goBack();
      }

      Animated.timing(translateX, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const requestUserPermission = async () => {
    try {
      const authStatus = await messaging().requestPermission({
        alert: true,
        announcement: false, // iOS only
        badge: true,
        carPlay: true, // iOS only
        provisional: false, // iOS only, allows silent notifications
        sound: true,
      });

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log("Notification authorization status:", authStatus);

        const token = await messaging().getToken();
        if (token) {
          sendTokenToServer(token);
        }
      } else {
        console.warn("Notification permission not granted:", authStatus);
        Alert.alert(
          "Error requesting notification permission",
          "Please try again later"
        );
      }
    } catch (error) {
      Alert.alert(
        "Error requesting notification permission",
        "Please try again later"
      );
    }
  };

  return (
    <AppThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
            <NavigationContainer>
              <Stack.Navigator>
                <AuthStack />
                <MainStackNavigator />
                <MoreStackNavigator />
                <ProfileStackNavigator />
                <SettingsStackNavigator />
                <SubscriptionStackNavigator />
                <ChatStackNavigator />
                <PetsStackNavigator />
                <PlaydatestackNavigator />
                <Stack.Screen
                  name="BottomTabs"
                  component={BottomTabNavigator}
                  options={{ headerShown: false }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </Animated.View>
        </PanGestureHandler>
      </GestureHandlerRootView>
    </AppThemeProvider>
  );
}

export default App;
