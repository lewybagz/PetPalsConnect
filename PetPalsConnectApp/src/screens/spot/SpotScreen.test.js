import React from "react";
import { Linking } from "react-native";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import SpotScreen from "./SpotScreen";
import {
  fetchSpotStatus,
  giveSpotConsent,
  createConversation,
  fetchConversation,
  sendSpotMessage,
  flagSpotMessage,
} from "../../api/spot";
import { addWeight, removeWeight } from "../../api/weight";
import { fetchVaccinationStatus } from "../../api/health";
import { fetchToxins } from "../../api/toxins";
import { useAuthSession } from "../../context/AuthSessionContext";
import { onSocketEvent } from "../../services/socket";

jest.mock("../../api/spot", () => ({
  ...jest.requireActual("../../api/spot"),
  fetchSpotStatus: jest.fn(),
  giveSpotConsent: jest.fn(),
  createConversation: jest.fn(),
  fetchConversation: jest.fn(),
  sendSpotMessage: jest.fn(),
  flagSpotMessage: jest.fn(),
}));
jest.mock("../../api/weight", () => ({ addWeight: jest.fn(), removeWeight: jest.fn() }));
jest.mock("../../api/health", () => ({
  ...jest.requireActual("../../api/health"),
  fetchVaccinationStatus: jest.fn(),
  removeHealthRecord: jest.fn(),
}));
jest.mock("../../api/settings", () => ({ saveSettings: jest.fn() }));
jest.mock("../../api/toxins", () => ({
  ...jest.requireActual("../../api/toxins"),
  fetchToxins: jest.fn(),
}));
jest.mock("../../services/photos", () => ({ pickPhoto: jest.fn(), compressForSpot: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));
jest.mock("../../context/SettingsContext", () => ({
  useSettings: () => ({ units: { distance: "mi", weight: "lb" } }),
}));
jest.mock("../../services/socket", () => ({ onSocketEvent: jest.fn(() => () => {}) }));

/**
 * The screen owns the transcript and three states the person has to tell
 * apart. What it must never do is send a message before consent, answer a
 * software question with a model turn, or lose an answer the server gave.
 */

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: {} };
const bella = { _id: "p1", name: "Bella", species: "dog", breed: "Beagle" };

const CONTACTS = [
  { id: "aspca-apcc", name: "ASPCA Animal Poison Control Center", phone: "888-426-4435", region: "US" },
];
const TOXINS = [
  {
    slug: "grapes-raisins",
    name: "Grapes, raisins and currants",
    aliases: ["grape"],
    species: ["dog"],
    severity: "emergency",
    signs: "Vomiting.",
    guidance: "Ring the helpline.",
    sources: [],
  },
];

const on = { enabled: true, consented: true, readChats: false, quota: { used: 0, limit: 3, premium: false } };

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({ profile: { _id: "u1", pets: [bella] }, userId: "u1" });
  fetchSpotStatus.mockResolvedValue(on);
  fetchToxins.mockResolvedValue({ toxins: TOXINS, contacts: CONTACTS, stale: false });
  createConversation.mockResolvedValue({ _id: "c1", messages: [] });
  fetchConversation.mockResolvedValue({ _id: "c1", messages: [] });
  sendSpotMessage.mockResolvedValue({
    userMessage: { _id: "m1", role: "user", text: "hi", blocks: [], attachments: [], source: "model" },
    message: { _id: "m2", role: "assistant", text: "Hello.", blocks: [], attachments: [], source: "model" },
    quota: { used: 1, limit: 3, premium: false },
  });
});

const type = async (text) => {
  await fireEvent.changeText(screen.getByTestId("spot-input"), text);
  await fireEvent.press(screen.getByTestId("spot-send"));
};

test("Spot off is an honest empty state with the poison lookup one tap away", async () => {
  fetchSpotStatus.mockResolvedValue({ enabled: false, consented: false, quota: null });
  await render(<SpotScreen navigation={navigation} route={route} />);

  await waitFor(() => expect(screen.getByTestId("spot-off")).toBeTruthy());
  expect(screen.getByText("Spot isn't available right now")).toBeTruthy();
  await fireEvent.press(screen.getByText("Is this dangerous?"));
  expect(navigation.navigate).toHaveBeenCalledWith("ToxinLookup");
});

test("nothing is sent until the person has agreed, and Not now means no", async () => {
  fetchSpotStatus.mockResolvedValue({ ...on, consented: false });
  giveSpotConsent.mockResolvedValue(true);
  await render(<SpotScreen navigation={navigation} route={route} />);

  await waitFor(() => expect(screen.getByTestId("spot-consent")).toBeTruthy());
  expect(screen.getByText(/sends what you type/)).toBeTruthy();
  expect(screen.getByText(/not a veterinarian/)).toBeTruthy();

  await fireEvent.press(screen.getByTestId("spot-consent-continue"));
  await waitFor(() => expect(giveSpotConsent).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByTestId("spot-consent")).toBeNull());
});

