import React, { useState, useEffect } from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import ChatsScreen from "./ChatsScreen";
import GroupChatsScreen from "./GroupChatsScreen";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { readCache, writeCache, CacheKeys } from "../../services/localCache";

const Tab = createMaterialTopTabNavigator();

const ChatTabsScreen = () => {
  const [initialState, setInitialState] = useState(null);
  const [restored, setRestored] = useState(false);

  // Remembers which chat tab was last open. This used Realm, which reached
  // end-of-life in September 2025; AsyncStorage covers the same need.
  useEffect(() => {
    let cancelled = false;
    readCache(CacheKeys.navigationState).then((saved) => {
      if (cancelled) return;
      if (saved) setInitialState(saved);
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStateChange = (state) => {
    if (state) writeCache(CacheKeys.navigationState, state);
  };

  // Mounting the navigator before the saved state loads would make it ignore
  // `initialState`, so hold off for the one tick it takes to read.
  if (!restored) return null;

  return (
    <Tab.Navigator
      initialState={initialState}
      onStateChange={handleStateChange}
      swipeEnabled={true}
      lazy={true}
      screenOptions={{
        tabBarActiveTintColor: "#e91e63",
        tabBarIndicatorStyle: { backgroundColor: "white" },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: { backgroundColor: "powderblue" },
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="chat" color={color} size={size} />
          ),
          tabBarBadge: 3,
        }}
      />
      <Tab.Screen
        name="GroupChats"
        component={GroupChatsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="group" color={color} size={size} /> // Assuming 'group' is the icon name
          ),
          tabBarBadge: 3,
        }}
      />
    </Tab.Navigator>
  );
};

export default ChatTabsScreen;
