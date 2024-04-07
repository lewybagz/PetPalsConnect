// App.js
import React, { useEffect } from "react";
import messaging from "@react-native-firebase/messaging";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView, State } from "react-native-gesture-handler";
import AuthStack from "./src/screens/navigation/AuthStack";
import MainStackNavigator from "./src/screens/navigation/mainstacknavigator";
import MoreStackNavigator from "./src/screens/navigation/mainstacknavigator";
import BottomTabNavigator from "./BottomTabNavigator";
import { PanGestureHandler } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { Animated } from "react-native";
import { AppThemeProvider } from "./src/context/AppThemeContext";

const Stack = createStackNavigator();

function App() {
  const navigation = useNavigation();
  const translateX = new Animated.Value(0);

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
        // Threshold for swipe length
        navigation.navigate("Map");
      }

      Animated.timing(translateX, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const requestUserPermission = async () => {
    const authStatus = await messaging().requestPermission();

    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log("Authorization status:", authStatus);

      // Get the device token
      const token = await messaging().getToken();
      console.log("Device token:", token);

      // You can now send the device token to your server to register for push notifications
      // or use it to subscribe to topics
    } else {
      console.log("Authorization status:", authStatus);
    }
  };
  useEffect(() => {
    requestUserPermission();

    // Handle incoming messages
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      // Display your notification
      alert("A new notification arrived!", JSON.stringify(remoteMessage));
    });

    // Check whether an initial notification is available
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log(
            "Notification caused app to open from quit state:",
            remoteMessage
          );
          navigation.navigate("Notification", { remoteMessage });
          // You might want to set some state here to use in your navigation
        }
      });

    // Handle notification tap when the app is in background
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log(
        "Notification caused app to open from background state:",
        remoteMessage
      );
      // Navigate to the appropriate screen
    });

    return unsubscribe;
  }, []);

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