test("Not now backs out without agreeing", async () => {
  fetchSpotStatus.mockResolvedValue({ ...on, consented: false });
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-consent")).toBeTruthy());

  await fireEvent.press(screen.getByTestId("spot-consent-not-now"));
  expect(giveSpotConsent).not.toHaveBeenCalled();
  expect(navigation.goBack).toHaveBeenCalled();
});

test("the empty screen offers chips that are real questions", async () => {
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  const chips = screen.getAllByTestId("spot-chip");
  expect(chips.length).toBeGreaterThanOrEqual(3);
  expect(screen.getByText("Is Bella due for anything?")).toBeTruthy();
});

test("a question the model answers: sent once, rendered with its blocks, quota updated", async () => {
  sendSpotMessage.mockResolvedValue({
    userMessage: { _id: "m1", role: "user", text: "why does Bella eat grass?", blocks: [], attachments: [], source: "model" },
    message: {
      _id: "m2",
      role: "assistant",
      text: "Most dogs do.\n\nYour vet can rule anything out.",
      blocks: [{ type: "links", items: [{ screen: "PetHealth", params: { petId: "p1" }, label: "Health records" }] }],
      attachments: [],
      source: "model",
    },
    quota: { used: 1, limit: 3, premium: false },
  });
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("why does Bella eat grass?");

  await waitFor(() => expect(sendSpotMessage).toHaveBeenCalledTimes(1));
  expect(createConversation).toHaveBeenCalledTimes(1);
  expect(sendSpotMessage).toHaveBeenCalledWith("c1", { text: "why does Bella eat grass?", image: null });

  await waitFor(() => expect(screen.getByText("Most dogs do.")).toBeTruthy());
  expect(screen.getByText("Your vet can rule anything out.")).toBeTruthy();
  expect(screen.getByText("1 of 3 Spot messages today")).toBeTruthy();

  await fireEvent.press(screen.getByTestId("spot-link-PetHealth"));
  expect(navigation.navigate).toHaveBeenCalledWith("PetHealth", { petId: "p1" });
});

test("software answers first: 'is Bella due' never reaches the model", async () => {
  fetchVaccinationStatus.mockResolvedValue("current");
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("Is Bella due for anything?");

  await waitFor(() => expect(screen.getByText(/^Bella: Rabies, DHPP and Bordetella/)).toBeTruthy());
  expect(fetchVaccinationStatus).toHaveBeenCalledWith("p1");
  expect(sendSpotMessage).not.toHaveBeenCalled();
  expect(createConversation).not.toHaveBeenCalled();
  expect(screen.getByTestId("spot-link-PetHealth")).toBeTruthy();
});

test("software answers first: an exact toxin hit carries the numbers and dials them", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("Bella ate grapes");

  await waitFor(() => expect(screen.getByTestId("spot-contacts")).toBeTruthy());
  expect(screen.getByText(/Grapes, raisins and currants: Do not wait/)).toBeTruthy();
  expect(sendSpotMessage).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId("spot-call-aspca-apcc"));
  expect(open).toHaveBeenCalledWith("tel:8884264435");
});

test("a toxin miss goes to the model, which has the table too", async () => {
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("Bella ate a banana peel");

  await waitFor(() => expect(sendSpotMessage).toHaveBeenCalledTimes(1));
});

test("software writes: 'log Bella at 42 lb' saves through the weight API and offers an undo that works", async () => {
  addWeight.mockResolvedValue({ _id: "e1", pounds: 42 });
  removeWeight.mockResolvedValue(true);
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("log Bella at 42 lb");

  await waitFor(() => expect(screen.getByTestId("spot-done")).toBeTruthy());
  expect(addWeight).toHaveBeenCalledWith("p1", { pounds: 42 });
  expect(sendSpotMessage).not.toHaveBeenCalled();
  expect(screen.getByText("Logged Bella at 42 lb.")).toBeTruthy();

  await fireEvent.press(screen.getByTestId("spot-undo"));
  await waitFor(() => expect(removeWeight).toHaveBeenCalledWith("p1", "e1"));
  await waitFor(() => expect(screen.getByText("Undone")).toBeTruthy());
});

