import React from "react";
import { Alert } from "react-native";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react-native";

import PetHealthScreen from "./PetHealthScreen";
import api from "../../api/axios";
import { addPetPhoto } from "../../services/photos";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock("../../services/photos", () => ({ addPetPhoto: jest.fn() }));
jest.mock("../../components/DateTimePickerComponent", () => () => null);
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

/**
 * The owner's vaccination records.
 *
 * The one rule this screen exists to keep: what an owner typed is shown as
 * what an owner typed. Nothing here may say "verified".
 */

const navigation = { goBack: jest.fn() };
const PET = { _id: "pet-1", name: "Bo" };
const CERT = "https://firebasestorage.googleapis.com/v0/b/p/o/cert.jpg";

const KINDS = ["rabies", "dhpp", "bordetella", "influenza", "leptospirosis", "other"];
const CORE = ["rabies", "dhpp", "bordetella"];

const health = (records, status = "unknown") => ({
  status,
  kinds: KINDS,
  coreKinds: CORE,
  records,
});

const record = (id, kind, extra = {}) => ({
  _id: id,
  kind,
  administeredAt: "2026-06-01T00:00:00.000Z",
  verification: "selfReported",
  ...extra,
});

const respond = (payload) => {
  api.get.mockImplementation((url) => {
    if (url.endsWith("/health")) return Promise.resolve({ data: payload });
    return Promise.resolve({ data: PET });
  });
};

const renderScreen = (params = { pet: PET }) =>
  render(
    <AppThemeProvider>
      <ToastProvider>
        <PetHealthScreen route={{ params }} navigation={navigation} />
      </ToastProvider>
    </AppThemeProvider>
  );

const tapById = async (testID) => {
  await fireEvent.press(await waitFor(() => screen.getByTestId(testID)));
};

beforeEach(() => {
  jest.clearAllMocks();
  respond(health([]));
  api.post.mockResolvedValue({ data: { record: {}, status: "partial" } });
  api.delete.mockResolvedValue({ data: { status: "unknown" } });
  addPetPhoto.mockResolvedValue({ cancelled: false, url: CERT });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("PetHealthScreen", () => {
  it("lists what is recorded, and never calls it verified", async () => {
    respond(
      health(
        [record("rec-1", "rabies", { verification: "documented", certificatePhoto: CERT })],
        "partial"
      )
    );
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("health-record-0")).toBeTruthy());
    // Scoped to the row: "Rabies" is also one of the chips in the add form.
    const row = within(screen.getByTestId("health-record-0"));
    expect(row.getByText("Rabies")).toBeTruthy();
    expect(row.getByText(/certificate attached/)).toBeTruthy();
    expect(screen.getByText(/Not all three are recorded yet/)).toBeTruthy();
    expect(screen.queryByText(/verified/i)).toBeNull();
  });

  it("says so when nothing is recorded", async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("health-empty")).toBeTruthy());
    expect(screen.getByText("Nothing recorded yet")).toBeTruthy();
    expect(screen.getByText(/certificate has the dates/)).toBeTruthy();
  });

  it("fetches the pet when a notification hands it only an id", async () => {
    await renderScreen({ petId: "pet-1" });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/pets/pet-1"));
    await waitFor(() => expect(screen.getByText("Bo's vaccinations")).toBeTruthy());
  });

  it("saves the chosen vaccine with no expiry unless one is given", async () => {
    await renderScreen();

    await tapById("health-kind-bordetella");
    await tapById("health-save");

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/pets/pet-1/health",
        expect.objectContaining({ kind: "bordetella", administeredAt: expect.any(String) })
      )
    );
    expect(api.post.mock.calls[0][1].expiresAt).toBeUndefined();
    expect(api.post.mock.calls[0][1].certificatePhoto).toBeUndefined();
  });

  it("asks for a due date only when the owner says they know it", async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("health-expiry-toggle")).toBeTruthy());
    expect(screen.queryByTestId("health-expiry")).toBeNull();

    await fireEvent(screen.getByTestId("health-expiry-toggle-switch"), "valueChange", true);

    await waitFor(() => expect(screen.getByTestId("health-expiry")).toBeTruthy());
  });

  it("attaches a certificate photo to the record", async () => {
    await renderScreen();

    await tapById("health-add-photo");
    await waitFor(() => expect(screen.getByTestId("health-certificate")).toBeTruthy());
    await tapById("health-save");

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/pets/pet-1/health",
        expect.objectContaining({ certificatePhoto: CERT })
      )
    );
    expect(addPetPhoto).toHaveBeenCalledWith(expect.objectContaining({ petId: "pet-1" }));
  });

  it("removes a record only after the owner confirms", async () => {
    respond(health([record("rec-1", "rabies")], "partial"));
    jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
    await renderScreen();

    await tapById("health-record-0");

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith("/api/pets/pet-1/health/rec-1")
    );
  });

  it("keeps a record the owner decides to keep", async () => {
    respond(health([record("rec-1", "rabies")], "partial"));
    await renderScreen();

    await tapById("health-record-0");

    expect(Alert.alert).toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });
});
