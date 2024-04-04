import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import ChatDetailsScreen from "../chat/ChatDetailsScreen";
import ChatScreen from "../chat/ChatScreen";
import ChatsScreen from "../chat/ChatsScreen";
import ChatTabsScreen from "../chat/ChatTabsScreen";
import GroupChatCreationScreen from "../chat/GroupChatCreationScreen";
import GroupChatScreen from "../chat/GroupChatScreen";
import GroupChatsScreen from "../chat/GroupChatsScreen";
import MediaViewScreen from "../chat/MediaViewScreen";
import PetSelectionScreen from "../chat/PetSelectionScreen";
import PetListScreen from "../pets/PetListScreen";
import PetDetailsScreen from "../pets/PetDeatailsScreen";

const ChatStack = createStackNavigator();

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator
      initialRouteName="ChatTabs"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      <ChatStack.Screen name="PetDetails" component={PetDetailsScreen} />
      <ChatStack.Screen name="MediaView" component={MediaViewScreen} />
      <ChatStack.Screen name="PetList" component={PetListScreen} />
      <ChatStack.Screen name="ChatTabs" component={ChatTabsScreen} />
      <ChatStack.Screen name="ChatDetails" component={ChatDetailsScreen} />
      <ChatStack.Screen name="Chat" component={ChatScreen} />
      <ChatStack.Screen name="Chats" component={ChatsScreen} />
      <ChatStack.Screen
        name="GroupChatCreation"
        component={GroupChatCreationScreen}
      />
      <ChatStack.Screen name="GroupChat" component={GroupChatScreen} />
      <ChatStack.Screen name="GroupChats" component={GroupChatsScreen} />
      <ChatStack.Screen name="MediaView" component={MediaViewScreen} />
      <ChatStack.Screen name="PetSelection" component={PetSelectionScreen} />
    </ChatStack.Navigator>
  );
}

export default ChatStackNavigator;
