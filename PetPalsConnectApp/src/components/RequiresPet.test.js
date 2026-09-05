import React from "react";
import { Text } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import { RequiresPet, withRequiredPet } from "./RequiresPet";
import { useAuthSession } from "../context/AuthSessionContext";

jest.mock("../context/AuthSessionContext", () => ({
  useAuthSession: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

/**
 * Queries go through testIDs and `waitFor`. In this React 19 / RTL combination
 * text queries and the value returned by `render` do not resolve reliably,
 * while testID lookups inside waitFor do.
 */

const Protected = () => <Text testID="protected">Matching content</Text>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RequiresPet", () => {
  it("renders the screen when the user has a pet", async () => {
    useAuthSession.mockReturnValue({ hasPet: true });

    render(
      <RequiresPet>
        <Protected />
      </RequiresPet>
    );

    await waitFor(() => expect(screen.getByTestId("protected")).toBeTruthy());
    expect(screen.queryByTestId("requires-pet-empty-state")).toBeNull();
  });

  it("hides the screen and prompts when there is no pet", async () => {
    // Adding a pet is optional, so reaching the app does not guarantee one.
    useAuthSession.mockReturnValue({ hasPet: false });

    render(
      <RequiresPet>
        <Protected />
      </RequiresPet>
    );

    await waitFor(() =>
      expect(screen.getByTestId("requires-pet-empty-state")).toBeTruthy()
    );
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("offers a route to adding a pet rather than a dead end", async () => {
    useAuthSession.mockReturnValue({ hasPet: false });

    render(
      <RequiresPet>
        <Protected />
      </RequiresPet>
    );

    const button = await waitFor(() => screen.getByTestId("requires-pet-add-button"));
    fireEvent.press(button);

    expect(mockNavigate).toHaveBeenCalledWith("AddPet");
  });

  it("shows screen-specific copy when given some", async () => {
    useAuthSession.mockReturnValue({ hasPet: false });

    render(
      <RequiresPet title="Add a pet to start matching" message="Because reasons.">
        <Protected />
      </RequiresPet>
    );

    await waitFor(() =>
      expect(screen.getByTestId("requires-pet-title")).toHaveTextContent(
        "Add a pet to start matching"
      )
    );
    expect(screen.getByTestId("requires-pet-message")).toHaveTextContent("Because reasons.");
  });

  it("falls back to default copy when none is given", async () => {
    useAuthSession.mockReturnValue({ hasPet: false });

    render(
      <RequiresPet>
        <Protected />
      </RequiresPet>
    );

    await waitFor(() =>
      expect(screen.getByTestId("requires-pet-title")).toHaveTextContent("Add a pet first")
    );
  });
});

describe("RequiresPet with a species", () => {
  /**
   * The case this exists for: a profile can hold a cat so the care hub has
   * something to work from, but playdates are dogs only. Gating on `hasPet`
   * would let a cat owner into a deck that is permanently empty, with nothing
   * on screen explaining why.
   */
  it("gates a dog-only screen on hasDog, not hasPet", async () => {
    useAuthSession.mockReturnValue({ hasPet: true, hasDog: false });

    render(
      <RequiresPet species="dog">
        <Protected />
      </RequiresPet>
    );

    await waitFor(() =>
      expect(screen.getByTestId("requires-pet-empty-state")).toBeTruthy()
    );
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("lets a dog owner through a dog-only screen", async () => {
    useAuthSession.mockReturnValue({ hasPet: true, hasDog: true });

    render(
      <RequiresPet species="dog">
        <Protected />
      </RequiresPet>
    );

    await waitFor(() => expect(screen.getByTestId("protected")).toBeTruthy());
  });

  it("still admits a cat owner to a screen that takes any pet", async () => {
    useAuthSession.mockReturnValue({ hasPet: true, hasDog: false });

    render(
      <RequiresPet>
        <Protected />
      </RequiresPet>
    );

    await waitFor(() => expect(screen.getByTestId("protected")).toBeTruthy());
  });

  it("asks for a dog by name on a dog-only screen", async () => {
    // "Add my pet" reads as a bug to somebody who has already added a cat.
    useAuthSession.mockReturnValue({ hasPet: true, hasDog: false });

    render(
      <RequiresPet species="dog">
        <Protected />
      </RequiresPet>
    );

    await waitFor(() =>
      expect(screen.getByTestId("requires-pet-add-button")).toHaveTextContent("Add my dog")
    );
  });
});

describe("withRequiredPet", () => {
  it("passes props through to the wrapped screen", async () => {
    useAuthSession.mockReturnValue({ hasPet: true });

    const Screen = ({ label }) => <Text testID="label">{label}</Text>;
    const Wrapped = withRequiredPet(Screen);

    render(<Wrapped label="from props" />);

    await waitFor(() =>
      expect(screen.getByTestId("label")).toHaveTextContent("from props")
    );
  });

  it("gates the wrapped screen when there is no pet", async () => {
    useAuthSession.mockReturnValue({ hasPet: false, hasDog: false });

    const Wrapped = withRequiredPet(Protected, { title: "Nope" });
    render(<Wrapped />);

    await waitFor(() => expect(screen.getByTestId("requires-pet-title")).toHaveTextContent("Nope"));
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("keeps a readable display name for debugging", () => {
    const Wrapped = withRequiredPet(Protected);
    expect(Wrapped.displayName).toBe("withRequiredPet(Protected)");
  });
});
