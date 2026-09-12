import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import PetTrackingScreen from "./PetTrackingScreen";
import { ToastProvider } from "../../components/ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import {
  claimDevice,
  fetchPetPositions,
  fetchShares,
  fetchTrackingStatus,
  removeDevice,
  sharePet,
  unsharePet,
} from "../../api/tracking";
import { fetchFriends } from "../../api/friends";

jest.mock("../../api/tracking", () => ({
  ...jest.requireActual("../../api/tracking"),
  fetchTrackingStatus: jest.fn(),
  fetchPetPositions: jest.fn(),
  fetchShares: jest.fn(),
  claimDevice: jest.fn(),
  removeDevice: jest.fn(),
  sharePet: jest.fn(),
  unsharePet: jest.fn(),
}));
jest.mock("../../api/friends", () => ({
  ...jest.requireActual("../../api/friends"),
  fetchFriends: jest.fn(),
}));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => {}) }));
jest.mock("react-native-maps", () => {
  const { View, Pressable } = require("react-native");
  const MockMapView = ({ children, ...rest }) => <View {...rest}>{children}</View>;
  const MockMarker = ({ children, ...rest }) => <Pressable {...rest}>{children}</Pressable>;
  const MockPolyline = (props) => <View {...props} />;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Polyline: MockPolyline,
    PROVIDER_GOOGLE: "google",
    PROVIDER_DEFAULT: undefined,
  };
});

/**
 * The collar screen.
 *
 * What has to be true: the age of a position is on screen every time; no
 * position is an empty state and never a marker at 0,0; a friend sees the
 * position and none of the owner's controls; a "not yours" answer is the
 * same quiet screen as "no collar"; and the owner can register one and share
 * it for a chosen time.
 */

const navigation = { navigate: jest.fn() };
const wrap = (node) => <ToastProvider>{node}</ToastProvider>;

const ME = "u-me";
const FRIEND = { _id: "u-friend", username: "alex" };
const MY_PET = { _id: "pet-1", name: "Bo", species: "dog" };

const RECENT = new Date(Date.now() - 4 * 60_000).toISOString();
const OLD = new Date(Date.now() - 3 * 3_600_000).toISOString();

