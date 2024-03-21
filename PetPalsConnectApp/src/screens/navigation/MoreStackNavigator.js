// MoreStackNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import MoreScreen from "../screens/MoreScreen";
import AddPetScreen from "../screens/AddPetScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import GroupChatCreationScreen from "../screens/GroupChatCreationScreen";
import NotificationsScreen from "../screens/NotificationsScreen";

const MoreStack = createStackNavigator();

const MoreStackNavigator = () => {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{ title: "More Options" }}
      />
      <MoreStack.Screen
        name="AddPet"
        component={AddPetScreen}
        options={{ title: "Add Pet" }}
      />
      <MoreStack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: "Favorites" }}
      />
      <MoreStack.Screen
        name="GroupChatCreationScreen"
        component={GroupChatCreationScreen}
        options={{ title: "Group Chat Creation" }}
      />
      <MoreStack.Screen
        name="NotificationsScreen"
        component={NotificationsScreen}
        options={{ title: "Notifications" }}
      />
      {/* Add other screens as needed */}
    </MoreStack.Navigator>
  );
};

export default MoreStackNavigator;
