import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import PlaydateModificationScreen from "./PlaydateModificationScreen";
import { fetchPlaydate, updatePlaydate } from "../../api/playdates";
import { usePlaydatePlaces } from "../../hooks/usePlaydatePlaces";
import { useAuthSession } from "../../context/AuthSessionContext";

jest.mock("../../api/playdates", () => ({
  fetchPlaydate: jest.fn(),
  updatePlaydate: jest.fn(),
}));
jest.mock("../../hooks/usePlaydatePlaces", () => ({ usePlaydatePlaces: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));

/**
 * Changing a playdate.
 *
 * Three faults here each lost data, and each has a test: the pickers opened on
 * today rather than the scheduled date, so saving moved the meeting; the venue
 * could not be changed at all, because the location list never returned a
 * choice; and the whole place object was posted where an id belonged.
 */

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { playdateId: "pd-1" } };

const SCHEDULED = "2026-11-20T15:30:00.000Z";

const park = { _id: "loc-1", name: "Green Lane Park", address: "12 Green Lane" };
const trail = { _id: "loc-2", name: "Lost Dog Wash", address: "124th St" };

const playdate = (overrides = {}) => ({
  _id: "pd-1",
  date: SCHEDULED,
  startTime: SCHEDULED,
  location: park,
  ...overrides,
});

const places = (overrides = {}) => ({
  places: [park, trail],
  loading: false,
  importing: false,
  error: null,
  selected: park,
  choose: jest.fn(),
  reload: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({ profile: { _id: "me" } });
  fetchPlaydate.mockResolvedValue(playdate());
  updatePlaydate.mockResolvedValue({});
  usePlaydatePlaces.mockReturnValue(places());
});

test("it opens on what is actually scheduled, not on today", async () => {
  /**
   * The data-loss bug. Both pickers were seeded with `new Date()`, so an owner
   * who came here to change the venue and pressed save silently moved the
   * playdate to the current moment.
   */
  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("modify-save")).toBeTruthy());

  await fireEvent.press(screen.getByTestId("modify-save"));
  await waitFor(() => expect(updatePlaydate).toHaveBeenCalled());

  const [, payload] = updatePlaydate.mock.calls[0];
  expect(payload.date.toISOString()).toBe(SCHEDULED);
});

test("the venue it already has is the one ringed", async () => {
  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("modify-location-loc-1")).toBeTruthy());

  // Passed to the shared picker by id, so a venue outside the browse range is
  // still shown and still selected.
  expect(usePlaydatePlaces).toHaveBeenCalledWith(
    expect.objectContaining({ presetLocationId: "loc-1" })
  );
});

test("choosing a different place sends its id, not the place", async () => {
  const choose = jest.fn();
  usePlaydatePlaces.mockReturnValue(places({ selected: trail, choose }));

  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("modify-save")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("modify-save"));

  await waitFor(() => expect(updatePlaydate).toHaveBeenCalled());
  const [playdateId, payload] = updatePlaydate.mock.calls[0];
  expect(playdateId).toBe("pd-1");
  // An id. The old flow posted the whole document, which the server looks up
  // and never finds.
  expect(payload.locationId).toBe("loc-2");
});

test("leaving the venue alone does not resend it", async () => {
  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("modify-save")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("modify-save"));

  await waitFor(() => expect(updatePlaydate).toHaveBeenCalled());
  expect(updatePlaydate.mock.calls[0][1].locationId).toBeUndefined();
});

test("tapping a place tells the shared picker", async () => {
  const choose = jest.fn();
  usePlaydatePlaces.mockReturnValue(places({ choose }));

  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("modify-location-loc-2")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("modify-location-loc-2"));

  expect(choose).toHaveBeenCalledWith(trail);
});

test("it goes back on success rather than stranding the owner", async () => {
  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("modify-save")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("modify-save"));

  await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
});

test("a playdate that will not load says so instead of rendering a blank form", async () => {
  fetchPlaydate.mockResolvedValue(null);

  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);

  await waitFor(() => expect(screen.getByTestId("modify-error")).toBeTruthy());
  expect(screen.queryByTestId("modify-save")).toBeNull();
});

test("a cold area explains itself while it fills in", async () => {
  usePlaydatePlaces.mockReturnValue(
    places({ places: [], loading: true, importing: true, selected: null })
  );

  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);

  await waitFor(() => expect(screen.getByTestId("modify-places-loading")).toBeTruthy());
  expect(screen.getByText(/Looking for parks and trails near you/)).toBeTruthy();
});

test("no places nearby is a sentence, not an empty gap", async () => {
  usePlaydatePlaces.mockReturnValue(
    places({ places: [], error: "No parks or trails found near you yet.", selected: null })
  );

  await render(<PlaydateModificationScreen navigation={navigation} route={route} />);

  await waitFor(() => expect(screen.getByTestId("modify-places-error")).toBeTruthy());
});
