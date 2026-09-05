import React from "react";
import { Text } from "react-native";
import { render, screen, waitFor, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as firebaseAuth from "@react-native-firebase/auth";

import { AuthSessionProvider, useAuthSession } from "./AuthSessionContext";
import api from "../api/axios";
import { sessionInvalidated } from "../api/sessionEvents";

jest.mock("../api/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

/**
 * The session state machine is what decides which navigation tree mounts, so
 * these cover the transitions directly rather than through the navigator.
 */

const Probe = () => {
  const { status, hasPet, profile } = useAuthSession();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="hasPet">{String(hasPet)}</Text>
      <Text testID="username">{profile?.username ?? "-"}</Text>
    </>
  );
};

const renderSession = () =>
  render(
    <AuthSessionProvider>
      <Probe />
    </AuthSessionProvider>
  );

const withPet = {
  _id: "user-1",
  username: "petlover",
  pets: [{ _id: "pet-1", name: "Rex" }],
};
const withoutPet = { _id: "user-2", username: "newbie", pets: [] };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  firebaseAuth.__setCurrentUser(null);
});

describe("AuthSessionContext", () => {
  it("reports signedOut when there is no Firebase user", async () => {
    renderSession();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signedOut"));
    expect(api.get).not.toHaveBeenCalled();
  });

  it("reports needsProfile when the API says the profile does not exist", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockRejectedValue({ response: { status: 404 } });

    renderSession();

    // 404 is the expected "signed up but never finished" case, not a failure.
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("needsProfile"));
  });

  it("reports needsPet when a profile exists with no pets", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: withoutPet });

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("needsPet"));
    expect(screen.getByTestId("hasPet")).toHaveTextContent("false");
  });

  it("reports ready when the profile has a pet", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: withPet });

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("hasPet")).toHaveTextContent("true");
    expect(screen.getByTestId("username")).toHaveTextContent("petlover");
  });

  it("respects a stored skip and lets a pet-less user in", async () => {
    // A skip that forgets itself would just be a slower wall.
    await AsyncStorage.setItem(
      `@petpals/pet-setup-skipped:${withoutPet._id}`,
      JSON.stringify(true)
    );
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: withoutPet });

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    // Still no pet - screens must handle that, which is what hasPet is for.
    expect(screen.getByTestId("hasPet")).toHaveTextContent("false");
  });

  it("ignores a stale skip once the user actually has a pet", async () => {
    await AsyncStorage.setItem(
      `@petpals/pet-setup-skipped:${withPet._id}`,
      JSON.stringify(true)
    );
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: withPet });

    renderSession();

    await waitFor(() => expect(screen.getByTestId("hasPet")).toHaveTextContent("true"));
  });

  it("falls back to the cached profile when the API is unreachable", async () => {
    await AsyncStorage.setItem("@petpals/user-data", JSON.stringify(withPet));
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockRejectedValue({ message: "Network Error" });

    renderSession();

    // The app should still open rather than trapping the user on a spinner.
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
    expect(screen.getByTestId("username")).toHaveTextContent("petlover");
  });

  it("reports error only when the API fails and nothing is cached", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockRejectedValue({ message: "Network Error" });

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
  });

  it("a cached profile with no pets still lands on the pet step", async () => {
    await AsyncStorage.setItem("@petpals/user-data", JSON.stringify(withoutPet));
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockRejectedValue({ message: "Network Error" });

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("needsPet"));
  });

  it("moves to ready when a pet is created", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: withoutPet });
    api.post.mockResolvedValue({ data: { pet: { _id: "pet-9" } } });

    let session;
    const Capture = () => {
      session = useAuthSession();
      return <Text testID="status">{session.status}</Text>;
    };

    render(
      <AuthSessionProvider>
        <Capture />
      </AuthSessionProvider>
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("needsPet"));

    // The server owns the profile link, so the session re-reads rather than
    // patching local state.
    api.get.mockResolvedValue({ data: withPet });
    await act(async () => {
      await session.createPet({ name: "Rex" });
    });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));
  });

  it("signing out returns to signedOut and clears the cached profile", async () => {
    await AsyncStorage.setItem("@petpals/user-data", JSON.stringify(withPet));
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: withPet });

    let session;
    const Capture = () => {
      session = useAuthSession();
      return <Text testID="status">{session.status}</Text>;
    };

    render(
      <AuthSessionProvider>
        <Capture />
      </AuthSessionProvider>
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"));

    await act(async () => {
      await session.signOut();
    });

    expect(await AsyncStorage.getItem("@petpals/user-data")).toBeNull();
  });

  // Not covered: the "used outside the provider" guard. React 19 routes render
  // errors through its own channel rather than rethrowing synchronously, and
  // asserting on it reliably costs more than the two-line guard is worth.
});

/**
 * Suspension.
 *
 * The API refuses a suspended account nearly every route, so this has to be a
 * session state rather than an error: without it the app renders its normal
 * tree and every screen becomes a failed request and a toast that says nothing
 * about why.
 */
describe("a suspended account", () => {
  const suspended = {
    _id: "user-3",
    username: "under-review",
    pets: [{ _id: "pet-9", name: "Bo" }],
    suspended: true,
  };

  it("reports suspended rather than ready", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: suspended });

    renderSession();

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("suspended")
    );
  });

  it("wins over having a pet, so it cannot be skipped past", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: { ...suspended, pets: [] } });

    renderSession();

    // With no pet this would otherwise be `needsPet`, which would put the user
    // in onboarding and then into an app that refuses them.
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("suspended")
    );
  });

  it("clears once the account is reinstated", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: suspended });
    renderSession();
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("suspended")
    );

    api.get.mockResolvedValue({ data: { ...suspended, suspended: false } });
    await act(async () => {
      firebaseAuth.__emitAuthState({ uid: "abc" });
    });

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready")
    );
  });

  it("moves there when the API says so mid-session", async () => {
    firebaseAuth.__setCurrentUser({ uid: "abc" });
    api.get.mockResolvedValue({ data: withPet });
    renderSession();
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready")
    );

    // Being suspended while the app is open is the common case - a third
    // report lands and every request starts coming back 403. The API client
    // announces it; re-reading the profile is what decides the new state.
    api.get.mockResolvedValue({ data: suspended });
    await act(async () => {
      sessionInvalidated("suspended");
    });

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("suspended")
    );
  });
});
