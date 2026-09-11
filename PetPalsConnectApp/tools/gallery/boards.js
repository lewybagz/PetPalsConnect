import React from "react";
import { View } from "react-native";

import DiscoverScreen from "../../src/screens/swipe/DiscoverScreen";
import HomeScreen from "../../src/screens/bottomTab/HomeScreen";
import ChatsScreen from "../../src/screens/chat/ChatsScreen";
import ReportUserScreen from "../../src/screens/profile/ReportUserScreen";
import BlockedAccountsScreen from "../../src/screens/settings/BlockedAccountsScreen";
import PetPhotosScreen from "../../src/screens/pets/PetPhotosScreen";
import PetHealthScreen from "../../src/screens/pets/PetHealthScreen";
import SettingsScreen from "../../src/screens/settings/SettingsScreen";
import NotificationsScreen from "../../src/screens/bottomTab/NotificationsScreen";
import NotificationPreferencesScreen from "../../src/screens/settings/NotificationPreferencesScreen";
import PrivacySettingsScreen from "../../src/screens/settings/PrivacySettingsScreen";
import DiscoveryPreferencesScreen from "../../src/screens/settings/DiscoveryPreferencesScreen";
import DisplaySettingsScreen from "../../src/screens/settings/DisplaySettingsScreen";
import SecuritySettingsScreen from "../../src/screens/settings/SecuritySettingsScreen";
import HelpSupportScreen from "../../src/screens/settings/HelpSupportScreen";
import PostPlaydateReviewScreen from "../../src/screens/playdate/PostPlaydateReviewScreen";
import MapScreen from "../../src/screens/swipe/MapScreen";
import SchedulePlaydateScreen from "../../src/screens/playdate/SchedulePlaydateScreen";
import AccountSuspendedScreen from "../../src/screens/auth/AccountSuspendedScreen";
import WaitlistScreen from "../../src/screens/auth/WaitlistScreen";
import FriendsListScreen from "../../src/screens/profile/FriendsListScreen";
import FriendRequestsCard from "../../src/components/FriendRequestsCard";
import MoreScreen from "../../src/screens/bottomTab/MoreScreen";
import PotentialPlaydateLocationScreen from "../../src/screens/playdate/PotentialPlaydateLocationScreen";
import PlaydateDetailsScreen from "../../src/screens/playdate/PlaydateDetailsScreen";
import ArticlesScreen from "../../src/screens/misc/ArticlesScreen";
import ArticleDetailScreen from "../../src/screens/misc/ArticleDetailScreen";
import {
  ARTICLE,
  ARTICLES,
  CANDIDATES,
  CARE_PICKS,
  CARE_PLACES,
  FRIEND_REQUESTS,
  HEALTH,
  MY_PET,
  ROUTES,
  SETTINGS,
  pending,
} from "./fixtures";

/**
 * What the gallery can render, and the fixtures each board needs.
 *
 * A board is a real screen plus the API responses that put it in the state
 * worth looking at - a loading skeleton, an empty list, a full deck. Those
 * states are the ones a screenshot is actually for: the happy path is easy to
 * imagine and the others are where the design either holds or does not.
 */

/** Screens take navigation as a prop; nothing here navigates anywhere. */
const navigation = {
  navigate: () => {},
  goBack: () => {},
  setOptions: () => {},
  addListener: () => () => {},
  dispatch: () => {},
};

