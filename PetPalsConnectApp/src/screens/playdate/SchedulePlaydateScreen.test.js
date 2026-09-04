import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import * as Location from "expo-location";

import SchedulePlaydateScreen from "./SchedulePlaydateScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";
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
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

/**
 * The screen that turns a match into a plan - now the only one.
 *
 * It read coordinates from `navigator.geolocation`, a browser API React Native
 * does not have, so the "not supported" branch ran every time: the location
 * list stayed empty and submitting dereferenced `selectedLocation._id` on null.
 *
 * It is also where the location-first flow now lands. That flow used to be
 * `PlaydatePetSelection` -> `SchedulePlaydateDetails` and could not create a
 * playdate at all: it rendered PetMatch rows as pets, called a bottom-sheet
 * method that does not exist, and passed `petIds` to a screen reading `petId`.
 * The two entry points differ only in what they already know, so both are
 * exercised here against the same screen.
 */

const navigation = { navigate: jest.fn() };
const theirPet = { _id: "their-pet", name: "Bo", photos: [] };

const park = { _id: "loc-1", name: "Green Lane Park", address: "12 Green Lane" };
const favourite = { _id: "loc-9", name: "Far Away Field", address: "9 Long Road" };

/** `api.get` is one mock for several paths, so route by URL. */
const routeGet = ({ locations = [park], matches = [], location = favourite } = {}) => {
  api.get.mockImplementation(async (path) => {
    if (path.startsWith("/api/locations/playdate-locations")) return { data: locations };
    if (path.startsWith("/api/locations/")) return { data: location };
    if (path.startsWith("/api/petmatches/matched-pets")) return { data: matches };
    throw new Error(`Unexpected GET ${path}`);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({
    profile: { _id: "me", pets: [{ _id: "my-pet", name: "Sky" }] },
  });
  fetchUserPreferences.mockResolvedValue({ playdateRange: 5 });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
  Location.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 51.5, longitude: -0.1 },
  });
  routeGet();
  api.post.mockResolvedValue({ data: { _id: "pd-1" } });
});

const renderWith = (params) =>
  render(
    <AppThemeProvider>
      <ToastProvider>
        <SchedulePlaydateScreen route={{ params }} navigation={navigation} />
      </ToastProvider>
    </AppThemeProvider>
  );

/** Arriving from a pet: the pet is known, the place is not. */
const renderScreen = () => renderWith({ pet: theirPet });

/**
 * Every query goes through `waitFor`. In this React 19 / RTL combination a
 * query issued straight after a state change resolves against a stale tree,
 * which is the same reason the other screen suites here use this shape.
 */
const tapById = async (testID) => {
  const element = await waitFor(() => screen.getByTestId(testID));
  fireEvent.press(element);
};

describe("arriving from a pet", () => {
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
    routeGet({ locations: [] });
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("location-error")).toBeTruthy());
  });

  it("does not ask whose pet, or fetch matches, when it was told", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("location-loc-1")).toBeTruthy());
    expect(screen.queryByTestId(`their-pet-${theirPet._id}`)).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringContaining("matched-pets"),
      expect.anything()
    );
    expect(
      api.get.mock.calls.some(([path]) => path.includes("matched-pets"))
    ).toBe(false);
  });

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
    renderWith({ pet: { _id: "p", name: "Rex" } });

    await waitFor(() => expect(screen.getByTestId("schedule-playdate")).toBeTruthy());
  });

  it("accepts a pet given only by id", async () => {
    renderWith({ petId: "their-pet" });

    await tapById("location-loc-1");
    await tapById("playdate-submit");

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1].petsInvolved).toEqual(["my-pet", "their-pet"]);
  });
});

describe("arriving from a place", () => {
  it("chooses that place, without waiting to be told twice", async () => {
    renderWith({ locationId: "loc-9" });

    // The place is fetched by id, not looked up in the nearby list: a
    // favourite can be well outside the owner's range.
    await waitFor(() => expect(screen.getByTestId("location-loc-9")).toBeTruthy());
    expect(api.get).toHaveBeenCalledWith("/api/locations/loc-9");
  });

  it("asks whose pet, from the pets this account has matched with", async () => {
    routeGet({ matches: [{ _id: "m1", pet2: theirPet }] });
    renderWith({ locationId: "loc-9" });

    // A PetMatch row is not a pet - `pet2` is the other side of the match, and
    // rendering the row itself is why this list used to be blank cards.
    await waitFor(() => expect(screen.getByTestId("their-pet-their-pet")).toBeTruthy());
    expect(screen.getByText("Bo")).toBeTruthy();
  });

  it("sends the place it arrived with and the pet that was picked", async () => {
    routeGet({ matches: [{ _id: "m1", pet2: theirPet }] });
    renderWith({ locationId: "loc-9" });

    await tapById("their-pet-their-pet");
    await tapById("playdate-submit");

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = api.post.mock.calls[0];
    expect(body.location).toBe("loc-9");
    // Both owners' pets, which is how the server works out who to invite.
    expect(body.petsInvolved).toEqual(["my-pet", "their-pet"]);
  });

  it("asks for a pet rather than sending a playdate with one side missing", async () => {
    routeGet({ matches: [{ _id: "m1", pet2: theirPet }] });
    renderWith({ locationId: "loc-9" });

    await waitFor(() => expect(screen.getByTestId("their-pet-their-pet")).toBeTruthy());
    await tapById("playdate-submit");

    await waitFor(() => expect(screen.getByTestId("schedule-playdate")).toBeTruthy());
    expect(api.post).not.toHaveBeenCalled();
  });

  it("says so when there is nobody to invite yet", async () => {
    routeGet({ matches: [] });
    renderWith({ locationId: "loc-9" });

    await waitFor(() => expect(screen.getByTestId("matches-empty")).toBeTruthy());
  });

  it("carries on when the place cannot be fetched", async () => {
    api.get.mockImplementation(async (path) => {
      if (path.startsWith("/api/locations/playdate-locations")) return { data: [park] };
      if (path.startsWith("/api/locations/")) throw new Error("gone");
      return { data: [] };
    });

    renderWith({ locationId: "loc-9" });

    // The nearby list is still there to choose from.
    await waitFor(() => expect(screen.getByTestId("location-loc-1")).toBeTruthy());
  });
});

describe("choosing which of your own pets is coming", () => {
  beforeEach(() => {
    useAuthSession.mockReturnValue({
      profile: {
        _id: "me",
        pets: [
          { _id: "my-pet", name: "Sky" },
          { _id: "my-other-pet", name: "Rex" },
        ],
      },
    });
  });

  it("asks, when there is more than one", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("my-pet-my-other-pet")).toBeTruthy());
  });

  it("sends the one that was chosen, not simply the first", async () => {
    renderScreen();

    await tapById("my-pet-my-other-pet");
    await tapById("location-loc-1");
    await tapById("playdate-submit");

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1].petsInvolved).toEqual([
      "my-other-pet",
      "their-pet",
    ]);
  });

  it("does not ask when there is only one", async () => {
    useAuthSession.mockReturnValue({
      profile: { _id: "me", pets: [{ _id: "my-pet", name: "Sky" }] },
    });
    renderScreen();

    await waitFor(() => expect(screen.getByTestId("location-loc-1")).toBeTruthy());
    expect(screen.queryByTestId("my-pet-my-pet")).toBeNull();
  });
});
