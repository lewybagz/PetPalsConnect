import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

// Importing the screens from the profile folder
import AccountInformationScreen from "../profile/AccountInformationScreen";
import ChangePasswordScreen from "../profile/ChangePasswordScreen";
import ProfileScreen from "../profile/ProfileScreen";
import ReportUserScreen from "../profile/ReportUserScreen";
import UsersPetsScreen from "../profile/UsersPetsScreen";
import MyPladatesScreen from "../playdate/MyPlaydatesScreen";
import PetListScreen from "../pets/PetListScreen";
import FriendsListScreen from "../profile/FriendsListScreen";

const ProfileStack = createStackNavigator();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      initialRouteName="Profile"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      <ProfileStack.Screen name="FriendsList" component={FriendsListScreen} />
      <ProfileStack.Screen name="PetList" component={PetListScreen} />
      <ProfileStack.Screen name="MyPlaydates" component={MyPladatesScreen} />
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen
        name="AccountInformation"
        component={AccountInformationScreen}
      />
      <ProfileStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
      />
      <ProfileStack.Screen name="ReportUser" component={ReportUserScreen} />
      <ProfileStack.Screen name="UsersPets" component={UsersPetsScreen} />
    </ProfileStack.Navigator>
  );
}

export default ProfileStackNavigator;
