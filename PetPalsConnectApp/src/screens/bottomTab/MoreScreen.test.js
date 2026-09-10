import React from "react";
import { Linking } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import * as Location from "expo-location";

import MoreScreen from "./MoreScreen";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";
import { importPlaces } from "../../api/maps";
import { savePlace } from "../../api/petCare";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../api/petCare", () => ({
  ...jest.requireActual("../../api/petCare"),
  savePlace: jest.fn(),
  unsavePlace: jest.fn(),
}));
jest.mock("../../context/AuthSessionContext", () => ({
  useAuthSession: jest.fn(),
}));
jest.mock("../../api/maps", () => ({ importPlaces: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  // Runs the effect once, like a first focus, and never re-focuses.
  useFocusEffect: (effect) => require("react").useEffect(effect, [effect]),
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

const respondWith = ({
  pets = [],
  places = [],
  saved = [],
  locationKnown = true,
  importable = true,
} = {}) => {
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
        data: { locationKnown, importable, emergency: EMERGENCY, saved, places },
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
  importPlaces.mockResolvedValue({ configured: true, imported: 0 });
  savePlace.mockResolvedValue({});
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

  it("fills an empty area in rather than telling you to go elsewhere", async () => {
    // Sending somebody to a different tab to fix an empty list on this one is
    // a dead end.
    respondWith({ pets: [dogPicks()], places: [], locationKnown: true });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() =>
      expect(importPlaces).toHaveBeenCalledWith({ latitude: 37.76, longitude: -122.43 })
    );
  });

  it("never imports without knowing where you are", async () => {
    // Importing around a position we do not have spends billed requests on
    // the wrong city.
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });
    respondWith({ pets: [dogPicks()], places: [], locationKnown: false });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-no-places")).toBeTruthy());
    expect(importPlaces).not.toHaveBeenCalled();
  });

  it("never imports when the server has no Google key", async () => {
    respondWith({ pets: [dogPicks()], places: [], importable: false });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-no-places")).toBeTruthy());
    expect(importPlaces).not.toHaveBeenCalled();
  });

  it("does not import when there are already places", async () => {
    respondWith({
      pets: [dogPicks()],
      places: [{ _id: "loc-1", name: "Averill Vets", address: "1 Averill St" }],
    });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("place-loc-1")).toBeTruthy());
    expect(importPlaces).not.toHaveBeenCalled();
  });

  it("tries the import once, not on every refresh", async () => {
    // An import is billed Google traffic. A screen that retries on every
    // pull-to-refresh turns a quota problem into a bill.
    importPlaces.mockRejectedValue(new Error("rate limited"));
    respondWith({ pets: [dogPicks()], places: [], locationKnown: true });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(importPlaces).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByTestId("hub-category-vet"));
    await waitFor(() => expect(screen.getByTestId("hub-no-places")).toBeTruthy());
    expect(importPlaces).toHaveBeenCalledTimes(1);
  });

  it("re-reads the list when the import found something", async () => {
    importPlaces.mockResolvedValue({ configured: true, imported: 12 });
    let call = 0;
    api.get.mockImplementation((url) => {
      if (url === "/api/petcare/picks") {
        return Promise.resolve({
          data: {
            categories: [],
            placeCategories: ["vet"],
            emergency: EMERGENCY,
            pets: [dogPicks()],
          },
        });
      }
      if (url === "/api/locations/care") {
        call += 1;
        return Promise.resolve({
          data: {
            locationKnown: true,
            importable: true,
            emergency: EMERGENCY,
            places:
              call === 1
                ? []
                : [{ _id: "loc-9", name: "New Vets", address: "9 New Street" }],
          },
        });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("place-loc-9")).toBeTruthy());
  });

  it("says an area is genuinely empty only once it has looked", async () => {
    // Before the hub imported for itself this told people to go to the map,
    // which was a dead end. It now says what it found, after looking.
    respondWith({ pets: [dogPicks()], places: [], locationKnown: true, importable: true });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(importPlaces).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/Nothing found for your area yet/)).toBeTruthy()
    );
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

    // The card's own body, not the card: the save star beside it is a
    // separate tap target on purpose.
    const place = await waitFor(() => screen.getByTestId("place-open-loc-1"));
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

  it("saves a place and shows it pinned above the search", async () => {
    savePlace.mockResolvedValue({});
    respondWith({
      pets: [dogPicks()],
      places: [{ _id: "loc-1", name: "Averill Vets", address: "1 Averill St" }],
    });
    render(<MoreScreen navigation={navigation} route={route} />);

    const star = await waitFor(() => screen.getByTestId("place-save-loc-1"));
    fireEvent.press(star);

    // Optimistic: the list moves under the thumb rather than after a round trip.
    await waitFor(() => expect(screen.getByTestId("hub-saved")).toBeTruthy());
    expect(savePlace).toHaveBeenCalledWith("loc-1");
  });

  it("rolls a failed save back rather than lying about it", async () => {
    savePlace.mockRejectedValue(new Error("nope"));
    respondWith({
      pets: [dogPicks()],
      places: [{ _id: "loc-1", name: "Averill Vets", address: "1 Averill St" }],
    });
    render(<MoreScreen navigation={navigation} route={route} />);

    const star = await waitFor(() => screen.getByTestId("place-save-loc-1"));
    fireEvent.press(star);

    await waitFor(() => expect(savePlace).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId("hub-saved")).toBeNull());
  });

  it("keeps saving separate from opening", async () => {
    // Nesting one press handler inside another makes which fires depend on
    // exactly where the thumb landed.
    savePlace.mockResolvedValue({});
    respondWith({
      pets: [dogPicks()],
      places: [{ _id: "loc-1", name: "Averill Vets", address: "1 Averill St" }],
    });
    render(<MoreScreen navigation={navigation} route={route} />);

    const star = await waitFor(() => screen.getByTestId("place-save-loc-1"));
    fireEvent.press(star);

    await waitFor(() => expect(savePlace).toHaveBeenCalled());
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("shows a saved place even when it is not in the nearby list", async () => {
    // Saved places are not filtered by the category chips or the range: your
    // own vet is the entry you came here to find.
    respondWith({ pets: [dogPicks()], places: [], saved: [
      { _id: "loc-mine", name: "My Vet", address: "2 Home Road" },
    ] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("hub-saved")).toBeTruthy());
    expect(screen.getByTestId("place-loc-mine")).toBeTruthy();
  });

  it("keeps the links this screen already had", async () => {
    respondWith({ pets: [dogPicks()] });
    render(<MoreScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("shortcut-Profile")).toBeTruthy());
    for (const route_ of [
      "AddPet",
      "Favorites",
      "Notifications",
      // The group-chat tile goes to PetSelection, not straight to
      // GroupChatCreation: arriving there with no pets selected refused with
      // "choose at least one pet" and offered no way to choose one.
      "PetSelection",
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
