import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import PetWeightScreen from "./PetWeightScreen";
import { fetchWeights, addWeight } from "../../api/weight";

jest.mock("../../api/weight", () => {
  const actual = jest.requireActual("../../api/weight");
  return {
    ...actual,
    fetchWeights: jest.fn(),
    addWeight: jest.fn(),
    removeWeight: jest.fn(),
  };
});

const navigation = { navigate: jest.fn() };
const pet = { _id: "pet-1", name: "Bo", species: "dog" };
const route = { params: { pet, petId: "pet-1" } };

const entry = (pounds, daysAgo, extra = {}) => ({
  _id: `w-${pounds}`,
  pounds,
  takenAt: new Date(Date.now() - daysAgo * 864e5).toISOString(),
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  fetchWeights.mockResolvedValue({ measured: true, entries: [] });
  addWeight.mockResolvedValue({ _id: "w-new" });
});

test("an empty history invites a first weigh-in rather than showing an error", async () => {
  await render(<PetWeightScreen navigation={navigation} route={route} />);

  await waitFor(() => expect(screen.getByTestId("weight-empty")).toBeTruthy());
  expect(screen.getByTestId("weight-save")).toBeTruthy();
});

test("a weight typed in pounds is sent in pounds", async () => {
  await render(<PetWeightScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("weight-amount")).toBeTruthy());

  await fireEvent.changeText(screen.getByTestId("weight-amount"), "27.5");
  await fireEvent.press(screen.getByTestId("weight-save"));

  await waitFor(() => expect(addWeight).toHaveBeenCalled());
  const [petId, payload] = addWeight.mock.calls[0];
  expect(petId).toBe("pet-1");
  // Storage is canonical pounds, because matching compares two pets' numbers.
  expect(payload.pounds).toBeCloseTo(27.5);
});

test("a body condition score is optional and toggles off again", async () => {
  await render(<PetWeightScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("weight-amount")).toBeTruthy());

  await fireEvent.changeText(screen.getByTestId("weight-amount"), "27.5");
  await fireEvent.press(screen.getByTestId("weight-bcs-5"));
  await fireEvent.press(screen.getByTestId("weight-bcs-5"));
  await fireEvent.press(screen.getByTestId("weight-save"));

  await waitFor(() => expect(addWeight).toHaveBeenCalled());
  expect(addWeight.mock.calls[0][1].bodyCondition).toBeUndefined();
});

test("the trend describes what the numbers did", async () => {
  fetchWeights.mockResolvedValue({
    measured: true,
    entries: [entry(30, 0), entry(22, 180)],
  });

  await render(<PetWeightScreen navigation={navigation} route={route} />);

  await waitFor(() => expect(screen.getByTestId("weight-trend")).toBeTruthy());
  expect(screen.getByText(/^Up /)).toBeTruthy();
});

test("the published scale is on screen with its source", async () => {
  await render(<PetWeightScreen navigation={navigation} route={route} />);

  await waitFor(() => expect(screen.getByTestId("weight-scale-5")).toBeTruthy());
  expect(screen.getByTestId("weight-scale-source")).toBeTruthy();
  expect(screen.getByText(/Ideal \(5\/9\)/)).toBeTruthy();
});

test("nothing on the screen tells the owner what the pet should weigh", async () => {
  /**
   * The line this feature does not cross. It shows the number, the trend and
   * the published scale; naming a target would be practising medicine at a
   * distance, which is what the rest of the health surface refuses to do.
   */
  fetchWeights.mockResolvedValue({
    measured: true,
    entries: [entry(30, 0), entry(22, 180)],
  });

  const { toJSON } = await render(<PetWeightScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("weight-trend")).toBeTruthy());

  const rendered = JSON.stringify(toJSON());
  expect(rendered).not.toMatch(/should weigh|target weight|aim for|overweight for|needs to lose/i);
  expect(rendered).not.toMatch(/calorie|kcal|portion/i);
});

test("a species with no weight on the schema says so instead of an empty chart", async () => {
  fetchWeights.mockResolvedValue({ measured: false, entries: [] });

  await render(
    <PetWeightScreen
      navigation={navigation}
      route={{ params: { pet: { _id: "pet-9", name: "Bubbles", species: "fish" }, petId: "pet-9" } }}
    />
  );

  await waitFor(() => expect(screen.getByTestId("weight-not-measured")).toBeTruthy());
});
