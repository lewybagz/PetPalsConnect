import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "../bottomTab/HomeScreen";
import ProfileScreen from "../profile/ProfileScreen";
import PetListScreen from "../pets/PetListScreen";
import SettingsScreen from "../settings/SettingsScreen";
import NotificationsScreen from "../bottomTab/NotificationsScreen";
import ArticlesScreen from "../misc/ArticlesScreen";
import ArticleDetailScreen from "../misc/ArticleDetailScreen";

const MainStack = createStackNavigator();

const MainStackNavigator = () => {
  return (
    <MainStack.Navigator initialRouteName="Home" gestureEnabled:true>
      <MainStack.Screen name="Home" component={HomeScreen} />
      <MainStack.Screen name="Profile" component={ProfileScreen} />
      <MainStack.Screen name="PetList" component={PetListScreen} />
      <MainStack.Screen name="Settings" component={SettingsScreen} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} />
      <MainStack.Screen name="ArticlesScreen" component={ArticlesScreen} />
      <MainStack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
    </MainStack.Navigator>
  );
};

export default MainStackNavigator;
