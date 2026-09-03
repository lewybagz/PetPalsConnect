import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../bottomTab/HomeScreen";
import DiscoverScreen from "../swipe/DiscoverScreen";
import ChatTabsScreen from "../chat/ChatTabsScreen";
import ScheduledPlaydatesScreen from "../bottomTab/ScheduledPlaydatesScreen";
import NotificationsScreen from "../bottomTab/NotificationsScreen";
import MoreScreen from "../bottomTab/MoreScreen";
import NotificationTabIcon from "../../components/TabIcon";

const Tab = createBottomTabNavigator();

// The old "ios-" prefixed names were removed in react-native-vector-icons v10,
// so every tab icon silently rendered blank.
const ICONS = {
  Home: ["home", "home-outline"],
  Discover: ["heart", "heart-outline"],
  Chats: ["chatbubbles", "chatbubbles-outline"],
  Playdates: ["paw", "paw-outline"],
  More: ["menu", "menu-outline"],
};

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "tomato",
        tabBarInactiveTintColor: "gray",
        tabBarIcon: ({ focused, color, size }) => {
          const pair = ICONS[route.name];
          if (!pair) return null;
          return <Ionicons name={focused ? pair[0] : pair[1]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Chats" component={ChatTabsScreen} />
      <Tab.Screen name="Playdates" component={ScheduledPlaydatesScreen} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused }) => <NotificationTabIcon focused={focused} />,
        }}
      />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}
