import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import * as Location from "expo-location";

import SchedulePlaydateScreen from "./SchedulePlaydateScreen";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";
import { fetchUserPreferences } from "../../../services/UserService";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));
jest.mock("../../../services/UserService", () => ({
  fetchUserPreferences: jest.fn(),
}));
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("../../components/DateTimePickerComponent", () => "DateTimePicker");
// The real icon set loads its font asynchronously and setStates when it lands,
// which keeps firing after a test has finished and destabilises the next one.
jest.mock("@expo/vector-icons", () => ({ FontAwesome: "FontAwesome" }));

/**
 * The screen that turns a match into a plan.
 *
 * It read coordinates from `navigator.geolocation`, a browser API React Native
 * does not have, so the "not supported" branch ran every time: the location
 * list stayed empty and submitting dereferenced `selectedLocation._id` on null.
 */

const navigation = { navigate: jest.fn() };
const theirPet = { _id: "their-pet", name: "Bo", photos: [] };

const park = { _id: "loc-1", address: "12 Green Lane", description: "Dog park" };

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({
    profile: { _id: "me", pets: [{ _id: "my-pet" }] },
  });
  fetchUserPreferences.mockResolvedValue({ playdateRange: 5 });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
  Location.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 51.5, longitude: -0.1 },
  });
  api.get.mockResolvedValue({ data: [park] });
  api.post.mockResolvedValue({ data: { _id: "pd-1" } });
});

const renderScreen = () =>
  render(
    <SchedulePlaydateScreen route={{ params: { pet: theirPet } }} navigation={navigation} />
  );

describe("SchedulePlaydateScreen", () => {
  it("lists places near the user", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("location-loc-1")).toBeTruthy());
    expect(api.get).toHaveBeenCalledWith("/api/locations/playdate-locations", {
      params: { userLat: 51.5, userLng: -0.1, range: 5 },
    });
  });

  it("still lists places when location permission is refused", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    renderScreen();

    // Not being able to sort by distance is not a reason to show nothing.
    await waitFor(() => expect(screen.getByTestId("location-loc-1")).toBeTruthy());
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("explains an empty list instead of showing a blank screen", async () => {
    api.get.mockResolvedValue({ data: [] });
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("location-error")).toBeTruthy());
  });

  /**
   * Every query goes through `waitFor`. In this React 19 / RTL combination a
   * query issued straight after a state change resolves against a stale tree,
   * which is the same reason the other screen suites here use this shape.
   */
  const tapById = async (testID) => {
    const element = await waitFor(() => screen.getByTestId(testID));
    fireEvent.press(element);
  };

  it("sends both pets and the chosen place", async () => {
    renderScreen();

    await tapById("location-loc-1");
    await tapById("playdate-submit");

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe("/api/playdates");
    expect(body.location).toBe("loc-1");
    expect(body.petsInvolved).toEqual(["my-pet", "their-pet"]);
    expect(body.startTime).toBeTruthy();
  });

  it("asks for a place rather than throwing on submit", async () => {
    renderScreen();

    // The old screen read `selectedLocation._id` with nothing selected.
    await tapById("playdate-submit");

    await waitFor(() => expect(screen.getByTestId("schedule-playdate")).toBeTruthy());
    expect(api.post).not.toHaveBeenCalled();
  });

  it("goes to the confirmation once the server accepts it", async () => {
    renderScreen();

    await tapById("location-loc-1");
    await tapById("playdate-submit");

    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith("PlaydateCreated", {
        playdate: { _id: "pd-1" },
        pet: theirPet,
      })
    );
  });

  it("survives a pet with no photo", async () => {
    render(
      <SchedulePlaydateScreen
        route={{ params: { pet: { _id: "p", name: "Sky" } } }}
        navigation={navigation}
      />
    );

    await waitFor(() => expect(screen.getByTestId("schedule-playdate")).toBeTruthy());
  });
});
