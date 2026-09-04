import React from "react";
import { Alert } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import PetPhotosScreen from "./PetPhotosScreen";
import api from "../../api/axios";
import { addPetPhoto, deleteStoredPhoto } from "../../services/photos";

jest.mock("../../api/axios", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../../services/photos", () => ({
  PHOTO_LIMIT: 6,
  addPetPhoto: jest.fn(),
  deleteStoredPhoto: jest.fn(),
  makePrimary: (photos, url) => [url, ...photos.filter((photo) => photo !== url)],
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

/**
 * Managing a pet's photos, which the app could not do at all: a photo could
 * only be attached while the pet was being created, and that step is skippable
 * by design - so a skipped pet had no picture, permanently.
 */

const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const A = "https://firebasestorage.googleapis.com/v0/b/p/o/a.jpg";
const B = "https://firebasestorage.googleapis.com/v0/b/p/o/b.jpg";

const renderScreen = (params) =>
  render(<PetPhotosScreen route={{ params }} navigation={navigation} />);

const tapById = async (testID) => {
  const element = await waitFor(() => screen.getByTestId(testID));
  fireEvent.press(element);
};

beforeEach(() => {
  jest.clearAllMocks();
  api.put.mockResolvedValue({ data: {} });
  api.get.mockResolvedValue({ data: { _id: "pet-1", name: "Bo", photos: [] } });
  addPetPhoto.mockResolvedValue({ cancelled: false, url: B });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("PetPhotosScreen", () => {
  it("lists a pet's photos", async () => {
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [A, B] } });

    await waitFor(() => expect(screen.getByTestId("photo-0")).toBeTruthy());
    expect(screen.getByTestId("photo-1")).toBeTruthy();
  });

  it("says so when there are none", async () => {
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [] } });

    await waitFor(() => expect(screen.getByTestId("photos-empty")).toBeTruthy());
  });

  it("fetches the pet when given only an id", async () => {
    renderScreen({ petId: "pet-1" });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/pets/pet-1"));
  });

  it("uploads and saves a new photo", async () => {
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [A] } });

    await tapById("add-from-library");

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/api/pets/pet-1", { photos: [A, B] })
    );
  });

  it("takes one with the camera when asked", async () => {
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [] } });

    await tapById("add-from-camera");

    await waitFor(() =>
      expect(addPetPhoto).toHaveBeenCalledWith(expect.objectContaining({ fromCamera: true }))
    );
  });

  it("saves nothing when the picker is dismissed", async () => {
    addPetPhoto.mockResolvedValue({ cancelled: true, denied: false });
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [A] } });

    await tapById("add-from-library");

    await waitFor(() => expect(addPetPhoto).toHaveBeenCalled());
    expect(api.put).not.toHaveBeenCalled();
  });

  it("explains a refused permission", async () => {
    addPetPhoto.mockResolvedValue({ cancelled: true, denied: true });
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [] } });

    await tapById("add-from-library");

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(api.put).not.toHaveBeenCalled();
  });

  it("reorders so the chosen photo leads", async () => {
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [A, B] } });

    // The first photo is the one every card and list shows.
    await tapById("make-primary-1");

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/api/pets/pet-1", { photos: [B, A] })
    );
  });

  it("puts the list back if saving fails", async () => {
    api.put.mockRejectedValue(new Error("offline"));
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [A] } });

    await tapById("add-from-library");

    // The optimistic list must not keep a photo the server rejected.
    await waitFor(() => expect(screen.queryByTestId("photo-1")).toBeNull());
  });

  it("refuses to go past the limit", async () => {
    const many = Array.from(
      { length: 6 },
      (_, index) => `https://firebasestorage.googleapis.com/v0/b/p/o/${index}.jpg`
    );
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: many } });

    await tapById("add-from-library");

    expect(addPetPhoto).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });

  it("removes a photo from the record before deleting the file", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    renderScreen({ pet: { _id: "pet-1", name: "Bo", photos: [A, B] } });

    await tapById("remove-1");

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/api/pets/pet-1", { photos: [A] })
    );
    expect(deleteStoredPhoto).toHaveBeenCalledWith(B);
  });
});
