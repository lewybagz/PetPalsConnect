import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

import VaccinationBadge from "./VaccinationBadge";
import api from "../api/axios";
import { AppThemeProvider } from "../context/AppThemeContext";

jest.mock("../api/axios", () => ({ get: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));

/**
 * The pill a stranger reads before deciding to meet a dog. Its wording is the
 * trust boundary: "shared, owner-reported" and never "verified" or "safe".
 */

const renderBadge = (props) =>
  render(
    <AppThemeProvider>
      <VaccinationBadge {...props} />
    </AppThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("VaccinationBadge", () => {
  it.each([
    ["current", "Vaccinations shared"],
    ["expiringSoon", "Vaccinations shared"],
    ["partial", "Some vaccinations shared"],
    ["expired", "Vaccination records out of date"],
    ["unknown", "No vaccination info shared"],
  ])("describes %s as %s", async (status, label) => {
    await renderBadge({ status });

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText(/verified|safe/i)).toBeNull();
  });

  it("says a shared status is owner-reported, on the same line", async () => {
    await renderBadge({ status: "current" });

    expect(screen.getByText(/owner-reported/)).toBeTruthy();
    expect(screen.getByLabelText("Vaccinations shared, owner-reported")).toBeTruthy();
  });

  it("fetches the status when given only a pet", async () => {
    api.get.mockResolvedValue({ data: { status: "partial", shared: false } });
    await renderBadge({ petId: "pet-1" });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/pets/pet-1/health/status"));
    await waitFor(() => expect(screen.getByText("Some vaccinations shared")).toBeTruthy());
  });

  it("renders nothing until it knows, rather than a pill that says nothing", async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    await renderBadge({ petId: "pet-1" });

    expect(screen.queryByTestId("vaccination-badge")).toBeNull();
  });

  it("renders nothing when a fetch fails", async () => {
    api.get.mockRejectedValue(new Error("offline"));
    await renderBadge({ petId: "pet-1" });

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId("vaccination-badge")).toBeNull();
  });
});
