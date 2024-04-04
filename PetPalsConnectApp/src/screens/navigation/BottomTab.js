import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MainStackNavigator from "./MainStackNavigator";
import ChatTabsScreen from "../chat/ChatTabsScreen";
import ProfileScreen from "../profile/ProfileScreen";
import PetListScreen from "../petsPetListScreen";
import MoreScreen from "../bottomTab/MoreScreen";
import { Ionicons } from "@expo/vector-icons";

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
            case "Profile":
              iconName = focused ? "ios-person" : "ios-person-outline";
              break;
            case "PetList":
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
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="PetList" component={PetListScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
