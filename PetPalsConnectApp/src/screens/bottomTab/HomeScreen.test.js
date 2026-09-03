import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

import HomeScreen from "./HomeScreen";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({
  useAuthSession: jest.fn(),
}));

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

const respondWith = ({ pets = [], favorites = [], article = null } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === "/api/pets/latest") return Promise.resolve({ data: pets });
    if (url.startsWith("/api/users/favorites/")) return Promise.resolve({ data: favorites });
    if (url === "/api/articles/latest") return Promise.resolve({ data: article });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({ userId: "507f1f77bcf86cd799439011" });
});

describe("HomeScreen", () => {
  it("renders", async () => {
    respondWith();
    render(<HomeScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId("shortcut-Profile")).toBeTruthy());
  });

  it("fetches favourites with the Mongo id, not the Firebase uid", async () => {
    respondWith();
    render(<HomeScreen navigation={navigation} route={route} />);

    // `/api/users/favorites/:userId` does User.findById; a Firebase uid there is
    // a CastError and a 500, which is what the old screen sent.
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        "/api/users/favorites/507f1f77bcf86cd799439011"
      )
    );
  });

  it("does not ask for favourites before the profile has loaded", async () => {
    useAuthSession.mockReturnValue({ userId: null });
    respondWith();
    render(<HomeScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/pets/latest"));
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
