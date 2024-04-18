import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import AddPetScreen from "../pets/AddPetScreen";
import PetDetailsScreen from "../pets/PetDetailsScreen";
import PetListScreen from "../pets/PetListScreen";
import UsersPetsScreen from "../profile/UsersPetsScreen";
import HomeScreen from "../bottomTab/HomeScreen";
import ChatScreen from "../chat/ChatScreen";
import SchedulePlaydateScreen from "../playdate/SchedulePlaydateDetailsScreen";
import FriendsListScreen from "../profile/FriendsListScreen";

const PetsStack = createStackNavigator();

function PetsStackNavigator() {
  return (
    <PetsStack.Navigator
      initialRouteName="PetList"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      <PetsStack.Screen
        name="SchedulePlaydate"
        component={SchedulePlaydateScreen}
      />
      <PetsStack.Screen name="FriendsList" component={FriendsListScreen} />
      <PetsStack.Screen name="Chat" component={ChatScreen} />
      <PetsStack.Screen name="Home" component={HomeScreen} />
      <PetsStack.Screen name="PetList" component={PetListScreen} />
      <PetsStack.Screen name="AddPet" component={AddPetScreen} />
      <PetsStack.Screen name="PetDetails" component={PetDetailsScreen} />
      <PetsStack.Screen name="UsersPets" component={UsersPetsScreen} />
    </PetsStack.Navigator>
  );
}

export default PetsStackNavigator;
