import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import PlaydateDetailsScreen from "./PlaydateDetailsScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";
import { useAuthSession } from "../../context/AuthSessionContext";

jest.mock("../../api/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));
// Any icon set this screen's children reach for resolves to a host component;
// the real ones load a font asynchronously and setState after the test ends.
jest.mock("@expo/vector-icons", () =>
  new Proxy({}, { get: (_t, name) => String(name) })
);

/**
 * Answering an invitation.
 *
 * `POST /api/playdates/accept|decline` has been built, guarded and tested from
 * the start, and `acceptPlaydate`/`declinePlaydate` have existed in
 * `src/api/playdates` just as long - called by nothing but their own unit test.
 * The only screen offering them was `PlaydateRequestScreen`, which nothing
 * navigated to, while the `playdate` notification and the Playdates tab both
 * land here. So an invitation arrived and dead-ended: it could not be accepted
 * or declined from anywhere in the app.
 */

const navigation = { navigate: jest.fn() };

const ME = "me-user-id";
const ORGANISER = "organiser-user-id";

const playdate = (overrides = {}) => ({
  _id: "pd-1",
  status: "pending",
  creator: { _id: ORGANISER, username: "alex" },
  date: "2026-10-01T00:00:00.000Z",
  location: { _id: "loc-1", name: "Green Lane Park" },
  notes: "By the oak",
  participants: [{ _id: ME, username: "sam" }],
  petsInvolved: [{ _id: "pet-1", name: "Sky", photos: [] }],
  reviews: [],
  ...overrides,
});

/**
 * Every query goes through `waitFor`. In this React 19 / RTL combination a
 * query issued straight after a state change resolves against a stale tree -
 * the same shape the other screen suites here use.
 */
const seeText = (text) => waitFor(() => screen.getByText(text));

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <ToastProvider>
        <PlaydateDetailsScreen
          route={{ params: { playdateId: "pd-1" } }}
          navigation={navigation}
        />
      </ToastProvider>
    </AppThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({ userId: ME });
  api.get.mockResolvedValue({ data: playdate() });
  api.post.mockResolvedValue({ data: { message: "Playdate accepted" } });
});

test("an invitee is offered the choice", async () => {
  renderScreen();
  expect(await seeText("Accept")).toBeTruthy();
  expect(screen.getByText("Decline")).toBeTruthy();
});

test("accepting calls the endpoint and refetches", async () => {
  renderScreen();
  fireEvent.press(await seeText("Accept"));

  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith("/api/playdates/accept/pd-1")
  );
  // The buttons have to go away, so the refetch is part of the behaviour.
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
});

test("declining calls the decline endpoint", async () => {
  renderScreen();
  fireEvent.press(await seeText("Decline"));

  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith("/api/playdates/decline/pd-1")
  );
});

test("the organiser is not offered a choice they cannot make", async () => {
  useAuthSession.mockReturnValue({ userId: ORGANISER });
  renderScreen();

  await seeText(/Green Lane Park/);
  expect(screen.queryByText("Accept")).toBeNull();
  expect(screen.queryByText("Decline")).toBeNull();
});

test("an answered playdate offers nothing further", async () => {
  api.get.mockResolvedValue({ data: playdate({ status: "accepted" }) });
  renderScreen();

  await seeText(/Green Lane Park/);
  expect(screen.queryByText("Accept")).toBeNull();
});

test("a hidden location does not crash the screen", async () => {
  // `getPlaydateById` nulls this when the organiser has location sharing off,
  // so `location.name` threw for exactly the person the server was protecting.
  api.get.mockResolvedValue({ data: playdate({ location: null }) });
  renderScreen();

  expect(await seeText(/Hidden until the organiser shares it/)).toBeTruthy();
});