export const BOARDS = [
  {
    id: "primitives",
    label: "Primitives",
    routes: ROUTES,
    render: () => null, // Rendered by the gallery itself.
  },
  {
    id: "discover",
    label: "Discover",
    routes: ROUTES,
    render: () => <DiscoverScreen navigation={navigation} />,
  },
  {
    id: "discover-preview",
    label: "Discover - browsing without a pet",
    routes: {
      ...ROUTES,
      "/api/petmatches/discover": {
        pet: null,
        preview: true,
        threshold: 45,
        range: 25,
        locationKnown: true,
        candidates: CANDIDATES.map((candidate) => ({
          ...candidate,
          score: null,
          breakdown: null,
        })),
      },
    },
    render: () => <DiscoverScreen navigation={navigation} />,
  },
  {
    id: "discover-swipe",
    label: "Discover - mid-throw",
    routes: ROUTES,
    // Seeded past the decision threshold, so the LIKE stamp is at full
    // strength and the card is at its maximum lean. That is the exact frame
    // the gesture promises, and the one nothing else can show.
    render: () => <DiscoverScreen navigation={navigation} previewTranslateX={140} />,
  },
  {
    id: "discover-swipe-pass",
    label: "Discover - mid-throw, passing",
    routes: ROUTES,
    render: () => <DiscoverScreen navigation={navigation} previewTranslateX={-140} />,
  },
  {
    id: "discover-loading",
    label: "Discover - skeleton",
    routes: { ...ROUTES, "/api/petmatches/discover": pending },
    render: () => <DiscoverScreen navigation={navigation} />,
  },
  {
    id: "discover-empty",
    label: "Discover - nobody left",
    routes: {
      ...ROUTES,
      "/api/petmatches/discover": {
        pet: MY_PET,
        preview: false,
        threshold: 45,
        range: 25,
        locationKnown: false,
        candidates: [],
      },
    },
    render: () => <DiscoverScreen navigation={navigation} />,
  },
  {
    id: "home",
    label: "Home",
    routes: ROUTES,
    render: () => (
      <HomeScreen
        navigation={navigation}
        route={{ params: {} }}
        // Home is the first screen a new account sees, so its tour opens over
        // it unasked. That is the point of the tour and the wrong thing for a
        // board about the screen underneath.
        walkthroughAutoStart={false}
      />
    ),
  },
  {
    id: "care-hub",
    label: "Pet care hub",
    routes: ROUTES,
    // Two pets, so the pet picker is on screen, and the cat carries the
    // `seeAVet` callout - the state where the hub has to look like care rather
    // than like an error.
    render: () => (
      <MoreScreen
        navigation={navigation}
        route={{ params: {} }}
        walkthroughAutoStart={false}
      />
    ),
  },
  {
    id: "care-hub-empty",
    label: "Pet care hub - nothing imported yet",
    // What a fresh deployment looks like: no pets, no places, and the
    // emergency numbers still there, which is the whole reason they are a
    // table in the source rather than rows in a collection.
    routes: {
      ...ROUTES,
      "/api/petcare/picks": { ...CARE_PICKS, pets: [] },
      "/api/locations/care": {
        ...CARE_PLACES,
        places: [],
        saved: [],
        locationKnown: false,
      },
    },
    render: () => (
      <MoreScreen
        navigation={navigation}
        route={{ params: {} }}
        walkthroughAutoStart={false}
      />
    ),
  },
  {
    id: "care-hub-places",
    label: "Pet care hub - saved places and what's nearby",
    routes: ROUTES,
    // The same screen, scrolled past the picks. Everything below the second
    // section was invisible to this tool until now, which is most of it.
    scrollY: 900,
    render: () => (
      <MoreScreen
        navigation={navigation}
        route={{ params: {} }}
        walkthroughAutoStart={false}
      />
    ),
  },
  {
    id: "place",
    label: "A place - vet with contact details",
    // The screen every card in the hub opens, and the one that had never been
    // photographed: it fetched a duplicate endpoint with no contact details,
    // so its whole reason to exist was missing.
    routes: {
      ...ROUTES,
      "/api/locations/loc-1": {
        _id: "loc-1",
        name: "Averill Veterinary Clinic",
        address: "1200 Averill Street",
        categories: ["vet"],
        phone: "(415) 555-0142",
        website: "https://example.test/averill",
        openingHours: [
          "Monday: 8:00 AM – 6:00 PM",
          "Tuesday: 8:00 AM – 6:00 PM",
          "Wednesday: 8:00 AM – 6:00 PM",
          "Thursday: 8:00 AM – 6:00 PM",
          "Friday: 8:00 AM – 5:00 PM",
          "Saturday: 9:00 AM – 1:00 PM",
          "Sunday: Closed",
        ],
        geoLocation: { type: "Point", coordinates: [-122.4382, 37.7925] },
      },
      "/api/reviews/location/loc-1": [],
    },
    render: () => (
      <PotentialPlaydateLocationScreen
        navigation={navigation}
        route={{ params: { locationId: "loc-1" } }}
      />
    ),
  },
  {
    id: "home-walkthrough",
    label: "Home - the first-run tour",
    routes: ROUTES,
    // The overlay is the one part of the walkthrough that cannot be checked by
    // reading or by a jest render: there is no layout engine under jest, so
    // `measureInWindow` reports nothing and every step falls back to a plain
    // scrim. In a browser it measures for real, so this is where the ring
    // around the target and the tooltip beside it actually get looked at.
    render: () => (
      <HomeScreen
        navigation={navigation}
        route={{ params: {} }}
        walkthroughAutoStart
      />
    ),
  },
  {
    id: "home-loading",
    label: "Home - skeleton",
    routes: {
      "/api/pets/latest": pending,
      "/api/favorites": pending,
      "/api/articles/recent": pending,
    },
    render: () => (
      <HomeScreen
        navigation={navigation}
        route={{ params: {} }}
        walkthroughAutoStart={false}
      />
    ),
  },
  {
    id: "schedule-playdate",
    label: "Schedule - arriving from a pet",
    routes: ROUTES,
    // The pet is known, so the screen asks only where and when. The other
    // entry point is the same screen with the opposite half filled in, which
    // is the whole point of consolidating the two flows.
    render: () => (
      <SchedulePlaydateScreen
        navigation={navigation}
        route={{ params: { pet: CANDIDATES[0].pet } }}
      />
    ),
  },
  {
    id: "playdate-invitation",
    label: "Playdate - an invitation to answer",
    // The state this screen could not reach: an invitation could not be
    // accepted or declined from anywhere in the app, because the only screen
    // offering the pair was one nothing navigated to.
    routes: {
      ...ROUTES,
      "/api/playdates/pd-1": {
        _id: "pd-1",
        status: "pending",
        creator: { _id: "user-them", username: "alex" },
        date: "2026-10-01T10:00:00.000Z",
        location: { _id: "loc-1", name: "Dolores Park" },
        notes: "By the tennis courts",
        participants: [{ _id: "user-me", username: "sam" }],
        petsInvolved: [CANDIDATES[0].pet, MY_PET],
        reviews: [],
      },
    },
    render: () => (
      <PlaydateDetailsScreen
        navigation={navigation}
        route={{ params: { playdateId: "pd-1" } }}
      />
    ),
  },
  {
    id: "schedule-playdate-from-place",
    label: "Schedule - arriving from a place",
    routes: ROUTES,
    render: () => (
      <SchedulePlaydateScreen
        navigation={navigation}
        route={{ params: { locationId: "loc-1" } }}
      />
    ),
  },
  {
    id: "waitlist",
    label: "Outside the launch area",
    routes: { ...ROUTES, "/api/waitlist/me": { joined: false, since: null } },
    // The first screen somebody outside Arizona sees. It has to read as "not
    // yet", never as "no".
    render: () => <WaitlistScreen />,
  },
  {
    id: "account-suspended",
    label: "Account under review",
    routes: ROUTES,
    // The one screen in the app somebody sees on their worst day with it. Worth
    // looking at rather than only reading: the tone has to be neutral and the
    // way out has to be obvious.
    render: () => <AccountSuspendedScreen />,
  },
  {
    id: "chats",
    label: "Chats",
    routes: ROUTES,
    render: () => <ChatsScreen navigation={navigation} />,
  },
  {
    id: "chats-empty",
    label: "Chats - empty",
    routes: { ...ROUTES, "/api/chats": [] },
    render: () => <ChatsScreen navigation={navigation} />,
  },
  {
    id: "chats-loading",
    label: "Chats - skeleton",
    routes: { ...ROUTES, "/api/chats": pending },
    render: () => <ChatsScreen navigation={navigation} />,
  },
  {
    id: "articles",
    label: "Articles",
    routes: ROUTES,
    render: () => <ArticlesScreen navigation={navigation} />,
  },
  {
    // One topic selected: the chip row is the index over sixty articles, and
    // the selected state is the only part of it a contrast test cannot check.
    id: "articles-filtered",
    label: "Articles - filtered by topic",
    routes: { ...ROUTES, "/api/articles/latest": ARTICLES.slice(0, 2) },
    render: () => <ArticlesScreen navigation={navigation} />,
  },
  {
    id: "articles-loading",
    label: "Articles - skeleton",
    routes: { ...ROUTES, "/api/articles/latest": pending },
    render: () => <ArticlesScreen navigation={navigation} />,
  },
  {
    id: "articles-empty",
    label: "Articles - empty",
    routes: { ...ROUTES, "/api/articles/latest": [], "/api/articles/topics": [] },
    render: () => <ArticlesScreen navigation={navigation} />,
  },
  {
    // The body renders as plain text split on blank lines, and the citation
    // list is the part that makes the health content answerable - both are
    // only really checkable by looking at them.
    id: "article-detail",
    label: "Article",
    routes: { ...ROUTES, [`/api/articles/${ARTICLE._id}`]: ARTICLE },
    render: () => (
      <ArticleDetailScreen route={{ params: { articleId: ARTICLE._id } }} />
    ),
  },
  {
    // The pal is the pet; the owner is the line underneath. This list used to
    // be usernames with an arbitrary pet from the household as the caption.
    id: "friends",
    label: "Pals",
    routes: ROUTES,
    render: () => <FriendsListScreen navigation={navigation} />,
  },
  {
    id: "friends-empty",
    label: "Pals - empty",
    routes: { ...ROUTES, "/api/friends": [] },
    render: () => <FriendsListScreen navigation={navigation} />,
  },
  {
    // One request received and one sent. `isSender` compared a pet id against
    // a user id, so it was always false and both rendered as received - with
    // Accept and Decline under your own outgoing request.
    id: "friend-requests",
    label: "Pal requests",
    routes: ROUTES,
    render: () => (
      <View style={{ padding: 16 }}>
        {FRIEND_REQUESTS.map((request) => (
          <FriendRequestsCard
            key={request._id}
            friendRequest={request}
            onAccept={() => {}}
            onDecline={() => {}}
          />
        ))}
      </View>
    ),
  },
  {
    id: "report",
    label: "Report",
    routes: ROUTES,
    render: () => (
      <ReportUserScreen
        navigation={navigation}
        route={{ params: { userId: "user-1", name: "Bo's owner" } }}
      />
    ),
  },
  {
    id: "blocked",
    label: "Blocked accounts",
    routes: ROUTES,
    render: () => <BlockedAccountsScreen />,
  },
  {
    id: "blocked-empty",
    label: "Blocked accounts - empty",
    routes: { ...ROUTES, "/api/blocklists": [] },
    render: () => <BlockedAccountsScreen />,
  },
  {
    id: "photos",
    label: "Pet photos",
    routes: ROUTES,
    render: () => (
      <PetPhotosScreen navigation={navigation} route={{ params: { pet: MY_PET } }} />
    ),
  },
  {
    id: "pet-health",
    label: "Vaccination records",
    routes: ROUTES,
    render: () => (
      <PetHealthScreen navigation={navigation} route={{ params: { pet: MY_PET } }} />
    ),
  },
  {
    id: "pet-health-empty",
    label: "Vaccination records - empty",
    routes: { ...ROUTES, [`/api/pets/${MY_PET._id}/health`]: { ...HEALTH, status: "unknown", records: [] } },
    render: () => (
      <PetHealthScreen navigation={navigation} route={{ params: { pet: MY_PET } }} />
    ),
  },
  {
    id: "map",
    label: "Map",
    routes: ROUTES,
    // react-native-maps has no web build, so `tools/web-stubs/maps.js` stands
    // in: the pins and the sheet render, the tiles do not. It is the layer the
    // gallery cannot show, and the one thing a device is genuinely needed for.
    render: () => <MapScreen navigation={navigation} />,
  },
  {
    id: "notifications",
    label: "Notifications",
    routes: ROUTES,
    render: () => <NotificationsScreen navigation={navigation} />,
  },
  {
    id: "notifications-empty",
    label: "Notifications - empty",
    routes: { ...ROUTES, "/api/notifications": [] },
    render: () => <NotificationsScreen navigation={navigation} />,
  },
  {
    id: "notifications-loading",
    label: "Notifications - skeleton",
    routes: { ...ROUTES, "/api/notifications": pending },
    render: () => <NotificationsScreen navigation={navigation} />,
  },
  {
    id: "notification-preferences",
    label: "Notification preferences",
    routes: ROUTES,
    render: () => <NotificationPreferencesScreen />,
  },
  {
    id: "support",
    label: "Help & support",
    routes: ROUTES,
    render: () => <HelpSupportScreen />,
  },
  {
    id: "review",
    label: "Post-playdate review",
    routes: ROUTES,
    render: () => (
      <PostPlaydateReviewScreen
        navigation={navigation}
        route={{
          params: {
            playdateId: "playdate-1",
            pet: { _id: "pet-2", name: "Bo", breed: "Border Collie" },
            playdate: { _id: "playdate-1", location: "loc-1" },
          },
        }}
      />
    ),
  },
  {
    id: "settings",
    label: "Settings",
    routes: ROUTES,
    render: () => <SettingsScreen navigation={navigation} />,
  },
  {
    id: "settings-privacy",
    label: "Privacy",
    routes: ROUTES,
    render: () => <PrivacySettingsScreen />,
  },
  {
    id: "settings-discovery",
    label: "Discovery preferences",
    routes: ROUTES,
    render: () => <DiscoveryPreferencesScreen />,
  },
  {
    id: "settings-discovery-metric",
    label: "Discovery preferences - kilometres and kilograms",
    // The whole point of the unit preference is that it changes what a screen
    // reads, and a slider labelled in the wrong unit is the sort of thing only
    // a picture catches.
    settings: { ...SETTINGS, units: { distance: "km", weight: "kg" } },
    routes: ROUTES,
    render: () => <DiscoveryPreferencesScreen />,
  },
  {
    id: "settings-display",
    label: "Appearance",
    routes: ROUTES,
    render: () => <DisplaySettingsScreen />,
  },
  {
    id: "settings-display-larger-text",
    label: "Appearance - larger text",
    // Pinned rather than tapped, so this and the board above are two pages
    // rather than a race with a cache read - the same reason the walkthrough
    // has `walkthroughAutoStart`.
    preferences: { reduceMotion: false, largerText: true, showMatchScore: true },
    routes: ROUTES,
    render: () => <DisplaySettingsScreen />,
  },
  {
    id: "settings-security",
    label: "Sign-in and security",
    routes: ROUTES,
    // The web auth stub keeps `currentUser` null so no screen can claim a
    // session it does not have, which would leave this board showing only the
    // "no password on this account" branch. The account is passed in instead.
    render: () => (
      <SecuritySettingsScreen
        user={{
          email: "alex@example.com",
          providerData: [{ providerId: "password" }],
        }}
      />
    ),
  },
  {
    id: "settings-security-google",
    label: "Sign-in and security - no password to change",
    routes: ROUTES,
    render: () => (
      <SecuritySettingsScreen
        user={{
          email: "alex@example.com",
          providerData: [{ providerId: "google.com" }],
        }}
      />
    ),
  },
];

export const boardById = (id) => BOARDS.find((board) => board.id === id);
