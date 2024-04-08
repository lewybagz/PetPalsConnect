// MyPlaydatesScreen.js

import React, { useState, useEffect } from "react";
import {
  createMaterialTopTabNavigator,
  Text,
} from "@react-navigation/material-top-tabs";
import { StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import PlaydateCardComponent from "../../components/PlaydateCardComponent";
import { useDispatch, useSelector } from "react-redux";
import { fetchPlaydates } from "../../redux/actions";
import { clearError } from "../../redux/actions";
import LoadingScreen from "../../components/LoadingScreenComponent";
const Tab = createMaterialTopTabNavigator();

const PlaydateList = ({ type, navigation }) => {
  const dispatch = useDispatch();
  const playdates = useSelector((state) => state.playdateReducer.playdates);
  const isLoading = useSelector((state) => state.playdateReducer.isLoading);
  const error = useSelector((state) => state.playdateReducer.error);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!playdates.length) {
      dispatch(fetchPlaydates());
    }
  }, [dispatch, playdates.length]);

  // Handle error display
  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

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
      navigation.navigate("PlaydateDetail", { playdateId: item._id });
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
      {playdates.length === 0 && (
        <Text style={styles.emptyMessage}>No {type} playdates to show.</Text>
      )}
    </>
  );
};

const MyPlaydatesScreen = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarIndicatorStyle: styles.tabIndicator,
        tabBarActiveTintColor: "#yourColor",
        tabBarLabelStyle: styles.tabLabel,
        // Other styling properties
      }}
    >
      <Tab.Screen name="Upcoming">
        {() => <PlaydateList type="upcoming" />}
      </Tab.Screen>
      <Tab.Screen name="Past">{() => <PlaydateList type="past" />}</Tab.Screen>
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  list: {
    padding: 10,
  },
});

export default MyPlaydatesScreen;
