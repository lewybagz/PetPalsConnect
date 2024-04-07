import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MainStackNavigator from "./MainStackNavigator";
import ChatTabsScreen from "../chat/ChatTabsScreen";
import ScheduledPlaydatesScreen from "../playdate/ScheduledPlaydatesScreen";
import NotificationsScreen from "../bottomTab/NotificationsScreen";
import MoreScreen from "../bottomTab/MoreScreen";
import { Ionicons } from "@expo/vector-icons";
import NotificationTabIcon from "../../components/TabIcon";

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case "Home":
              iconName = focused ? "ios-home" : "ios-home-outline";
              break;
            case "Chats":
              iconName = focused
                ? "ios-chatbubbles"
                : "ios-chatbubbles-outline";
              break;
            case "Playdates":
              iconName = focused ? "ios-paw" : "ios-paw-outline";
              break;
            case "Notifications":
              iconName = focused ? "ios-paw" : "ios-paw-outline";
              break;
            case "More":
              iconName = focused ? "ios-menu" : "ios-menu-outline";
              break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "tomato",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen name="HomeStack" component={MainStackNavigator} />
      <Tab.Screen name="Chats" component={ChatTabsScreen} />
      <Tab.Screen name="Playdates" component={ScheduledPlaydatesScreen} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <NotificationTabIcon focused={focused} />
          ),
        }}
      />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
