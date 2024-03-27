import React, { useState, useEffect } from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import ChatsScreen from "./ChatsScreen";
import GroupChatsScreen from "./GroupChatsScreen";
import Realm from "realm";
import Icon from "react-native-vector-icons/MaterialIcons";
import NavigationStateSchema from "../../../../backend/models/NavigationState";

const Tab = createMaterialTopTabNavigator();

const ChatTabsScreen = () => {
  const [initialState, setInitialState] = useState(null);
  useEffect(() => {
    let realm;

    const restoreState = async () => {
      realm = await Realm.open({ schema: [NavigationStateSchema] });

      const savedState = realm.objects("NavigationState")[0];
      if (savedState) {
        setInitialState(JSON.parse(savedState.state));
      }
    };

    restoreState();

    return () => {
      if (realm && !realm.isClosed) {
        realm.close();
      }
    };
  }, []);

  const handleStateChange = (state) => {
    Realm.open({ schema: [NavigationStateSchema] }).then((realm) => {
      realm.write(() => {
        realm.create(
          "NavigationState",
          { id: 1, state: JSON.stringify(state) },
          Realm.UpdateMode.Modified
        );
      });
    });
  };

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
          tabBarBadge: 3, // Add badge for notifications
        }}
      />
      <Tab.Screen
        name="GroupChats"
        component={GroupChatsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="group" color={color} size={size} /> // Assuming 'group' is the icon name
          ),
          tabBarBadge: 3, // Add badge for notifications
        }}
      />
    </Tab.Navigator>
  );
};

export default ChatTabsScreen;
