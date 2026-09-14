import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

import ChatDetailsScreen from "./ChatDetailsScreen";
import api from "../../api/axios";
import { useSettings } from "../../context/SettingsContext";
import { fetchSpotStatus } from "../../api/spot";
import { resetSpotEnabled } from "../../hooks/useSpotEnabled";

jest.mock("../../api/axios", () => ({ get: jest.fn() }));
jest.mock("../../../utils/tokenutil", () => ({ getStoredToken: jest.fn(async () => "t") }));
jest.mock("../../context/SettingsContext", () => ({ useSettings: jest.fn() }));
jest.mock("../../api/spot", () => ({ fetchSpotStatus: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

/**
 * The one entry point Spot has into a conversation with another person, and
 * it exists only while the owner has said Spot may read their chats. The
 * other person in the chat has not agreed to anything, which is why the
 * setting starts off and why this button is not there by default.
 */

const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}) };
const route = { params: { chatId: "chat-1", isGroupChat: false } };

beforeEach(() => {
  jest.clearAllMocks();
  resetSpotEnabled();
  fetchSpotStatus.mockResolvedValue({ enabled: true, consented: true, quota: null });
  api.get.mockResolvedValue({ data: { participants: [], messages: [], media: [] } });
});

test("with the setting off there is no way to ask Spot about a chat", async () => {
  useSettings.mockReturnValue({ settings: { spot: { readChats: false } } });
  await render(<ChatDetailsScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  await waitFor(() => expect(fetchSpotStatus).toHaveBeenCalledTimes(0));
  expect(screen.queryByTestId("ask-spot")).toBeNull();
});

test("with the setting on, Ask Spot carries the chat", async () => {
  useSettings.mockReturnValue({ settings: { spot: { readChats: true } } });
  await render(<ChatDetailsScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("ask-spot")).toBeTruthy());
});

test("a group chat never gets one, whatever the setting says", async () => {
  useSettings.mockReturnValue({ settings: { spot: { readChats: true } } });
  await render(
    <ChatDetailsScreen navigation={navigation} route={{ params: { chatId: "g-1", isGroupChat: true } }} />
  );
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(screen.queryByTestId("ask-spot")).toBeNull();
});
