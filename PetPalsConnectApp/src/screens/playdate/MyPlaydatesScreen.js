// MyPlaydatesScreen.js

import React, { useState, useEffect, useMemo } from "react";
// `Text` is not exported by material-top-tabs - it never was. Importing it
// here made every empty list render `undefined` as a component, which is a
// crash on the one state a new user is guaranteed to see first.
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { FlatList, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import PlaydateCardComponent from "../../components/PlaydateCardComponent";
import { useDispatch, useSelector } from "react-redux";
import { fetchPlaydates , clearError } from "../../redux/actions";

import LoadingScreen from "../../components/LoadingScreenComponent";
import { EmptyState, useToast } from "../../components/ui";
import { useTokens } from "../../context/AppThemeContext";
const Tab = createMaterialTopTabNavigator();

const PlaydateList = ({ type }) => {
  const dispatch = useDispatch();
  const toast = useToast();
  // `<Tab.Screen>{() => <PlaydateList .../>}</Tab.Screen>` passes no props, so
  // tapping a card called navigate() on undefined.
  const navigation = useNavigation();
  const playdates = useSelector((state) => state.playdate.playdates);
  const isLoading = useSelector((state) => state.playdate.isLoading);
  const error = useSelector((state) => state.playdate.error);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!playdates.length) {
      dispatch(fetchPlaydates());
    }
  }, [dispatch, playdates.length]);

  // Handle error display
  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch, toast]);

  // Display a loading indicator while fetching playdates
  if (isLoading) {
    return <LoadingScreen />;
  }

  const filteredPlaydates = playdates.filter((playdate) =>
    type === "upcoming"
      ? new Date(playdate.date) > new Date()
      : new Date(playdate.date) <= new Date()
  );

  const renderPlaydate = ({ item }) => {
    const handlePress = () => {
      navigation.navigate("PlaydateDetails", { playdateId: item._id });
    };

    return (
      <TouchableOpacity onPress={handlePress}>
        <PlaydateCardComponent playdate={item} navigation={navigation} />
      </TouchableOpacity>
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    dispatch(fetchPlaydates());
    setRefreshing(false);
  };

  return (
    <>
      <FlatList
        data={filteredPlaydates}
        renderItem={renderPlaydate}
        keyExtractor={(item) => item._id.toString()}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
      {filteredPlaydates.length === 0 && (
        <EmptyState
          title={type === "upcoming" ? "Nothing planned yet" : "No playdates yet"}
          message={
            type === "upcoming"
              ? "When you arrange a playdate, it'll show up here."
              : "Playdates you've already had will be listed here."
          }
        />
      )}
    </>
  );
};

const MyPlaydatesScreen = () => {
  const tokens = useTokens();
  // A colour in a StyleSheet cannot follow a theme, so these are built from
  // the tokens. `tabBarActiveTintColor` was the literal string "#yourColor".
  const tabStyles = useMemo(
    () => ({
      tabBarIndicatorStyle: { backgroundColor: tokens.primary },
      tabBarActiveTintColor: tokens.primary,
      tabBarInactiveTintColor: tokens.textMuted,
      tabBarStyle: { backgroundColor: tokens.surface },
      tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
    }),
    [tokens]
  );

  return (
    <Tab.Navigator screenOptions={tabStyles}>
      <Tab.Screen name="Upcoming">
        {() => <PlaydateList type="upcoming" />}
      </Tab.Screen>
      <Tab.Screen name="Past">{() => <PlaydateList type="past" />}</Tab.Screen>
    </Tab.Navigator>
  );
};

export default MyPlaydatesScreen;
