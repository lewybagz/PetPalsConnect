import React from "react";
import { Alert } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import DiscoverScreen from "./DiscoverScreen";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";
import { blockUser } from "../../api/safety";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({
  useAuthSession: jest.fn(),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock("../../api/safety", () => ({ blockUser: jest.fn() }));

/**
 * The app's core loop, which did not exist before: browse candidates, say yes
 * or no, and find out when it is mutual.
 */

const navigation = { navigate: jest.fn() };

const candidate = (id, name, extra = {}) => ({
  pet: {
    _id: id,
    name,
    breed: "Beagle",
    age: 4,
    weight: 25,
    photos: [],
    owner: extra.owner ?? `owner-of-${id}`,
  },
  score: 78,
  breakdown: { temperament: 27, size: 23, activities: 5, breed: 4, age: 2 },
  ...extra,
});

const respondWith = (candidates, pet = { _id: "mine", name: "Rex" }, extra = {}) => {
  api.get.mockResolvedValue({
    data: { pet, candidates, threshold: 45, range: null, locationKnown: true, ...extra },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  useAuthSession.mockReturnValue({ hasPet: true });
  api.post.mockResolvedValue({ data: { decision: "like", mutual: false } });
  blockUser.mockResolvedValue({});
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

  it("says how far away a candidate is", async () => {
    respondWith([candidate("pet-1", "Bo", { distanceMiles: 2.4 })]);
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-distance")).toBeTruthy());
  });

  it("says nothing about distance when nobody knows", async () => {
    respondWith([candidate("pet-1", "Bo", { distanceMiles: null })]);
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-card")).toBeTruthy());
    expect(screen.queryByTestId("discover-distance")).toBeNull();
  });

  it("nudges about location when the deck is empty and we do not know where they are", async () => {
    respondWith([], { _id: "mine", name: "Rex" }, { locationKnown: false });
    render(<DiscoverScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByTestId("discover-location-hint")).toBeTruthy());
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

describe("safety, from the card", () => {
  const tapById = async (id) => {
    const element = await waitFor(() => screen.getByTestId(id));
    await fireEvent.press(element);
  };

  const pressAlertButton = (label) => {
    const [, , buttons] = Alert.alert.mock.calls.at(-1);
    return buttons.find((entry) => entry.text === label).onPress();
  };

  it("offers block and report on the card", async () => {
    respondWith([candidate("pet-1", "Bo")]);
    await render(<DiscoverScreen navigation={navigation} />);

    await tapById("discover-safety");

    // Discover is where you meet a stranger, and it had neither affordance.
    expect(screen.getByTestId("discover-safety-block")).toBeTruthy();
    expect(screen.getByTestId("discover-safety-report")).toBeTruthy();
  });

  it("blocks the pet's owner, not the pet", async () => {
    respondWith([candidate("pet-1", "Bo", { owner: "owner-1" })]);
    await render(<DiscoverScreen navigation={navigation} />);

    await tapById("discover-safety");
    await tapById("discover-safety-block");
    await pressAlertButton("Block");

    await waitFor(() => expect(blockUser).toHaveBeenCalledWith("owner-1"));
  });

  it("takes every pet of a blocked owner out of the deck", async () => {
    respondWith([
      candidate("pet-1", "Bo", { owner: "owner-1" }),
      candidate("pet-2", "Rex", { owner: "owner-1" }),
      candidate("pet-3", "Sky", { owner: "owner-2" }),
    ]);
    await render(<DiscoverScreen navigation={navigation} />);

    await tapById("discover-safety");
    await tapById("discover-safety-block");
    await pressAlertButton("Block");

    // Their second dog coming back next reads as the block having failed.
    await waitFor(() => expect(screen.getByText("Sky")).toBeTruthy());
  });
});
