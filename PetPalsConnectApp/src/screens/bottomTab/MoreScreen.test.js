import React from "react";
import { Linking } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import * as Location from "expo-location";

import MoreScreen from "./MoreScreen";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({
  useAuthSession: jest.fn(),
}));
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

/**
 * The care hub.
 *
 * This screen was five unstyled buttons; it is now the half of the app that
 * serves the pets somebody actually owns. The cases below are the ones that
 * decide whether it is worth opening: it must work with no pets, with no
 * shared position and with no imported places, and it must never turn a note
 * about a pet's health into a product recommendation.
 */

const navigation = { navigate: jest.fn() };
const route = { params: {} };

const EMERGENCY = [
  {
    id: "aspca-apcc",
    name: "ASPCA Animal Poison Control Center",
    phone: "888-426-4435",
    region: "US",
    note: "24/7. A consultation fee may apply.",
  },
];

const dogPicks = (overrides = {}) => ({
  petId: "pet-1",
  name: "Rex",
  species: "dog",
  stage: "adult",
  size: "medium",
  seeAVet: false,
  shelves: [
    {
      category: "food",
      picks: [
        {
          id: "dog-adult-food",
          category: "food",
          title: "Adult dog food",
          why: "Formulated for a dog that has finished growing.",
          url: "https://example.test/food",
        },
      ],
    },
  ],
  ...overrides,
});

const respondWith = ({ pets = [], places = [], locationKnown = true, importable = true } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/api/petcare/picks") {
      return Promise.resolve({
        data: {
          categories: ["food", "supplies"],
          placeCategories: ["vet", "petStore", "groomer", "boarding"],
          emergency: EMERGENCY,
          pets,
        },
      });
    }
    if (url === "/api/locations/care") {
      return Promise.resolve({
        data: { locationKnown, importable, emergency: EMERGENCY, places },
      });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({ hasPet: true, hasDog: true });
  Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
  Location.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 37.76, longitude: -122.43 },
  });
});

