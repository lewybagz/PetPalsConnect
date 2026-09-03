import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import DiscoverScreen from "./DiscoverScreen";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({
  useAuthSession: jest.fn(),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

/**
 * The app's core loop, which did not exist before: browse candidates, say yes
 * or no, and find out when it is mutual.
 */

const navigation = { navigate: jest.fn() };

const candidate = (id, name, extra = {}) => ({
  pet: { _id: id, name, breed: "Beagle", age: 4, weight: 25, photos: [] },
  score: 78,
  breakdown: { temperament: 27, size: 23, activities: 5, breed: 4, age: 2 },
  ...extra,
});

const respondWith = (candidates, pet = { _id: "mine", name: "Rex" }) => {
  api.get.mockResolvedValue({ data: { pet, candidates, threshold: 45 } });
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({ hasPet: true });
  api.post.mockResolvedValue({ data: { decision: "like", mutual: false } });
});

describe("DiscoverScreen", () => {
  it("shows a candidate", async () => {
    respondWith([candidate("pet-1", "Bo")]);
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeTruthy());
  });

  it("asks for a pet first when the user has none", async () => {
    // The add-a-pet step is skippable, so reaching this tab without one is a
    // normal state rather than a bug.
    useAuthSession.mockReturnValue({ hasPet: false });
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() =>
      expect(screen.getByTestId("requires-pet-empty-state")).toBeTruthy()
    );
    expect(api.get).not.toHaveBeenCalled();
  });

  it("shows an empty state when nobody is left", async () => {
    respondWith([]);
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-empty")).toBeTruthy());
  });

  it("records a like against the right pair", async () => {
    respondWith([candidate("pet-1", "Bo")]);
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-like")).toBeTruthy());
    fireEvent.press(screen.getByTestId("discover-like"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/petmatches/decide", {
        fromPetId: "mine",
        toPetId: "pet-1",
        decision: "like",
      })
    );
  });

  it("records a pass", async () => {
    respondWith([candidate("pet-1", "Bo")]);
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-pass")).toBeTruthy());
    fireEvent.press(screen.getByTestId("discover-pass"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/petmatches/decide",
        expect.objectContaining({ decision: "pass" })
      )
    );
  });

  it("moves to the next card after a decision", async () => {
    respondWith([candidate("pet-1", "Bo"), candidate("pet-2", "Milo")]);
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeTruthy());
    fireEvent.press(screen.getByTestId("discover-pass"));

    // One candidate deep, the card is still there; two decisions empties it.
    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeTruthy());
    fireEvent.press(screen.getByTestId("discover-pass"));
    await waitFor(() => expect(screen.getByTestId("discover-empty")).toBeTruthy());
  });

  it("celebrates a mutual match", async () => {
    respondWith([candidate("pet-1", "Bo")]);
    api.post.mockResolvedValue({
      data: { decision: "like", mutual: true, matchedPet: { _id: "pet-1", name: "Bo" } },
    });

    render(<DiscoverScreen navigation={navigation} />);
    await waitFor(() => expect(screen.getByTestId("discover-like")).toBeTruthy());
    fireEvent.press(screen.getByTestId("discover-like"));

    await waitFor(() => expect(screen.getByTestId("discover-match")).toBeTruthy());
  });

  it("does not celebrate a one-sided like", async () => {
    respondWith([candidate("pet-1", "Bo")]);
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-like")).toBeTruthy());
    fireEvent.press(screen.getByTestId("discover-like"));

    await waitFor(() => expect(screen.getByTestId("discover-empty")).toBeTruthy());
    expect(screen.queryByTestId("discover-match")).toBeNull();
  });

  it("puts a card back when saving the decision fails", async () => {
    respondWith([candidate("pet-1", "Bo")]);
    api.post.mockRejectedValue(new Error("offline"));

    render(<DiscoverScreen navigation={navigation} />);
    await waitFor(() => expect(screen.getByTestId("discover-like")).toBeTruthy());
    fireEvent.press(screen.getByTestId("discover-like"));

    // Advancing optimistically keeps the screen responsive, but a failed save
    // must not silently drop the pet.
    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeTruthy());
  });
});
