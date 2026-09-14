import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import HomeScreen from "./HomeScreen";
import api from "../../api/axios";
import { useSpotEnabled } from "../../hooks/useSpotEnabled";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../hooks/useSpotEnabled", () => ({ useSpotEnabled: jest.fn(() => true) }));
/**
 * The landing screen after sign-in. It threw a ReferenceError on import for
 * four sessions - `StyleSheet.create` at module scope with no import - and lint
 * and both bundles were happy the whole time, because `StyleSheet` is a DOM
 * global and eslint-config-expo loads the browser globals.
 *
 * So the first assertion here is simply that it mounts. The rest cover the
 * shapes it reads: an axios response is not an array, a Firebase uid is not a
 * Mongo id, and pets carry `_id`/`photos`, not `id`/`image`.
 */

const navigation = { navigate: jest.fn() };
const route = { params: {} };

const respondWith = ({ pets = [], favorites = [], article = null, noticed = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/api/pets/latest") return Promise.resolve({ data: pets });
    if (url === "/api/favorites") return Promise.resolve({ data: favorites });
    if (url === "/api/spot/noticed") return Promise.resolve({ data: noticed });
    if (url === "/api/articles/latest") return Promise.resolve({ data: article });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("HomeScreen", () => {
  it("renders", async () => {
    respondWith();
    render(<HomeScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("shortcut-Profile")).toBeTruthy());
  });

  it("keeps a way into the articles when there is no article to feature", async () => {
    /**
     * The regression this guards: the "View all articles" button used to live
     * inside `{latestArticle ? ... : null}`, so an empty or failed
     * `/api/articles/recent` hid the only route to a sixty-article corpus.
     * The card needs an article; the way into the library does not.
     */
    api.get.mockImplementation((url) => {
      if (url === "/api/pets/latest") return Promise.resolve({ data: [] });
      if (url === "/api/favorites") return Promise.resolve({ data: [] });
      // Exactly what the server answers when nothing is published yet.
      if (url === "/api/articles/recent") return Promise.resolve({ data: null });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    render(<HomeScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("home-all-articles")).toBeTruthy());
  });

  it("asks for favourites by token, not by an id in the URL", async () => {
    respondWith();
    render(<HomeScreen navigation={navigation} route={route} />);

    // The old screen sent `auth.currentUser.uid` - a Firebase uid - to
    // `/api/users/favorites/:userId`, which does User.findById: a CastError
    // and a 500 every time. Scoping by the token removes the id entirely.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/favorites"));
    expect(
      api.get.mock.calls.some(([url]) => url.startsWith("/api/users/favorites/"))
    ).toBe(false);
  });

  it("renders a pet by its schema fields", async () => {
    respondWith({ pets: [{ _id: "pet1", name: "Rex", photos: ["https://x/1.jpg"] }] });
    render(<HomeScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("pet-pet1")).toBeTruthy());
  });

  it("survives a pet with no photos", async () => {
    respondWith({ pets: [{ _id: "pet2", name: "Bo", photos: [] }] });
    render(<HomeScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("pet-pet2")).toBeTruthy());
  });

  it("shows the other sections when one endpoint fails", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/api/pets/latest") return Promise.reject(new Error("boom"));
      return Promise.resolve({ data: url === "/api/articles/latest" ? null : [] });
    });

    render(<HomeScreen navigation={navigation} route={route} />);

    // A dead endpoint costs you that shelf, not the whole screen.
    await waitFor(() => expect(screen.getByTestId("shortcut-Profile")).toBeTruthy());
  });

  it("renders a favourite through its populated pet", async () => {
    respondWith({ favorites: [{ _id: "fav1", pet: { _id: "pet3", name: "Milo" } }] });
    render(<HomeScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("favorite-fav1")).toBeTruthy());
  });
});

describe("Spot shortcut", () => {
  it("is in the shortcuts row when Spot is on, and navigates there", async () => {
    respondWith();
    render(<HomeScreen navigation={navigation} route={route} />);

    const shortcut = await waitFor(() => screen.getByTestId("shortcut-Spot"));
    const { fireEvent } = require("@testing-library/react-native");
    await fireEvent.press(shortcut);
    expect(navigation.navigate).toHaveBeenCalledWith("Spot");
  });

  it("is absent when the server has no key for it", async () => {
    useSpotEnabled.mockReturnValue(false);
    respondWith();
    render(<HomeScreen navigation={navigation} route={route} />);

    await waitFor(() => screen.getByTestId("shortcut-Settings"));
    expect(screen.queryByTestId("shortcut-Spot")).toBeNull();
    useSpotEnabled.mockReturnValue(true);
  });
});

describe("what Spot noticed", () => {
  const notices = [
    { id: "vaccine-p1", kind: "vaccine", text: "One of Bella's vaccinations is due within 30 days.", question: "Is Bella due for anything?", screen: "PetHealth", params: { petId: "p1" } },
    { id: "weight-p1", kind: "weight", text: "Bella hasn't been weighed in 4 months.", question: "Log a weigh-in for Bella", screen: "PetWeight", params: { petId: "p1" } },
  ];

  it("shows the first notice, counts the rest, and a tap opens Spot with the question", async () => {
    respondWith({ noticed: notices });
    render(<HomeScreen navigation={navigation} route={route} />);
    const card = await waitFor(() => screen.getByTestId("home-noticed"));
    expect(screen.getByText("One of Bella's vaccinations is due within 30 days.")).toBeTruthy();
    expect(screen.getByText("and 1 more")).toBeTruthy();
    expect(screen.queryByText(/weighed in 4 months/)).toBeNull();
    fireEvent.press(card);
    expect(navigation.navigate).toHaveBeenCalledWith("Spot", {
      prefill: "Is Bella due for anything?",
      context: { screen: "home" },
    });
  });

  it("is absent when there is nothing to say, and when the route fails", async () => {
    respondWith({ noticed: [] });
    render(<HomeScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(screen.getByTestId("shortcut-Profile")).toBeTruthy());
    expect(screen.queryByTestId("home-noticed")).toBeNull();

    api.get.mockImplementation((url) => {
      if (url === "/api/spot/noticed") return Promise.reject(new Error("503"));
      return Promise.resolve({ data: [] });
    });
    render(<HomeScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(screen.getAllByTestId("shortcut-Profile").length).toBeGreaterThan(0));
    expect(screen.queryByTestId("home-noticed")).toBeNull();
  });

  it("is absent while Spot is off, whatever the route says", async () => {
    const { useSpotEnabled } = require("../../hooks/useSpotEnabled");
    useSpotEnabled.mockReturnValueOnce(false).mockReturnValue(false);
    respondWith({ noticed: notices });
    render(<HomeScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(screen.getByTestId("shortcut-Profile")).toBeTruthy());
    expect(screen.queryByTestId("home-noticed")).toBeNull();
    useSpotEnabled.mockReturnValue(true);
  });
});
