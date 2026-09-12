import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import LostPetScreen from "./LostPetScreen";
import { fetchLostPet } from "../../api/lostPet";

jest.mock("../../api/lostPet", () => ({ fetchLostPet: jest.fn() }));

const navigation = { navigate: jest.fn() };

const STEPS = [
  {
    id: "check-chip",
    title: "Check the microchip registration first",
    body: "A chip only works if the registry has a phone number that still reaches you.",
    source: { name: "AAHA universal chip lookup", url: "https://example.test/aaha" },
  },
  {
    id: "search-close",
    title: "Search close to home, and at night",
    body: "Most cats and many frightened dogs are found within a few houses of home.",
    source: { name: "ASPCA", url: "https://example.test/aspca" },
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  fetchLostPet.mockResolvedValue({
    steps: STEPS,
    contacts: [],
    identification: [{ petId: "pet-1", petName: "Sky", kind: "microchip", label: "985141000123456" }],
    stale: false,
  });
});

test("the owner's own chip number is on screen, above the advice that needs it", async () => {
  await render(<LostPetScreen navigation={navigation} />);

  await waitFor(() => expect(screen.getByTestId("lost-pet-identification")).toBeTruthy());
  expect(screen.getByText("985141000123456")).toBeTruthy();
  expect(screen.getByText(/Sky · Microchip/)).toBeTruthy();
});

test("the steps are numbered and cite their source", async () => {
  await render(<LostPetScreen navigation={navigation} />);

  await waitFor(() => expect(screen.getByTestId("lost-pet-step-check-chip")).toBeTruthy());
  expect(screen.getByText("STEP 1")).toBeTruthy();
  expect(screen.getByText("STEP 2")).toBeTruthy();
  expect(screen.getByTestId("lost-pet-source-check-chip")).toBeTruthy();
});

test("no chip recorded says why that matters rather than showing nothing", async () => {
  fetchLostPet.mockResolvedValue({ steps: STEPS, contacts: [], identification: [], stale: false });

  await render(<LostPetScreen navigation={navigation} />);

  await waitFor(() => expect(screen.getByTestId("lost-pet-add-chip")).toBeTruthy());
  expect(screen.getByText(/single thing most likely to bring a pet home/)).toBeTruthy();
});

test("a failed load still leaves somewhere useful to start", async () => {
  fetchLostPet.mockResolvedValue({ steps: [], contacts: [], identification: [], stale: true });

  await render(<LostPetScreen navigation={navigation} />);

  await waitFor(() => expect(screen.getByTestId("lost-pet-empty")).toBeTruthy());
  expect(screen.getByText(/Ring the shelters and vets near you/)).toBeTruthy();
});

test("it offers the vet list rather than being a dead end", async () => {
  await render(<LostPetScreen navigation={navigation} />);

  await waitFor(() => expect(screen.getByTestId("lost-pet-find-vets")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("lost-pet-find-vets"));

  expect(navigation.navigate).toHaveBeenCalledWith("Care");
});

test("it never claims other users are looking", async () => {
  /**
   * There is no broadcast and no map of lost pets here. Implying a search
   * party exists when it does not would be worse than the honest checklist.
   */
  const { toJSON } = await render(<LostPetScreen navigation={navigation} />);
  await waitFor(() => expect(screen.getByTestId("lost-pet-step-check-chip")).toBeTruthy());

  const rendered = JSON.stringify(toJSON());
  expect(rendered).not.toMatch(/alert nearby|notify nearby|nearby users|broadcast/i);
});
