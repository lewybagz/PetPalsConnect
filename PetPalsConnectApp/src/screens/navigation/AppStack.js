import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BottomTabNavigator from "./BottomTab";
import { withRequiredPet } from "../../components/RequiresPet";

// Chat
import ChatDetailsScreen from "../chat/ChatDetailsScreen";
import ChatScreen from "../bottomTab/ChatScreen";
import ChatsScreen from "../chat/ChatsScreen";
import GroupChatCreationScreen from "../chat/GroupChatCreationScreen";
import GroupChatScreen from "../chat/GroupChatScreen";
import GroupChatsScreen from "../chat/GroupChatsScreen";
import MediaViewScreen from "../chat/MediaViewScreen";
import PetSelectionScreen from "../chat/PetSelectionScreen";

// Pets
import AddPetScreen from "../pets/AddPetScreen";
import PetDetailsScreen from "../pets/PetDetailsScreen";
import PetPhotosScreen from "../pets/PetPhotosScreen";
import PetListScreen from "../pets/PetListScreen";

// Playdates
import MyPlaydatesScreen from "../playdate/MyPlaydatesScreen";
import PlaydateCancellationConfirmationScreen from "../playdate/PlaydateCancellationConfirmationScreen";
import PlaydateCreatedScreen from "../playdate/PlaydateCreatedScreen";
import PlaydateDetailsScreen from "../playdate/PlaydateDetailsScreen";
import PlaydateHistoryScreen from "../playdate/PlaydateHistoryScreen";
import PlaydateModificationConfirmationScreen from "../playdate/PlaydateModificationConfirmationScreen";
import PlaydateModificationScreen from "../playdate/PlaydateModificationScreen";
import PlaydateRequestScreen from "../playdate/PlaydateRequestScreen";
import PostPlaydateReviewScreen from "../playdate/PostPlaydateReviewScreen";
import PotentialPlaydateLocationScreen from "../playdate/PotentialPlaydateLocationScreen";
import PotentialPlaydateLocationsScreen from "../playdate/PotentialPlaydateLocationsScreen";
import SchedulePlaydateScreen from "../playdate/SchedulePlaydateScreen";
import UpcomingPlaydateScreen from "../playdate/UpcomingPlaydateScreen";

// Profile
import AccountInformationScreen from "../profile/AccountInformationScreen";
import ChangePasswordScreen from "../profile/ChangePasswordScreen";
import FavoritesScreen from "../profile/FavoritesScreen";
import FriendRequestsScreen from "../profile/FriendRequestsScreen";
import FriendsListScreen from "../profile/FriendsListScreen";
import ProfileScreen from "../profile/ProfileScreen";
import ReportUserScreen from "../profile/ReportUserScreen";
import UsersPetsScreen from "../profile/UsersPetsScreen";

// Settings
import AboutAppScreen from "../settings/AboutAppScreen";
import AddPaymentMethodScreen from "../settings/AddPaymentMethodScreen";
import HelpSupportScreen from "../settings/HelpSupportScreen";
import LegalPoliciesScreen from "../settings/LegalPoliciesScreen";
import NotificationPreferencesScreen from "../settings/NotificationPreferencesScreen";
import PaymentMethodsScreen from "../settings/PaymentMethodsScreen";
import PrivacySettingsScreen from "../settings/PrivacySettingsScreen";
import BlockedAccountsScreen from "../settings/BlockedAccountsScreen";
import SecuritySettingsScreen from "../settings/SecuritySettingsScreen";
import SettingsScreen from "../settings/SettingsScreen";
import ChoosePlanScreen from "../settings/subscription/ChoosePlanScreen";
import SubscriptionConfirmationScreen from "../settings/subscription/SubscriptionConfirmationScreen";
import SubscriptionHistoryScreen from "../settings/subscription/SubscriptionHistoryScreen";
import SubscriptionManagementScreen from "../settings/subscription/SubscriptionManagementScreen";

// Misc
import ArticleDetailScreen from "../misc/ArticleDetailScreen";
import ArticlesScreen from "../misc/ArticlesScreen";
import MapScreen from "../swipe/MapScreen";

const Stack = createNativeStackNavigator();

/**
 * The signed-in navigation tree.
 *
 * Every non-tab screen is registered flat on one stack rather than spread
 * across nine sibling stacks. That was the source of most of the app's
 * navigation bugs: a `navigate("PlaydateDetails")` from a chat screen could not
 * resolve a route living in a stack that was never mounted. A flat stack means
 * any screen can reach any other by name, which is also what the push
 * notification handler relies on.
 *
 * Adding a pet during onboarding is skippable, so a few screens cannot function
 * until one exists. Those are wrapped in `withRequiredPet` here rather than
 * each growing its own "no pets yet" branch.
 */

// Screens that are meaningless without a pet, with copy that says why.
const MapWithPet = withRequiredPet(MapScreen, {
  title: "Add a pet to start matching",
  message: "The map shows pets near you that could be a good match for yours.",
});
const PetSelectionWithPet = withRequiredPet(PetSelectionScreen, {
  title: "Add a pet to start chatting",
  message: "Chats in PetPals happen between pets, so you'll need one first.",
});
const SchedulePlaydateWithPet = withRequiredPet(SchedulePlaydateScreen, {
  title: "Add a pet to plan a playdate",
  message: "Playdates are arranged between pets, so add yours to get started.",
});

