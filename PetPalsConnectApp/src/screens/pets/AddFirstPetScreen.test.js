import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import AddFirstPetScreen from "./AddFirstPetScreen";
import { useAuthSession } from "../../context/AuthSessionContext";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));
jest.mock("../../services/photos", () => ({ addPetPhoto: jest.fn() }));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));

/**
 * The last step of onboarding, and the form every new user meets.
 *
 * `AddPetScreen` has a test asserting its payload against its form - added
 * after three fields were found being collected and never sent - and this
 * screen, which far more people actually see, had none at all. Same gate,
 * for the form that matters more.
 *
 * The species rules are the substance here: the form asks a different set of
 * questions per species, and `canSubmit` has to agree with what is on screen
 * or somebody is left with a button that never enables and no way to tell why.
 */
const renderScreen = (session = {}) => {
  useAuthSession.mockReturnValue({
    createPet: jest.fn().mockResolvedValue({ _id: "pet-1" }),
    skipPetSetup: jest.fn(),
    signOut: jest.fn(),
    ...session,
  });

  return render(
    <AppThemeProvider>
      <ToastProvider>
        <AddFirstPetScreen />
      </ToastProvider>
    </AppThemeProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AddFirstPetScreen", () => {
  it("sends exactly what a dog owner filled in", async () => {
    const createPet = jest.fn().mockResolvedValue({ _id: "pet-1" });
    await renderScreen({ createPet });

    await fireEvent.changeText(screen.getByPlaceholderText("Rex"), "  Bella  ");
    await fireEvent.press(screen.getByTestId("breed-picker"));
    await fireEvent.press(await screen.findByText("Beagle"));
    await fireEvent.changeText(screen.getByPlaceholderText("3"), "4");
    await fireEvent.changeText(screen.getByPlaceholderText("25"), "30");

    await fireEvent.press(screen.getByText("Finish setting up"));

    await waitFor(() => expect(createPet).toHaveBeenCalledTimes(1));
    expect(createPet).toHaveBeenCalledWith({
      // Trimmed, because a name with spaces round it is a name somebody typed
      // carelessly, not a different pet.
      name: "Bella",
      species: "dog",
      breed: "Beagle",
      age: 4,
      weight: 30,
      photos: [],
    });
  });

  it("converts a weight entered in kilograms to the pounds the schema stores", async () => {
    const createPet = jest.fn().mockResolvedValue({ _id: "pet-1" });
    await renderScreen({ createPet });

    await fireEvent.changeText(screen.getByPlaceholderText("Rex"), "Otto");
    await fireEvent.press(screen.getByTestId("breed-picker"));
    await fireEvent.press(await screen.findByText("Beagle"));
    await fireEvent.changeText(screen.getByPlaceholderText("3"), "2");
    await fireEvent.press(screen.getByText("kg"));
    await fireEvent.changeText(screen.getByPlaceholderText("12"), "10");

    await fireEvent.press(screen.getByText("Finish setting up"));

    // Matching compares two pets' numbers, so a stored unit would make two
    // pets incomparable if their owners chose differently.
    await waitFor(() => expect(createPet).toHaveBeenCalledTimes(1));
    expect(createPet.mock.calls[0][0].weight).toBeCloseTo(22.0, 1);
  });

  it("omits breed and weight for a species the schema does not ask them of", async () => {
    const createPet = jest.fn().mockResolvedValue({ _id: "pet-1" });
    await renderScreen({ createPet });

    await fireEvent.press(screen.getByTestId("species-fish"));
    await fireEvent.changeText(screen.getByPlaceholderText("Rex"), "Bubbles");
    await fireEvent.changeText(screen.getByPlaceholderText("3"), "1");

    await fireEvent.press(screen.getByText("Finish setting up"));

    await waitFor(() => expect(createPet).toHaveBeenCalledTimes(1));
    const payload = createPet.mock.calls[0][0];
    expect(payload.species).toBe("fish");
    // Sent as undefined rather than empty: the schema requires them only for
    // dogs and cats, and an empty string is not the same as "not asked".
    expect(payload.breed).toBeUndefined();
    expect(payload.weight).toBeUndefined();
  });

  it("says up front that a non-dog will not appear in matching", async () => {
    await renderScreen();

    expect(screen.queryByTestId("species-not-matchable")).toBeNull();

    await fireEvent.press(screen.getByTestId("species-cat"));

    // Said here rather than discovered later on an empty Discover tab.
    expect(screen.getByTestId("species-not-matchable")).toBeTruthy();
  });

  it("clears breed and weight when the species changes", async () => {
    const createPet = jest.fn().mockResolvedValue({ _id: "pet-1" });
    await renderScreen({ createPet });

    await fireEvent.press(screen.getByTestId("breed-picker"));
    await fireEvent.press(await screen.findByText("Beagle"));
    expect(screen.getByText("Beagle")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("species-cat"));

    // A Labrador breed must not survive a change to another species.
    expect(screen.queryByText("Beagle")).toBeNull();
    expect(screen.getByText("Choose a breed")).toBeTruthy();
  });

  it("will not submit a dog with no breed", async () => {
    const createPet = jest.fn();
    await renderScreen({ createPet });

    await fireEvent.changeText(screen.getByPlaceholderText("Rex"), "Nameless");
    await fireEvent.changeText(screen.getByPlaceholderText("3"), "3");
    await fireEvent.changeText(screen.getByPlaceholderText("25"), "20");

    await fireEvent.press(screen.getByText("Finish setting up"));

    expect(createPet).not.toHaveBeenCalled();
  });

  it("rejects an age outside the range it accepts, and says so", async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText("3"), "99");

    expect(screen.getByText(/between 0 and 40/)).toBeTruthy();
  });
});
