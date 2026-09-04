import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";

import MapScreen from "./MapScreen";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { fetchMapPets, fetchPlaces, importPlaces } from "../../api/maps";

jest.mock("../../api/maps", () => ({
  fetchMapPets: jest.fn(),
  fetchPlaces: jest.fn(),
  importPlaces: jest.fn(),
}));

/**
 * A marker's `title` is a prop the native view draws in a callout, not a text
 * node, so the pins are asserted by testID. The mock renders a Pressable so a
 * tap reaches `onPress` the way it does on a device.
 */
jest.mock("react-native-maps", () => {
  const { View, Pressable } = require("react-native");
  const MockMapView = ({ children, ...rest }) => <View {...rest}>{children}</View>;
  const MockMarker = ({ children, ...rest }) => (
    <Pressable {...rest}>{children}</Pressable>
  );
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_GOOGLE: "google",
    PROVIDER_DEFAULT: undefined,
  };
});

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

/**
 * The map, which had never rendered a marker.
 *
 * It read `pet.location.lat` off `/api/petmatches/matched-pets` - PetMatch
 * documents, and a pet has no coordinates at all, because the position lives on
 * its owner. It called its own places fetch with no arguments. It drove the
 * bottom sheet through `.show()` and `initialSnapIndex`, neither of which the
 * library has. None of that is visible to lint or a bundle; all of it is
 * visible the first time a marker is asked for.
 */

const navigation = { navigate: jest.fn() };

const HERE = { latitude: 37.78825, longitude: -122.4324 };

const pet = (id, name) => ({
  _id: id,
  name,
  breed: "Beagle",
  latitude: 37.79,
  longitude: -122.43,
  distanceMiles: 2.1,
});

const place = (id, name) => ({
  _id: id,
  name,
  address: `${name} Road`,
  // Stored as GeoJSON: [longitude, latitude].
  geoLocation: { type: "Point", coordinates: [-122.4294, 37.79025] },
  distanceMiles: 0.4,
});

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <MapScreen navigation={navigation} />
    </AppThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
  Location.getCurrentPositionAsync.mockResolvedValue({ coords: HERE });
  fetchMapPets.mockResolvedValue({ pets: [], origin: HERE, range: 25 });
  fetchPlaces.mockResolvedValue([]);
  importPlaces.mockResolvedValue({ configured: false, imported: 0 });
});

describe("MapScreen", () => {
  it("renders the map once both layers have loaded", async () => {
    fetchMapPets.mockResolvedValue({ pets: [pet("p1", "Bo")], origin: HERE, range: 25 });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("map-view")).toBeTruthy());
  });

  it("places a matched pet at its own coordinates", async () => {
    fetchMapPets.mockResolvedValue({ pets: [pet("p1", "Bo")], origin: HERE, range: 25 });
    await renderScreen();

    const pin = await waitFor(() => screen.getByTestId("map-pin-pet-p1"));
    // The server names them, so the screen never has to know that the stored
    // pair is [longitude, latitude].
    expect(pin.props.coordinate).toEqual({ latitude: 37.79, longitude: -122.43 });
  });

  it("reads a place's coordinates in GeoJSON order", async () => {
    fetchPlaces.mockResolvedValue([place("l1", "Green Park")]);
    await renderScreen();

    // [-122.4294, 37.79025] is longitude then latitude. Getting this backwards
    // puts a San Francisco park in Antarctica.
    const pin = await waitFor(() => screen.getByTestId("map-pin-place-l1"));
    expect(pin.props.coordinate).toEqual({
      latitude: 37.79025,
      longitude: -122.4294,
    });
  });

  it("skips a place with no coordinates rather than plotting undefined", async () => {
    fetchPlaces.mockResolvedValue([{ _id: "l2", name: "Nowhere", address: "?" }]);
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("map-view")).toBeTruthy());
    expect(screen.queryByTestId("map-pin-place-l2")).toBeNull();
  });

  it("opens the tapped pet", async () => {
    fetchMapPets.mockResolvedValue({ pets: [pet("p1", "Bo")], origin: HERE, range: 25 });
    await renderScreen();

    await fireEvent.press(await waitFor(() => screen.getByTestId("map-pin-pet-p1")));

    await waitFor(() => expect(screen.getByTestId("map-selection")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("map-open"));

    expect(navigation.navigate).toHaveBeenCalledWith("PetDetails", { petId: "p1" });
  });

  it("opens the tapped place", async () => {
    fetchPlaces.mockResolvedValue([place("l1", "Green Park")]);
    await renderScreen();

    await fireEvent.press(await waitFor(() => screen.getByTestId("map-pin-place-l1")));

    await waitFor(() => expect(screen.getByTestId("map-selection")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("map-open"));

    expect(navigation.navigate).toHaveBeenCalledWith("PotentialPlaydateLocation", {
      locationId: "l1",
    });
  });

  it("hides a layer when its switch is turned off", async () => {
    fetchMapPets.mockResolvedValue({ pets: [pet("p1", "Bo")], origin: HERE, range: 25 });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("map-pin-pet-p1")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("map-toggle-pets"));

    await waitFor(() => expect(screen.queryByTestId("map-pin-pet-p1")).toBeNull());
  });

  it("still loads the map when location permission is refused", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    fetchMapPets.mockResolvedValue({ pets: [pet("p1", "Bo")], origin: HERE, range: 25 });

    await renderScreen();

    // The server knows where the caller last said they were, so the pins stay.
    // Only the blue dot goes away.
    await waitFor(() => expect(screen.getByTestId("map-pin-pet-p1")).toBeTruthy());
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("says the map is empty rather than showing bare ground", async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("map-empty")).toBeTruthy());
  });

  it("asks the server to import places when it has none", async () => {
    await renderScreen();

    // An empty collection and a broken query look identical on a map.
    await waitFor(() =>
      expect(importPlaces).toHaveBeenCalledWith({
        latitude: HERE.latitude,
        longitude: HERE.longitude,
      })
    );
  });

  it("shows what was imported without a second permission prompt", async () => {
    importPlaces.mockResolvedValue({ configured: true, imported: 3 });
    fetchPlaces
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([place("l1", "Green Park")]);

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("map-pin-place-l1")).toBeTruthy());
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("survives the map request failing", async () => {
    fetchMapPets.mockRejectedValue(new Error("offline"));
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("map")).toBeTruthy());
  });
});
