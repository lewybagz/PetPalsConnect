import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import HelpSupportScreen from "./HelpSupportScreen";
import { fetchHelp } from "../../api/help";
import { fetchSpotStatus } from "../../api/spot";
import { resetSpotEnabled } from "../../hooks/useSpotEnabled";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../api/help", () => ({ ...jest.requireActual("../../api/help"), fetchHelp: jest.fn() }));
jest.mock("../../api/spot", () => ({ fetchSpotStatus: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

/**
 * The help screen shows the server's table, grouped, with the screen each
 * answer points at one tap away - and says so when the table could not load
 * rather than showing nothing.
 */

const navigation = { navigate: jest.fn() };
const table = {
  topics: { discover: "Finding pals", spot: "Spot" },
  entries: [
    { id: "deck-empty-region", topic: "discover", question: "Why is my deck empty?", answer: "PetPals is open in Arizona first.", screen: "DiscoveryPreferences" },
    { id: "spot-what", topic: "spot", question: "What can Spot do?", answer: "Answer questions about your pets.", screen: null },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  resetSpotEnabled();
  fetchSpotStatus.mockResolvedValue({ enabled: true, consented: true, quota: null });
});

test("renders the table grouped by topic, and Open goes to the entry's screen", async () => {
  fetchHelp.mockResolvedValue({ ...table, stale: false });
  await render(<HelpSupportScreen navigation={navigation} />);
  await waitFor(() => expect(screen.getByTestId("help-deck-empty-region")).toBeTruthy());
  expect(screen.getByText("Finding pals")).toBeTruthy();
  expect(screen.getByText("PetPals is open in Arizona first.")).toBeTruthy();
  expect(screen.getByTestId("help-topic-spot")).toBeTruthy();
  expect(screen.queryByTestId("help-open-spot-what")).toBeNull();
  await fireEvent.press(screen.getByTestId("help-open-deck-empty-region"));
  expect(navigation.navigate).toHaveBeenCalledWith("DiscoveryPreferences");
});

test("Ask Spot prefills the obvious question", async () => {
  fetchHelp.mockResolvedValue({ ...table, stale: false });
  await render(<HelpSupportScreen navigation={navigation} />);
  await waitFor(() => expect(screen.getByTestId("ask-spot")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("ask-spot"));
  expect(navigation.navigate).toHaveBeenCalledWith("Spot", {
    context: { screen: "help" },
    prefill: "How does PetPals work?",
  });
});

test("nothing loaded is a sentence, not a blank", async () => {
  fetchHelp.mockResolvedValue({ topics: {}, entries: [], stale: true });
  await render(<HelpSupportScreen navigation={navigation} />);
  await waitFor(() => expect(screen.getByTestId("help-empty")).toBeTruthy());
});
