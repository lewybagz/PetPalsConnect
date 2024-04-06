import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import MyPlaydatesScreen from "../playdate/MyPlaydatesScreen";
import PlaydateCancellationConfirmationScreen from "../playdate/PlaydateCancellationConfirmationScreen";
import PlaydateCreatedScreen from "../playdate/PlaydateCreatedScreen";
import PlaydateDetailsScreen from "../playdate/PlaydateDetailsScreen";
import PlaydateHistoryScreen from "../playdate/PlaydateHistoryScreen";
import PlaydateModificationScreen from "../playdate/PlaydateModificationScreen";
import PlaydatePetSelectionScreen from "../playdate/PlaydatePetSelectionScreen";
import PlaydateRequestScreen from "../playdate/PlaydateRequestScreen";
import PostPlaydateReviewScreen from "../playdate/PostPlaydateReviewScreen";
import PotentialPlaydateLocationScreen from "../playdate/PotentialPlaydateLocationScreen";
import PotentialPlaydateLocationsScreen from "../playdate/PotentialPlaydateLocationsScreen";
import ScheduledPlaydatesScreen from "../playdate/ScheduledPlaydatesScreen";
import SchedulePlaydateDetailsScreen from "../playdate/SchedulePlaydateDetailsScreen";
import SchedulePlaydateScreen from "../playdate/SchedulePlaydateScreen";
import UpcomingPlaydateScreen from "../playdate/UpcomingPlaydateScreen";

const PlaydateStack = createStackNavigator();

function PlaydateStackNavigator() {
  return (
    <PlaydateStack.Navigator initialRouteName="MyPlaydates" gestureEnabled:true>
      <PlaydateStack.Screen name="MyPlaydates" component={MyPlaydatesScreen} />
      <PlaydateStack.Screen
        name="PlaydateCancellationConfirmation"
        component={PlaydateCancellationConfirmationScreen}
      />
      <PlaydateStack.Screen
        name="PlaydateCreated"
        component={PlaydateCreatedScreen}
      />
      <PlaydateStack.Screen
        name="PlaydateDetails"
        component={PlaydateDetailsScreen}
      />
      <PlaydateStack.Screen
        name="PlaydateHistory"
        component={PlaydateHistoryScreen}
      />
      <PlaydateStack.Screen
        name="PlaydateModification"
        component={PlaydateModificationScreen}
      />
      <PlaydateStack.Screen
        name="PlaydatePetSelection"
        component={PlaydatePetSelectionScreen}
      />
      <PlaydateStack.Screen
        name="PlaydateRequest"
        component={PlaydateRequestScreen}
      />
      <PlaydateStack.Screen
        name="PostPlaydateReview"
        component={PostPlaydateReviewScreen}
      />
      <PlaydateStack.Screen
        name="PotentialPlaydateLocation"
        component={PotentialPlaydateLocationScreen}
      />
      <PlaydateStack.Screen
        name="PotentialPlaydateLocations"
        component={PotentialPlaydateLocationsScreen}
      />
      <PlaydateStack.Screen
        name="ScheduledPlaydates"
        component={ScheduledPlaydatesScreen}
      />
      <PlaydateStack.Screen
        name="SchedulePlaydateDetails"
        component={SchedulePlaydateDetailsScreen}
      />
      <PlaydateStack.Screen
        name="SchedulePlaydate"
        component={SchedulePlaydateScreen}
      />
      <PlaydateStack.Screen
        name="UpcomingPlaydate"
        component={UpcomingPlaydateScreen}
      />
    </PlaydateStack.Navigator>
  );
}

export default PlaydateStackNavigator;