const positions = (overrides = {}) => ({
  pet: { _id: "pet-1", name: "Bo", photos: [] },
  owner: { _id: ME, username: "me" },
  device: { _id: "dev-1", serial: "PPC-000001", batteryPercent: 72, lastSeenAt: RECENT, status: "active" },
  latest: { latitude: 33.45, longitude: -112.07, accuracyMeters: 8, batteryPercent: 72, recordedAt: RECENT },
  trail: [
    { latitude: 33.449, longitude: -112.071, accuracyMeters: 8, batteryPercent: 73, recordedAt: OLD },
    { latitude: 33.45, longitude: -112.07, accuracyMeters: 8, batteryPercent: 72, recordedAt: RECENT },
  ],
  serverTime: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  useAuthSession.mockReturnValue({ userId: ME, profile: { _id: ME, pets: [MY_PET] } });
  fetchTrackingStatus.mockResolvedValue({ enabled: true, vendor: "generic", acceptsIngest: true });
  fetchPetPositions.mockResolvedValue(positions());
  fetchShares.mockResolvedValue({ given: [], received: [] });
  fetchFriends.mockResolvedValue([{ _id: "f1", user1: { _id: ME, username: "me" }, user2: FRIEND }]);
  claimDevice.mockResolvedValue({ device: { _id: "dev-1", serial: "PPC-000001" }, secret: "s3cr3t-key-value-xyz" });
  sharePet.mockResolvedValue({ _id: "s1", pet: "pet-1", viewer: FRIEND._id, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
  unsharePet.mockResolvedValue();
  removeDevice.mockResolvedValue();
});

const renderFor = (params) =>
  render(wrap(<PetTrackingScreen route={{ params }} navigation={navigation} />));

describe("PetTrackingScreen", () => {
  it("shows the owner the position, how old it is, the trail and their controls", async () => {
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking")).toBeTruthy());

    expect(screen.getByTestId("tracking-marker").props.coordinate).toEqual({ latitude: 33.45, longitude: -112.07 });
    expect(screen.getByTestId("tracking-trail").props.coordinates).toHaveLength(2);
    expect(screen.getByTestId("tracking-last-seen").props.children.join("")).toMatch(/Last seen 4 minutes ago/);
    expect(screen.getByText("72%")).toBeTruthy();
    expect(screen.getByTestId("tracking-sharing")).toBeTruthy();
    expect(screen.getByTestId("tracking-device")).toBeTruthy();
    expect(screen.getByText(/Not a safety device/)).toBeTruthy();
  });

  it("calls a position stale, in words, when the collar has gone quiet", async () => {
    fetchPetPositions.mockResolvedValue(positions({ latest: { ...positions().latest, recordedAt: OLD } }));
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking")).toBeTruthy());
    expect(screen.getByTestId("tracking-last-seen").props.children.join("")).toMatch(/3 hours ago/);
  });

  it("no position is an empty state, never a marker", async () => {
    fetchPetPositions.mockResolvedValue(positions({ latest: null, trail: [] }));
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking-no-position")).toBeTruthy());
    expect(screen.queryByTestId("tracking-marker")).toBeNull();
  });

  it("a friend sees the position and who shared it, and none of the owner's controls", async () => {
    useAuthSession.mockReturnValue({ userId: FRIEND._id, profile: { _id: FRIEND._id, pets: [] } });
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking")).toBeTruthy());

    expect(screen.getByText("Shared with you by @me")).toBeTruthy();
    expect(screen.queryByTestId("tracking-sharing")).toBeNull();
    expect(screen.queryByTestId("tracking-device")).toBeNull();
    expect(screen.queryByTestId("tracking-remove")).toBeNull();
  });

  it("'not yours to see' and 'no collar' are the same quiet screen for a non-owner", async () => {
    useAuthSession.mockReturnValue({ userId: "u-other", profile: { _id: "u-other", pets: [] } });
    fetchPetPositions.mockResolvedValue(null);
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking-unavailable")).toBeTruthy());
  });

  it("the owner of a pet with no collar registers one and sees the key exactly once", async () => {
    fetchPetPositions.mockResolvedValueOnce(null).mockResolvedValue(positions());
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking-claim")).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId("tracking-serial"), "ppc-000001");
    await fireEvent.press(screen.getByTestId("tracking-claim-button"));

    expect(claimDevice).toHaveBeenCalledWith("ppc-000001", "pet-1");
    // The claim succeeded, so the next read finds a collar and the screen
    // moves on to the position.
    await waitFor(() => expect(screen.getByTestId("tracking")).toBeTruthy());
  });

  it("shares with a friend for the chosen duration, and can stop", async () => {
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking-friend-u-friend")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("tracking-hours-4"));
    await fireEvent.press(screen.getByTestId("tracking-share-u-friend"));
    expect(sharePet).toHaveBeenCalledWith("pet-1", "u-friend", 4);

    await waitFor(() => expect(screen.getByText(/^Until /)).toBeTruthy());
    await fireEvent.press(screen.getByTestId("tracking-share-u-friend"));
    expect(unsharePet).toHaveBeenCalledWith("pet-1", "u-friend");
  });

  it("removing a collar asks first", async () => {
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking-remove")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("tracking-remove"));

    expect(removeDevice).not.toHaveBeenCalled();
    const [, , buttons] = Alert.alert.mock.calls.at(-1);
    expect(buttons.some((b) => b.style === "cancel")).toBe(true);
    await buttons.find((b) => b.text === "Remove").onPress();
    expect(removeDevice).toHaveBeenCalledWith("dev-1");
  });

  it("with no pet named, offers the owner's pets to choose from", async () => {
    await renderFor({});
    await waitFor(() => expect(screen.getByTestId("tracking-choose-pet")).toBeTruthy());
    expect(screen.getByTestId("tracking-pick-pet-1")).toBeTruthy();
  });

  it("says when the server does not track at all", async () => {
    fetchTrackingStatus.mockResolvedValue({ enabled: false, vendor: null, acceptsIngest: false });
    await renderFor({ petId: "pet-1" });
    await waitFor(() => expect(screen.getByTestId("tracking-disabled")).toBeTruthy());
  });
});
