import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import AskSpotButton from "./AskSpotButton";
import { fetchSpotStatus } from "../../api/spot";
import { resetSpotEnabled } from "../../hooks/useSpotEnabled";

jest.mock("../../api/spot", () => ({ fetchSpotStatus: jest.fn() }));

/**
 * The way into Spot from six screens. It must not exist when Spot is off,
 * must cost one request per session rather than one per screen, and must
 * carry the screen's context so the first message is already about it.
 */

const navigation = { navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  resetSpotEnabled();
});

test("renders nothing until the server says Spot is on, then navigates with its context", async () => {
  fetchSpotStatus.mockResolvedValue({ enabled: true, consented: true, quota: null });
  await render(
    <AskSpotButton navigation={navigation} context={{ petId: "p1", screen: "health" }} />
  );

  await waitFor(() => expect(screen.getByTestId("ask-spot")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("ask-spot"));
  expect(navigation.navigate).toHaveBeenCalledWith("Spot", {
    context: { petId: "p1", screen: "health" },
  });
});

test("Spot off means no button at all", async () => {
  fetchSpotStatus.mockResolvedValue({ enabled: false, consented: false, quota: null });
  await render(<AskSpotButton navigation={navigation} />);

  await waitFor(() => expect(fetchSpotStatus).toHaveBeenCalled());
  expect(screen.queryByTestId("ask-spot")).toBeNull();
});

test("the answer is asked for once per session, not once per screen", async () => {
  fetchSpotStatus.mockResolvedValue({ enabled: true, consented: true, quota: null });
  await render(
    <>
      <AskSpotButton navigation={navigation} testID="a" />
      <AskSpotButton navigation={navigation} testID="b" inline prefill="My pet ate " />
    </>
  );

  await waitFor(() => expect(screen.getByTestId("a")).toBeTruthy());
  expect(screen.getByTestId("b")).toBeTruthy();
  expect(fetchSpotStatus).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByTestId("b"));
  expect(navigation.navigate).toHaveBeenCalledWith("Spot", { prefill: "My pet ate " });
});

test("a failed status check hides the button and leaves the question open", async () => {
  fetchSpotStatus.mockRejectedValue(new Error("offline"));
  await render(<AskSpotButton navigation={navigation} />);
  await waitFor(() => expect(fetchSpotStatus).toHaveBeenCalled());
  expect(screen.queryByTestId("ask-spot")).toBeNull();
});