describe("the care hub", () => {
  it("renders", async () => {
    respondWith({ pets: [dogPicks()] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("care-hub")).toBeTruthy());
  });

  it("shows the emergency numbers before anything has loaded", async () => {
    // These come from a table in the source, so there is nothing to wait for -
    // and this is the one thing somebody might open the app in a panic to find.
    api.get.mockReturnValue(new Promise(() => {}));
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-emergency")).toBeTruthy());
    expect(screen.getByTestId("hub-loading")).toBeTruthy();
  });

  it("dials a number rather than only printing it", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    respondWith({ pets: [dogPicks()] });
    render(<MoreScreen navigation={navigation} route={route} />);

    const contact = await waitFor(() => screen.getByTestId("emergency-aspca-apcc"));
    fireEvent.press(contact);

    expect(openURL).toHaveBeenCalledWith("tel:8884264435");
  });

  it("says what a pick is for, which is what makes it not an advert", async () => {
    respondWith({ pets: [dogPicks()] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("pick-dog-adult-food")).toBeTruthy());
    expect(screen.getByText("For your adult, medium dog")).toBeTruthy();
    expect(
      screen.getByText("Formulated for a dog that has finished growing.")
    ).toBeTruthy();
  });

  it("sends somebody to a vet instead of guessing at a health product", async () => {
    // The server never lets `specialNeeds` reach a recommendation; this is the
    // screen's half of that promise.
    respondWith({ pets: [dogPicks({ seeAVet: true })] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-see-a-vet")).toBeTruthy());
  });

  it("offers to add a pet when there are none", async () => {
    respondWith({ pets: [] });
    render(<MoreScreen navigation={navigation} route={route} />);

    const button = await waitFor(() => screen.getByTestId("hub-add-pet"));
    fireEvent.press(button);

    expect(navigation.navigate).toHaveBeenCalledWith("AddPet");
  });

  it("does not apologise for a bug when somebody simply has no pets", async () => {
    // This keyed off `hasPet` from the session at first, so a petless owner
    // was told "we could not read your pets just now" - an apology for a
    // failure that had not happened, in place of an invitation.
    respondWith({ pets: [] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-no-pets")).toBeTruthy());
    expect(screen.getByText("Add a pet to see this")).toBeTruthy();
  });

  it("says so when the pets could not be read at all", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/api/petcare/picks") return Promise.reject(new Error("down"));
      return Promise.resolve({
        data: { locationKnown: true, importable: true, emergency: EMERGENCY, places: [] },
      });
    });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-no-pets")).toBeTruthy());
    expect(screen.getByText("Nothing to show yet")).toBeTruthy();
    expect(screen.queryByTestId("hub-add-pet")).toBeNull();
  });

  it("lets an owner switch between their pets", async () => {
    respondWith({
      pets: [dogPicks(), dogPicks({ petId: "pet-2", name: "Mog", species: "cat" })],
    });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-pet-pet-2")).toBeTruthy());
    fireEvent.press(screen.getByTestId("hub-pet-pet-2"));

    await waitFor(() => expect(screen.getByText("For your adult, medium cat")).toBeTruthy());
  });

  it("asks no question when there is only one pet", async () => {
    respondWith({ pets: [dogPicks()] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-picks")).toBeTruthy());
    expect(screen.queryByTestId("hub-pet-pet-1")).toBeNull();
  });

  it("distinguishes 'we do not know where you are' from 'there is nothing here'", async () => {
    // A list that says "no vets near you" when it has never been given a
    // position is a lie the user cannot correct.
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });
    respondWith({ pets: [dogPicks()], places: [], locationKnown: false });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-no-places")).toBeTruthy());
    expect(screen.getByText(/Share your location/)).toBeTruthy();
  });

  it("says a fresh area is unimported rather than empty", async () => {
    respondWith({ pets: [dogPicks()], places: [], locationKnown: true, importable: true });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-no-places")).toBeTruthy());
    expect(screen.getByText(/Nothing here yet for your area/)).toBeTruthy();
  });

  it("never asks for the location permission on its own", async () => {
    // The prompt belongs where somebody asked for something location-shaped,
    // not on a tab they happened to open. This reads the answer, never asks.
    respondWith({ pets: [dogPicks()] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("care-hub")).toBeTruthy());
    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).toBeUndefined();
  });

  it("opens a place rather than listing it as dead text", async () => {
    respondWith({
      pets: [dogPicks()],
      places: [
        { _id: "loc-1", name: "Averill Vets", address: "1 Averill St", distanceMiles: 0.7 },
      ],
    });
    render(<MoreScreen navigation={navigation} route={route} />);

    const place = await waitFor(() => screen.getByTestId("place-loc-1"));
    fireEvent.press(place);

    expect(navigation.navigate).toHaveBeenCalledWith("PotentialPlaydateLocation", {
      locationId: "loc-1",
    });
  });

  it("narrows the places to one category", async () => {
    respondWith({ pets: [dogPicks()] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-category-vet")).toBeTruthy());
    fireEvent.press(screen.getByTestId("hub-category-vet"));

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/api/locations/care", {
        params: { lat: 37.76, lng: -122.43, category: "vet" },
      })
    );
  });

  it("keeps the links this screen already had", async () => {
    respondWith({ pets: [dogPicks()] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("shortcut-Profile")).toBeTruthy());
    for (const route_ of [
      "AddPet",
      "Favorites",
      "Notifications",
      "GroupChatCreation",
      "Settings",
    ]) {
      expect(screen.getByTestId(`shortcut-${route_}`)).toBeTruthy();
    }
  });

  it("survives one half of it failing", async () => {
    // One endpoint being down should cost that section, not the screen.
    api.get.mockImplementation((url) => {
      if (url === "/api/petcare/picks") return Promise.reject(new Error("down"));
      return Promise.resolve({
        data: { locationKnown: true, importable: true, emergency: EMERGENCY, places: [] },
      });
    });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("care-hub")).toBeTruthy());
    // The emergency numbers ride on both responses, so they survive either one.
    expect(screen.getByTestId("hub-emergency")).toBeTruthy();
  });
});