export default function AppStack() {
  return (
    <Stack.Navigator
      initialRouteName="Tabs"
      screenOptions={{ headerBackTitleVisible: false, gestureEnabled: true }}
    >
      <Stack.Screen name="Tabs" component={BottomTabNavigator} options={{ headerShown: false }} />

      {/* Chat */}
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Chat" }} />
      <Stack.Screen name="Chats" component={ChatsScreen} options={{ title: "Chats" }} />
      <Stack.Screen name="ChatDetails" component={ChatDetailsScreen} options={{ title: "Details" }} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} options={{ title: "Group Chat" }} />
      <Stack.Screen name="GroupChats" component={GroupChatsScreen} options={{ title: "Group Chats" }} />
      <Stack.Screen name="GroupChatCreation" component={GroupChatCreationScreen} options={{ title: "New Group" }} />
      <Stack.Screen name="MediaView" component={MediaViewScreen} options={{ title: "Media" }} />
      <Stack.Screen name="PetSelection" component={PetSelectionWithPet} options={{ title: "Select a Pet" }} />

      {/* Pets */}
      <Stack.Screen name="AddPet" component={AddPetScreen} options={{ title: "Add Pet" }} />
      <Stack.Screen name="PetDetails" component={PetDetailsScreen} options={{ title: "Pet" }} />
      <Stack.Screen name="PetPhotos" component={PetPhotosScreen} options={{ title: "Photos" }} />
      <Stack.Screen name="PetList" component={PetListScreen} options={{ title: "Pets" }} />
      <Stack.Screen name="UsersPets" component={UsersPetsScreen} options={{ title: "Their Pets" }} />

      {/* Playdates */}
      <Stack.Screen name="MyPlaydates" component={MyPlaydatesScreen} options={{ title: "My Playdates" }} />
      <Stack.Screen name="PlaydateDetails" component={PlaydateDetailsScreen} options={{ title: "Playdate" }} />
      <Stack.Screen name="PlaydateHistory" component={PlaydateHistoryScreen} options={{ title: "History" }} />
      <Stack.Screen name="PlaydateRequest" component={PlaydateRequestScreen} options={{ title: "Request" }} />
      <Stack.Screen name="PlaydateCreated" component={PlaydateCreatedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PlaydateModification" component={PlaydateModificationScreen} options={{ title: "Modify" }} />
      <Stack.Screen name="PlaydateModificationConfirmation" component={PlaydateModificationConfirmationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PlaydateCancellationConfirmation" component={PlaydateCancellationConfirmationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PostPlaydateReview" component={PostPlaydateReviewScreen} options={{ title: "Leave a Review" }} />
      <Stack.Screen name="PotentialPlaydateLocation" component={PotentialPlaydateLocationScreen} options={{ title: "Location" }} />
      <Stack.Screen name="PotentialPlaydateLocations" component={PotentialPlaydateLocationsScreen} options={{ title: "Locations" }} />
      <Stack.Screen name="SchedulePlaydate" component={SchedulePlaydateWithPet} options={{ title: "Schedule" }} />
      <Stack.Screen name="UpcomingPlaydate" component={UpcomingPlaydateScreen} options={{ title: "Upcoming" }} />

      {/* Profile */}
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="AccountInformation" component={AccountInformationScreen} options={{ title: "Account" }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: "Change Password" }} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: "Favorites" }} />
      <Stack.Screen name="FriendRequests" component={FriendRequestsScreen} options={{ title: "Friend Requests" }} />
      <Stack.Screen name="FriendsList" component={FriendsListScreen} options={{ title: "Friends" }} />
      <Stack.Screen name="ReportUser" component={ReportUserScreen} options={{ title: "Report" }} />

      {/* Settings */}
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
      <Stack.Screen name="AboutApp" component={AboutAppScreen} options={{ title: "About" }} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: "Help & Support" }} />
      <Stack.Screen name="LegalPolicies" component={LegalPoliciesScreen} options={{ title: "Legal" }} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} options={{ title: "Privacy" }} />
      <Stack.Screen name="BlockedAccounts" component={BlockedAccountsScreen} options={{ title: "Blocked Accounts" }} />
      <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} options={{ title: "Security" }} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ title: "Payment Methods" }} />
      <Stack.Screen name="AddPaymentMethod" component={AddPaymentMethodScreen} options={{ title: "Add Payment" }} />
      <Stack.Screen name="ChoosePlan" component={ChoosePlanScreen} options={{ title: "Choose a Plan" }} />
      <Stack.Screen name="SubscriptionConfirmation" component={SubscriptionConfirmationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SubscriptionHistory" component={SubscriptionHistoryScreen} options={{ title: "Subscription History" }} />
      <Stack.Screen name="SubscriptionManagement" component={SubscriptionManagementScreen} options={{ title: "Subscription" }} />

      {/* Misc */}
      <Stack.Screen name="Articles" component={ArticlesScreen} options={{ title: "Articles" }} />
      <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} options={{ title: "Article" }} />
      <Stack.Screen name="Map" component={MapWithPet} options={{ title: "Nearby" }} />
    </Stack.Navigator>
  );
}
