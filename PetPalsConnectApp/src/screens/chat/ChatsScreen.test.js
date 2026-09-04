import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import ChatsScreen from "./ChatsScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";

jest.mock("../../api/axios", () => ({ get: jest.fn() }));
jest.mock("../../components/ChatCardComponent", () => {
  const { Text, Pressable } = require("react-native");
  const MockChatCard = ({ chat, onPress }) => (
    <Pressable testID={`chat-${chat._id}`} onPress={onPress}>
      <Text>{chat._id}</Text>
    </Pressable>
  );
  return MockChatCard;
});

/**
 * The inbox.
 *
 * `keyExtractor={(item) => item.id}` read a field Mongo does not serialise, so
 * every key was `undefined` and list recycling put the wrong conversation
 * behind the wrong name after a refresh. The screen also fetched a token by
 * hand to set a header the shared client has always set.
 */

const navigation = { navigate: jest.fn() };

const chat = (id) => ({
  _id: id,
  participants: [{ _id: "u1", username: "sam" }],
  lastMessage: { contentText: "Hello" },
});

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <ChatsScreen navigation={navigation} />
    </AppThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: [] });
});

describe("ChatsScreen", () => {
  it("shows skeleton rows while loading, not a bare spinner", async () => {
    let resolve;
    api.get.mockReturnValue(new Promise((r) => { resolve = r; }));

    await renderScreen();

    // A list of rows is the most predictable structure in the app.
    expect(screen.getByTestId("chats-loading")).toBeTruthy();
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);

    resolve({ data: [] });
    await waitFor(() => expect(screen.queryByTestId("chats-loading")).toBeNull());
  });

  it("does not send its own Authorization header", async () => {
    await renderScreen();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/chats"));
  });

  it("lists conversations", async () => {
    api.get.mockResolvedValue({ data: [chat("c1"), chat("c2")] });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("chat-c1")).toBeTruthy());
    expect(screen.getByTestId("chat-c2")).toBeTruthy();
  });

  it("opens a conversation by its document id", async () => {
    api.get.mockResolvedValue({ data: [chat("c1")] });
    await renderScreen();

    await fireEvent.press(await waitFor(() => screen.getByTestId("chat-c1")));

    // `chat.id` is undefined on a Mongo document; the route wants `_id`.
    expect(navigation.navigate).toHaveBeenCalledWith("ChatDetails", { chatId: "c1" });
  });

  it("offers a way out of the empty state instead of a bare sentence", async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("chats-empty-state")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("chats-empty-state-action"));

    expect(navigation.navigate).toHaveBeenCalledWith("Discover");
  });

  it("distinguishes a failure from an empty inbox, and can retry", async () => {
    api.get.mockRejectedValue(new Error("offline"));
    await renderScreen();

    // Both used to render as the same centred sentence.
    await waitFor(() => expect(screen.getByTestId("chats-error-state")).toBeTruthy());

    api.get.mockResolvedValue({ data: [chat("c1")] });
    await fireEvent.press(screen.getByTestId("chats-error-state-action"));

    await waitFor(() => expect(screen.getByTestId("chat-c1")).toBeTruthy());
  });

  it("survives a response that is not a list", async () => {
    api.get.mockResolvedValue({ data: { message: "nope" } });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("chats-empty-state")).toBeTruthy());
  });
});
