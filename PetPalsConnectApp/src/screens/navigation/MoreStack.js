// MoreStackNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import MoreScreen from "../bottomTab/MapScreen";
import AddPetScreen from "../pets/AddPetScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import GroupChatCreationScreen from "../chat/GroupChatCreationScreen";
import NotificationsScreen from "../bottomTab/NotificationsScreen";

const MoreStack = createStackNavigator();

const MoreStackNavigator = () => {
  return (
    <MoreStack.Navigator initialRouteName="MoreHome" gestureEnabled:true>
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
    </MoreStack.Navigator>
  );
};

export default MoreStackNavigator;