test("a done block from the server undoes through the same table", async () => {
  removeWeight.mockResolvedValue(true);
  sendSpotMessage.mockResolvedValue({
    userMessage: { _id: "m1", role: "user", text: "x", blocks: [], attachments: [], source: "model" },
    message: {
      _id: "m2",
      role: "assistant",
      text: "Logged.",
      blocks: [
        { type: "done", kind: "logWeight", summary: "Logged Bella at 26 lb", undo: { kind: "removeWeight", petId: "p1", entryId: "e9" } },
      ],
      attachments: [],
      source: "model",
    },
    quota: { used: 1, limit: 3, premium: false },
  });
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("please log her at twenty six pounds");
  await waitFor(() => expect(screen.getByTestId("spot-done")).toBeTruthy());

  await fireEvent.press(screen.getByTestId("spot-undo"));
  await waitFor(() => expect(removeWeight).toHaveBeenCalledWith("p1", "e9"));
});

test("today's quota used up is a card with the plan one tap away, not a toast", async () => {
  const error = new Error("429");
  error.code = "SPOT_QUOTA";
  error.body = { used: 3, limit: 3, premium: false };
  sendSpotMessage.mockRejectedValue(error);
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("tell me about beagles");

  await waitFor(() => expect(screen.getByTestId("spot-quota")).toBeTruthy());
  expect(screen.getByText("3 of 3 Spot messages today")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("spot-quota-premium"));
  expect(navigation.navigate).toHaveBeenCalledWith("ChoosePlan");
});

test("streamed text shows while Spot writes, and the final answer replaces it", async () => {
  let resolveSend;
  sendSpotMessage.mockImplementation(() => new Promise((resolve) => { resolveSend = resolve; }));
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  // Not awaited: RNTL 14 awaits the press handler, and this handler is held
  // open on purpose until the answer is released below.
  await fireEvent.changeText(screen.getByTestId("spot-input"), "tell me about beagles");
  const pressed = fireEvent.press(screen.getByTestId("spot-send"));
  await waitFor(() => expect(screen.getByTestId("spot-thinking")).toBeTruthy());

  // The delta listener was registered on mount; feed it a chunk for this conversation.
  const handler = onSocketEvent.mock.calls.find(([event]) => event === "spotDelta")[1];
  await waitFor(() => expect(createConversation).toHaveBeenCalled());
  await act(async () => {
    handler({ conversationId: "c1", text: "Beagles were bred " });
    handler({ conversationId: "other", text: "NOT MINE" });
  });
  await waitFor(() => expect(screen.getByText("Beagles were bred ")).toBeTruthy());
  expect(screen.queryByText(/NOT MINE/)).toBeNull();

  await act(async () => {
    resolveSend({
      userMessage: { _id: "m1", role: "user", text: "tell me about beagles", blocks: [], attachments: [], source: "model" },
      message: { _id: "m2", role: "assistant", text: "Beagles were bred to follow a scent.", blocks: [], attachments: [], source: "model" },
      quota: { used: 1, limit: 3, premium: false },
    });
  });
  await pressed;
  await waitFor(() => expect(screen.getByText("Beagles were bred to follow a scent.")).toBeTruthy());
  expect(screen.queryByTestId("spot-thinking")).toBeNull();
});

test("a conversation opened from the list is loaded once, and never fetched after a send", async () => {
  fetchConversation.mockResolvedValue({
    _id: "c9",
    messages: [
      { _id: "a", role: "user", text: "earlier", blocks: [], attachments: [], source: "model" },
      { _id: "b", role: "assistant", text: "Earlier answer.", blocks: [], attachments: [], source: "model" },
    ],
  });
  await render(<SpotScreen navigation={navigation} route={{ params: { conversationId: "c9" } }} />);

  await waitFor(() => expect(screen.getByText("Earlier answer.")).toBeTruthy());
  expect(fetchConversation).toHaveBeenCalledTimes(1);

  await type("and now?");
  await waitFor(() => expect(sendSpotMessage).toHaveBeenCalledWith("c9", { text: "and now?", image: null }));
  expect(createConversation).not.toHaveBeenCalled();
  expect(fetchConversation).toHaveBeenCalledTimes(1);
});

test("an answer can be reported", async () => {
  flagSpotMessage.mockResolvedValue(true);
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("tell me about beagles");
  await waitFor(() => expect(screen.getByTestId("spot-flag")).toBeTruthy());

  await fireEvent.press(screen.getByTestId("spot-flag"));
  await waitFor(() => expect(flagSpotMessage).toHaveBeenCalledWith("c1", "m2"));
  await waitFor(() => expect(screen.getByText("Reported. Thank you.")).toBeTruthy());
});

test("the screen never says verified or safe about a pet", async () => {
  fetchVaccinationStatus.mockResolvedValue("current");
  const { toJSON } = await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  await type("Is Bella due for anything?");
  await waitFor(() => expect(screen.getByText(/^Bella: /)).toBeTruthy());

  const rendered = JSON.stringify(toJSON());
  expect(rendered).not.toMatch(/\bverified\b/i);
  expect(rendered).not.toMatch(/\bsafe\b/i);
});
