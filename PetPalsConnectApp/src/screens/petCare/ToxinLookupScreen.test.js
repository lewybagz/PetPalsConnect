import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import ToxinLookupScreen from "./ToxinLookupScreen";
import { fetchToxins } from "../../api/toxins";

jest.mock("../../api/toxins", () => {
  const actual = jest.requireActual("../../api/toxins");
  return { ...actual, fetchToxins: jest.fn() };
});

const TOXINS = [
  {
    slug: "grapes-raisins",
    name: "Grapes, raisins and currants",
    aliases: ["grape", "raisin"],
    species: ["dog"],
    severity: "emergency",
    signs: "Vomiting, lethargy, loss of appetite.",
    guidance: "Can cause sudden kidney failure in dogs. Ring the helpline.",
    sources: [{ name: "ASPCA Animal Poison Control Center", url: "https://example.test/a", year: 2025 }],
  },
  {
    slug: "caffeine",
    name: "Caffeine",
    aliases: ["coffee", "tea"],
    species: ["dog", "cat"],
    severity: "call",
    signs: "Restlessness, a fast heart rate, tremors.",
    guidance: "Pets are more sensitive to it than people are.",
    sources: [{ name: "Pet Poison Helpline", url: "https://example.test/b", year: 2025 }],
  },
];

const CONTACTS = [
  {
    id: "aspca-apcc",
    name: "ASPCA Animal Poison Control Center",
    phone: "888-426-4435",
    region: "US",
    note: "24/7. A consultation fee may apply.",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  fetchToxins.mockResolvedValue({ toxins: TOXINS, contacts: CONTACTS, stale: false });
});

test("the numbers to ring are there before anybody types anything", async () => {
  await render(<ToxinLookupScreen />);

  await waitFor(() => expect(screen.getByTestId("toxin-contacts")).toBeTruthy());
  expect(screen.getByTestId("toxin-call-aspca-apcc")).toBeTruthy();
  expect(screen.getByText("888-426-4435")).toBeTruthy();
});

test("tapping a contact dials it", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await render(<ToxinLookupScreen />);

  await waitFor(() => expect(screen.getByTestId("toxin-call-aspca-apcc")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("toxin-call-aspca-apcc"));

  expect(open).toHaveBeenCalledWith("tel:8884264435");
});

test("searching narrows to the entry and shows its source", async () => {
  await render(<ToxinLookupScreen />);
  await waitFor(() => expect(screen.getByTestId("toxin-grapes-raisins")).toBeTruthy());

  await fireEvent.changeText(screen.getByTestId("toxin-search"), "grape");

  await waitFor(() => expect(screen.queryByTestId("toxin-caffeine")).toBeNull());
  expect(screen.getByTestId("toxin-grapes-raisins")).toBeTruthy();
  expect(screen.getByText(/ASPCA Animal Poison Control Center \(2025\)/)).toBeTruthy();
});

test("a miss says so and still points at the helpline", async () => {
  await render(<ToxinLookupScreen />);
  await waitFor(() => expect(screen.getByTestId("toxin-grapes-raisins")).toBeTruthy());

  await fireEvent.changeText(screen.getByTestId("toxin-search"), "banana");

  await waitFor(() => expect(screen.getByTestId("toxin-no-match")).toBeTruthy());
  expect(screen.getByText(/That does not mean it is safe/)).toBeTruthy();
  // The numbers never leave the screen.
  expect(screen.getByTestId("toxin-call-aspca-apcc")).toBeTruthy();
});

test("the screen never asks how much was eaten", async () => {
  /**
   * The rule from CLAUDE.md: no triage, no dose. "How much" is the judgement
   * the helpline exists to make, and a question about it here would be this
   * screen quietly practising medicine.
   */
  const { toJSON } = await render(<ToxinLookupScreen />);
  await waitFor(() => expect(screen.getByTestId("toxin-grapes-raisins")).toBeTruthy());

  const rendered = JSON.stringify(toJSON());
  expect(rendered).not.toMatch(/how much/i);
  expect(rendered).not.toMatch(/mg\s*\/\s*kg/i);
  expect(rendered).not.toMatch(/\bdose\b/i);
  expect(rendered).not.toMatch(/should I worry/i);
});

test("a cached copy is shown rather than an error when the network is gone", async () => {
  fetchToxins.mockResolvedValue({ toxins: TOXINS, contacts: CONTACTS, stale: true });

  await render(<ToxinLookupScreen />);

  await waitFor(() => expect(screen.getByTestId("toxin-grapes-raisins")).toBeTruthy());
  expect(screen.getByText("Showing the copy saved on this device.")).toBeTruthy();
});

test("a total failure still leaves a way to ring somebody", async () => {
  fetchToxins.mockRejectedValue(new Error("offline"));

  await render(<ToxinLookupScreen />);

  await waitFor(() => expect(screen.getByTestId("toxin-contacts")).toBeTruthy());
  expect(screen.getByText(/Contact your vet/)).toBeTruthy();
});
