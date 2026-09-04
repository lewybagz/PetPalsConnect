import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Provider } from "react-redux";

import PetDetailsScreen from "./PetDetailsScreen";
import store from "../../redux/store";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));

/**
 * The junction screen: Discover and Home reach it from a card, and it is where
 * chat and playdate scheduling start.
 *
 * It destructured `const { pet } = route.params`, so it threw outright when a
 * caller had only an id - which both cards do - or when params were missing
 * entirely, which is what a deep link gives you.
 */

const navigation = { navigate: jest.fn() };
const pet = { _id: "pet-1", name: "Bo", breed: "Corgi", age: 2, weight: 25, photos: [] };

const renderScreen = (params) =>
  render(
    <Provider store={store}>
      <PetDetailsScreen route={{ params }} navigation={navigation} />
    </Provider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({ userId: "someone-else" });
  api.get.mockResolvedValue({ data: pet });
  api.post.mockResolvedValue({ data: { _id: "chat-1" } });
});

describe("PetDetailsScreen", () => {
  it("renders a pet passed in whole, without a fetch", async () => {
    renderScreen({ pet });

    await waitFor(() => expect(screen.getByTestId("pet-details")).toBeTruthy());
    expect(api.get).not.toHaveBeenCalled();
  });

  it("fetches when given only an id", async () => {
    renderScreen({ petId: "pet-1" });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/pets/pet-1"));
    await waitFor(() => expect(screen.getByTestId("pet-details")).toBeTruthy());
  });

  it("does not throw when it arrives with no params at all", async () => {
    // A push notification or a deep link opens the screen this way.
    renderScreen(undefined);

    await waitFor(() => expect(screen.getByTestId("pet-missing")).toBeTruthy());
  });

  it("opens a chat with the pet id and navigates with the chat's _id", async () => {
    renderScreen({ pet });
    await waitFor(() => expect(screen.getByTestId("pet-chat")).toBeTruthy());

    fireEvent.press(screen.getByTestId("pet-chat"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/chats/findOrCreate", {
        petId: "pet-1",
      })
    );
    // `data.chatId` is the hash the key is derived from, not the document id
    // ChatScreen needs to load or post messages.
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith("Chat", {
        pet,
        chatId: "chat-1",
      })
    );
  });

  it("favourites by pet id and lets the server own identity", async () => {
    renderScreen({ pet });
    await waitFor(() => expect(screen.getByTestId("pet-favorite")).toBeTruthy());

    fireEvent.press(screen.getByTestId("pet-favorite"));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/favorites", { content: "pet-1" })
    );
  });

  it("survives a pet with no photo", async () => {
    renderScreen({ pet: { ...pet, photos: undefined } });

    await waitFor(() => expect(screen.getByTestId("pet-details")).toBeTruthy());
  });
});

describe("owning the pet", () => {
  const mine = { ...pet, owner: "me" };

  it("offers photo management to the owner", async () => {
    useAuthSession.mockReturnValue({ userId: "me" });
    renderScreen({ pet: mine });

    await waitFor(() => expect(screen.getByTestId("pet-manage-photos")).toBeTruthy());
  });

  it("does not offer it to anyone else", async () => {
    useAuthSession.mockReturnValue({ userId: "someone-else" });
    renderScreen({ pet: mine });

    await waitFor(() => expect(screen.getByTestId("pet-details")).toBeTruthy());
    expect(screen.queryByTestId("pet-manage-photos")).toBeNull();
  });

  it("shows a carousel when the pet has photos", async () => {
    renderScreen({ pet: { ...pet, photos: ["https://a/1.jpg", "https://a/2.jpg"] } });

    await waitFor(() => expect(screen.getByTestId("pet-photo-carousel")).toBeTruthy());
  });
});
