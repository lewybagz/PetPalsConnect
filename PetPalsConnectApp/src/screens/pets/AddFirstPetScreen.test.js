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
    await fireEvent.press(screen.getByTestId("stage-adult"));
    await fireEvent.changeText(screen.getByPlaceholderText("25"), "30");

    await fireEvent.press(screen.getByText("Finish setting up"));

    await waitFor(() => expect(createPet).toHaveBeenCalledTimes(1));
    expect(createPet).toHaveBeenCalledWith({
      // Trimmed, because a name with spaces round it is a name somebody typed
      // carelessly, not a different pet.
      name: "Bella",
      species: "dog",
      breed: "Beagle",
      // The midpoint of the dog adult band (2-7), not a number the owner
      // invented to get past a required field.
      age: 5,
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
    await fireEvent.press(screen.getByTestId("stage-adult"));
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
    await fireEvent.press(screen.getByTestId("stage-young"));

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
    await fireEvent.press(screen.getByTestId("stage-adult"));
    await fireEvent.changeText(screen.getByPlaceholderText("25"), "20");

    await fireEvent.press(screen.getByText("Finish setting up"));

    expect(createPet).not.toHaveBeenCalled();
  });

  it("offers a stage rather than a number, with the bands named", async () => {
    await renderScreen();

    // Plenty of adopted dogs have no known birthday, and a required number
    // field asks their owner to invent one that then reaches the matcher.
    expect(screen.getByTestId("stage-young")).toBeTruthy();
    expect(screen.getByText("Puppy")).toBeTruthy();
    expect(screen.getByText("Under 2")).toBeTruthy();
    expect(screen.getByText("8+")).toBeTruthy();
    expect(screen.queryByTestId("pet-age")).toBeNull();
  });

  it("names the bands for the species that is selected", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("species-cat"));

    // A cat is an adult at one and a senior at eleven, not two and eight.
    expect(screen.getByText("Under 1")).toBeTruthy();
    expect(screen.getByText("11+")).toBeTruthy();
    expect(screen.getByText("Young")).toBeTruthy();
  });

  it("sends the exact age when somebody knows it", async () => {
    const createPet = jest.fn().mockResolvedValue({ _id: "pet-1" });
    await renderScreen({ createPet });

    await fireEvent.changeText(screen.getByPlaceholderText("Rex"), "Bella");
    await fireEvent.press(screen.getByTestId("breed-picker"));
    await fireEvent.press(await screen.findByText("Beagle"));
    await fireEvent.press(screen.getByTestId("age-use-exact"));
    await fireEvent.changeText(screen.getByTestId("pet-age"), "7");
    await fireEvent.changeText(screen.getByPlaceholderText("25"), "30");

    await fireEvent.press(screen.getByText("Finish setting up"));

    await waitFor(() => expect(createPet).toHaveBeenCalledTimes(1));
    expect(createPet.mock.calls[0][0].age).toBe(7);
  });

  it("still rejects an exact age outside the range it accepts", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("age-use-exact"));
    await fireEvent.changeText(screen.getByTestId("pet-age"), "99");

    expect(screen.getByText(/between 0 and 40/)).toBeTruthy();
  });

  it("will not submit with no age answered at all", async () => {
    const createPet = jest.fn();
    await renderScreen({ createPet });

    await fireEvent.changeText(screen.getByPlaceholderText("Rex"), "Ghost");
    await fireEvent.press(screen.getByTestId("breed-picker"));
    await fireEvent.press(await screen.findByText("Beagle"));
    await fireEvent.changeText(screen.getByPlaceholderText("25"), "20");

    await fireEvent.press(screen.getByText("Finish setting up"));

    // Unknown is a real state the care hub handles, but it has to be chosen -
    // `lifeStage` returns null rather than guessing, and a pick that depends
    // on a stage is then left out.
    expect(createPet).not.toHaveBeenCalled();
  });

  it("clears a chosen stage when the species changes", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("stage-adult"));
    await fireEvent.press(screen.getByTestId("species-cat"));

    // The bands differ per species, so "adult" does not mean the same thing.
    const adult = screen.getByTestId("stage-adult");
    expect(adult.props.accessibilityState.selected).toBe(false);
  });
});
