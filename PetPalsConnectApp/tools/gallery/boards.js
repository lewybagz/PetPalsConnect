import React from "react";

import DiscoverScreen from "../../src/screens/swipe/DiscoverScreen";
import HomeScreen from "../../src/screens/bottomTab/HomeScreen";
import ChatsScreen from "../../src/screens/chat/ChatsScreen";
import ReportUserScreen from "../../src/screens/profile/ReportUserScreen";
import BlockedAccountsScreen from "../../src/screens/settings/BlockedAccountsScreen";
import PetPhotosScreen from "../../src/screens/pets/PetPhotosScreen";
import SettingsScreen from "../../src/screens/settings/SettingsScreen";
import MapScreen from "../../src/screens/swipe/MapScreen";
import { CANDIDATES, MY_PET, ROUTES, pending } from "./fixtures";

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
      <HomeScreen navigation={navigation} route={{ params: {} }} start={() => {}} />
    ),
  },
  {
    id: "home-loading",
    label: "Home - skeleton",
    routes: {
      "/api/pets/latest": pending,
      "/api/favorites": pending,
      "/api/articles/latest": pending,
    },
    render: () => (
      <HomeScreen navigation={navigation} route={{ params: {} }} start={() => {}} />
    ),
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
    id: "map",
    label: "Map",
    routes: ROUTES,
    // react-native-maps has no web build, so `tools/web-stubs/maps.js` stands
    // in: the pins and the sheet render, the tiles do not. It is the layer the
    // gallery cannot show, and the one thing a device is genuinely needed for.
    render: () => <MapScreen navigation={navigation} />,
  },
  {
    id: "settings",
    label: "Settings",
    routes: ROUTES,
    render: () => <SettingsScreen navigation={navigation} />,
  },
];

export const boardById = (id) => BOARDS.find((board) => board.id === id);
