import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Provider as ReduxProvider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";

import store from "../../src/redux/store";
import api from "../../src/api/axios";
import { AppThemeProvider, useTokens } from "../../src/context/AppThemeContext";
import { AuthSessionContext, AuthStatus } from "../../src/context/AuthSessionContext";
import {
  Button,
  Card,
  EmptyState,
  Skeleton,
  Text,
  ToastProvider,
  Toggle,
  useToast,
} from "../../src/components/ui";
import OnboardingProgress from "../../src/components/ui/OnboardingProgress";
import { useAppFonts } from "../../src/styles/fonts";
import { BOARDS, boardById } from "./boards";
import { MY_PET, SECOND_PET, pending } from "./fixtures";

/**
 * The real screens, on a page, so they can be looked at.
 *
 * Not a test and not a shipped screen: `index.js` reaches this only when
 * `EXPO_PUBLIC_GALLERY=1`, which `npm run gallery` sets and nothing else does.
 * These are the actual screen components with the actual design tokens - a
 * hand-drawn mock would prove nothing about the code.
 *
 * It exists because the design work is the one part of this project that cannot
 * be checked by reading. The palettes are contrast-tested in `tokens.test.js`
 * and the primitives are asserted in `ui.test.js`, but whether the result looks
 * like an app is a question only a picture answers - and there is no Android
 * SDK, no KVM and no macOS on the machine this is built from.
 *
 * One board per page load, chosen by `?board=&theme=`, so each screenshot is a
 * phone-sized screen rather than a thumbnail in a grid.
 */

/**
 * Answers every request from the board's fixtures.
 *
 * `adapter` short-circuits before the request leaves, so this needs no server
 * and cannot hang on a timeout - which matters because a screenshot of a
 * spinner is not a screenshot of a screen.
 */
const useFixtureApi = (routes) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const paths = Object.keys(routes).sort((a, b) => b.length - a.length);

    const id = api.interceptors.request.use((config) => {
      const url = config.url ?? "";
      const match = paths.find((path) => url.startsWith(path));

      const body = match ? routes[match] : {};

      config.adapter = async () => {
        // A board can ask for a request that never settles, which is how the
        // loading states get photographed at all.
        if (body === pending) return new Promise(() => {});

        return {
          data: body,
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };
      return config;
    });

    setReady(true);
    return () => api.interceptors.request.eject(id);
  }, [routes]);

  return ready;
};

/** The primitives on one board, which no single screen shows all of. */
const Primitives = () => {
  const tokens = useTokens();
  const toast = useToast();
  const [on, setOn] = useState(true);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      style={{ backgroundColor: tokens.bg }}
    >
      <Text variant="display">Display</Text>
      <Text variant="title" style={{ marginTop: 8 }}>
        Title
      </Text>
      <Text style={{ marginTop: 8 }}>
        Body copy stays on the system face - what the OS hints best, and what
        Dynamic Type is tuned for.
      </Text>
      <Text variant="label" tone="muted" style={{ marginTop: 8 }}>
        Label
      </Text>
      <Text variant="caption" tone="faint" style={{ marginTop: 4 }}>
        Caption
      </Text>

      <View style={{ height: 24 }} />
      <OnboardingProgress step={2} />

      <Button title="Primary" onPress={() => toast.success("Playdate scheduled")} />
      <View style={{ height: 8 }} />
      <Button title="Secondary" variant="secondary" onPress={() => {}} />
      <View style={{ height: 8 }} />
      <Button title="Soft" variant="soft" onPress={() => {}} />
      <View style={{ height: 8 }} />
      <Button title="Danger" variant="danger" onPress={() => {}} />
      <View style={{ height: 8 }} />
      <Button title="Loading" loading onPress={() => {}} />

      <View style={{ height: 16 }} />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text variant="title">Card</Text>
            <Text tone="muted" style={{ marginTop: 4 }}>
              A border rather than a shadow, which vanishes on a dark ground.
            </Text>
          </View>
          <Toggle value={on} onValueChange={setOn} accessibilityLabel="Example" />
        </View>
      </Card>

      <View style={{ height: 16 }} />
      <Skeleton width="70%" height={18} />
      <View style={{ height: 8 }} />
      <Skeleton width="45%" height={18} />

      <View style={{ height: 8 }} />
      <View style={{ height: 260 }}>
        <EmptyState
          title="Nothing here yet"
          message="One visual language for every empty list in the app."
          actionLabel="Refresh"
          onAction={() => {}}
        />
      </View>
    </ScrollView>
  );
};

const Surface = ({ board }) => {
  const tokens = useTokens();
  const ready = useFixtureApi(board.routes);

  if (!ready) return null;

  return (
    <View
      testID="board"
      style={{ flex: 1, backgroundColor: tokens.bg }}
    >
      {board.id === "primitives" ? <Primitives /> : board.render()}
    </View>
  );
};

/**
 * A signed-in session, without Firebase.
 *
 * Settings and a few other screens read the session directly. Standing up the
 * real provider on web would mean a Firebase stub that pretends to authenticate,
 * which is the one thing the stubs deliberately do not do - so the gallery
 * supplies the value instead, and it is obvious from here that it is a fixture.
 */
const SESSION = {
  status: AuthStatus.ready,
  error: null,
  userId: "user-me",
  hasPet: true,
  profile: {
    _id: "user-me",
    username: "sam",
    email: "sam@example.test",
    // Populated, the way /api/users/me returns them - a screen that offers a
    // choice of your pets needs their names.
    pets: [MY_PET, SECOND_PET],
  },
  refresh: async () => {},
  signOut: async () => {},
  createPet: async () => {},
  skipPetSetup: () => {},
};

/** `?board=discover&theme=dark`, defaulting to the first board in light. */
const params = () => {
  const search =
    typeof window === "undefined" ? "" : window.location.search ?? "";
  const query = new URLSearchParams(search);
  return {
    board: boardById(query.get("board")) ?? BOARDS[0],
    theme: query.get("theme") === "dark" ? "dark" : "light",
  };
};

export default function Gallery() {
  const fontsSettled = useAppFonts();
  const { board, theme } = params();

  // The fonts gate the app for the same reason they gate `App.js`: a first
  // frame in the system face reflowing into Nunito is not what ships.
  if (!fontsSettled) return null;

  return (
    <ReduxProvider store={store}>
      <AppThemeProvider initialPreference={theme}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ToastProvider>
            <AuthSessionContext.Provider value={SESSION}>
              <NavigationContainer>
                <Surface board={board} />
              </NavigationContainer>
            </AuthSessionContext.Provider>
          </ToastProvider>
        </SafeAreaProvider>
        </GestureHandlerRootView>
      </AppThemeProvider>
    </ReduxProvider>
  );
}
