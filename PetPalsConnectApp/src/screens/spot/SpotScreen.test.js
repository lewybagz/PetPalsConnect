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
  listConversations,
  deleteConversation,
  listNotes,
  deleteNote,
} from "../../api/spot";
import { addWeight, removeWeight } from "../../api/weight";
import * as Speech from "expo-speech";
import { createAudioPlayer } from "expo-audio";
import { requestDictationPermission, startDictation } from "../../services/dictation";
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
  listConversations: jest.fn(),
  deleteConversation: jest.fn(),
  listNotes: jest.fn(),
  deleteNote: jest.fn(),
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
jest.mock("../../services/dictation", () => ({
  requestDictationPermission: jest.fn(),
  startDictation: jest.fn(),
}));
jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn(async () => {}) }));
const mockToast = { error: jest.fn(), success: jest.fn(), show: jest.fn() };
jest.mock("../../components/ui", () => ({
  ...jest.requireActual("../../components/ui"),
  useToast: () => mockToast,
}));
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));
jest.mock("../../../utils/tokenutil", () => ({ getStoredToken: jest.fn(async () => "id-token") }));
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

// ---------------------------------------------------------------------------
// Phase 4: the conversations you can reach, the notes you can see, and web links
// ---------------------------------------------------------------------------

test("Recent lists the kept conversations, opens one, deletes one, and starts a new one", async () => {
  listConversations.mockResolvedValue([
    { _id: "c1", title: "Bella's ears", messageCount: 4, updatedAt: "2026-09-12T10:00:00.000Z" },
    { _id: "c2", title: "grapes", messageCount: 2, updatedAt: "2026-09-11T10:00:00.000Z" },
  ]);
  fetchConversation.mockResolvedValue({
    _id: "c1",
    messages: [{ _id: "a", role: "assistant", text: "About her ears.", blocks: [], attachments: [], source: "model" }],
  });
  deleteConversation.mockResolvedValue(true);
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await fireEvent.press(screen.getByTestId("spot-open-recent"));
  await waitFor(() => expect(screen.getByTestId("spot-recent-c1")).toBeTruthy());
  expect(screen.getByText("Bella's ears")).toBeTruthy();
  expect(screen.getByText(/4 messages/)).toBeTruthy();

  await fireEvent.press(screen.getByTestId("spot-open-c1"));
  await waitFor(() => expect(screen.getByText("About her ears.")).toBeTruthy());
  expect(fetchConversation).toHaveBeenCalledWith("c1");
  expect(screen.queryByTestId("spot-panel-recent")).toBeNull();

  // A send now lands on the opened conversation, not a new one.
  await type("and now?");
  await waitFor(() => expect(sendSpotMessage).toHaveBeenCalledWith("c1", { text: "and now?", image: null }));
  expect(createConversation).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId("spot-open-recent"));
  await waitFor(() => expect(screen.getByTestId("spot-delete-c2")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("spot-delete-c2"));
  await waitFor(() => expect(screen.queryByTestId("spot-recent-c2")).toBeNull());
  expect(deleteConversation).toHaveBeenCalledWith("c2");

  await fireEvent.press(screen.getByTestId("spot-new"));
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
});

test("what Spot remembers is listed in the owner's words and can be forgotten", async () => {
  listNotes.mockResolvedValue([{ _id: "n1", text: "Bella is scared of thunderstorms", createdAt: "2026-09-12T10:00:00.000Z" }]);
  deleteNote.mockResolvedValue(true);
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await fireEvent.press(screen.getByTestId("spot-open-notes"));
  await waitFor(() => expect(screen.getByText("Bella is scared of thunderstorms")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("spot-forget-n1"));
  await waitFor(() => expect(screen.getByTestId("spot-notes-empty")).toBeTruthy());
  expect(deleteNote).toHaveBeenCalledWith("n1");

  await fireEvent.press(screen.getByTestId("spot-panel-close"));
  await waitFor(() => expect(screen.queryByTestId("spot-panel-notes")).toBeNull());
});

test("a web block opens the retailer search in the browser and says PetPals is not paid", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  sendSpotMessage.mockResolvedValue({
    userMessage: { _id: "m1", role: "user", text: "what food?", blocks: [], attachments: [], source: "model" },
    message: {
      _id: "m2",
      role: "assistant",
      text: "For an adult, medium dog the hub suggests these categories.",
      blocks: [{ type: "web", items: [{ label: "Adult dog food", url: "https://www.google.com/search?q=adult+dog+food" }] }],
      attachments: [],
      source: "model",
    },
    quota: { used: 1, limit: 3, premium: false },
  });
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  await type("what food should I buy?");
  await waitFor(() => expect(screen.getByTestId("spot-web")).toBeTruthy());
  expect(screen.getByText(/PetPals is not paid/)).toBeTruthy();
  await fireEvent.press(screen.getByText("Adult dog food"));
  expect(open).toHaveBeenCalledWith("https://www.google.com/search?q=adult+dog+food");
});

test("a done block with no undo shows no undo button", async () => {
  sendSpotMessage.mockResolvedValue({
    userMessage: { _id: "m1", role: "user", text: "accept it", blocks: [], attachments: [], source: "model" },
    message: {
      _id: "m2",
      role: "assistant",
      text: "Done.",
      blocks: [{ type: "done", kind: "respondToPlaydate", summary: "Accepted the playdate on 2026-10-01; @alex has been told", undo: null }],
      attachments: [],
      source: "model",
    },
    quota: { used: 1, limit: 3, premium: false },
  });
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  await type("accept the playdate from alex");
  await waitFor(() => expect(screen.getByTestId("spot-done")).toBeTruthy());
  expect(screen.getByText(/@alex has been told/)).toBeTruthy();
  expect(screen.queryByTestId("spot-undo")).toBeNull();
});

test("software answers a fact and a conversion without the model", async () => {
  useAuthSession.mockReturnValue({ profile: { _id: "u1", pets: [{ ...bella, weight: 40, age: 4 }] }, userId: "u1" });
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  await type("how much does Bella weigh?");
  await waitFor(() => expect(screen.getByText(/Bella weighs 40 lb/)).toBeTruthy());
  await type("12 kg in pounds");
  await waitFor(() => expect(screen.getByText("12 kg is 26.5 lb.")).toBeTruthy());
  expect(sendSpotMessage).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Phase 5: cards, the mic, hands-free, and read aloud
// ---------------------------------------------------------------------------

const answered = (text, blocks = []) => ({
  userMessage: { _id: "m1", role: "user", text: "q", blocks: [], attachments: [], source: "model" },
  message: { _id: "m2", role: "assistant", text, blocks, attachments: [], source: "model" },
  quota: { used: 1, limit: 3, premium: false },
});

test("a cards block renders each card and its tap goes where the chip went", async () => {
  sendSpotMessage.mockResolvedValue(
    answered("Two pals are around.", [
      {
        type: "cards",
        items: [
          { title: "Sky", subtitle: "Whippet · with @alex", image: "https://x/sky.jpg", chip: { screen: "PetDetails", params: { petId: "pet-9" }, label: "Open Sky" } },
          { title: "Kennel cough, plainly", subtitle: "What it is.", image: null, chip: { screen: "ArticleDetail", params: { articleId: "a1" }, label: "Read" } },
        ],
      },
    ])
  );
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  await type("who could Bella meet?");
  await waitFor(() => expect(screen.getByTestId("spot-cards")).toBeTruthy());
  expect(screen.getByText("Whippet · with @alex")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("spot-card-PetDetails"));
  expect(navigation.navigate).toHaveBeenCalledWith("PetDetails", { petId: "pet-9" });
  await fireEvent.press(screen.getByTestId("spot-card-ArticleDetail"));
  expect(navigation.navigate).toHaveBeenCalledWith("ArticleDetail", { articleId: "a1" });
});

/** Drives the mocked dictation: returns the handlers the screen passed in. */
const listenAndCapture = async () => {
  let handlers = null;
  const stop = jest.fn();
  startDictation.mockImplementation((given) => {
    handlers = given;
    return stop;
  });
  await fireEvent.press(screen.getByTestId("spot-mic"));
  await waitFor(() => expect(startDictation).toHaveBeenCalled());
  return { handlers, stop };
};

test("the mic asks first; a refusal is a sentence and nothing listens", async () => {
  requestDictationPermission.mockResolvedValue("denied");
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("spot-mic"));
  await waitFor(() => expect(requestDictationPermission).toHaveBeenCalled());
  expect(startDictation).not.toHaveBeenCalled();
  await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Allow the microphone in your phone's settings to speak to Spot."));
  expect(screen.getByTestId("spot-input").props.placeholder).toBe("Ask Spot…");
});

test("dictation fills the box as words arrive, the final words send, and the answer is read back hands-free", async () => {
  requestDictationPermission.mockResolvedValue("granted");
  sendSpotMessage.mockResolvedValue(answered("Bella is not due for anything."));
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());

  const { handlers } = await listenAndCapture();
  expect(screen.getByTestId("spot-input").props.placeholder).toBe("Listening…");
  await act(async () => handlers.onInterim("is bella"));
  expect(screen.getByTestId("spot-input").props.value).toBe("is bella");
  await act(async () => {
    handlers.onFinal("what should I know about beagles");
    handlers.onEnd();
  });
  await waitFor(() =>
    expect(sendSpotMessage).toHaveBeenCalledWith("c1", { text: "what should I know about beagles", image: null })
  );
  // Hands-free: the answer is spoken without a tap, by the phone's voice, and the mic re-arms after it.
  await waitFor(() => expect(Speech.speak).toHaveBeenCalled());
  expect(Speech.speak.mock.calls[0][0]).toBe("Bella is not due for anything.");
  expect(screen.getByText(/hands-free/)).toBeTruthy();
  const callsBefore = startDictation.mock.calls.length;
  await act(async () => Speech.speak.mock.calls[0][1].onDone());
  await waitFor(() => expect(startDictation.mock.calls.length).toBe(callsBefore + 1));
});

test("typing turns hands-free off, so a typed question is not read back", async () => {
  requestDictationPermission.mockResolvedValue("granted");
  sendSpotMessage.mockResolvedValueOnce(answered("Voice answer.")).mockResolvedValueOnce({
    ...answered("Typed answer."),
    userMessage: { _id: "m3", role: "user", text: "q2", blocks: [], attachments: [], source: "model" },
    message: { _id: "m4", role: "assistant", text: "Typed answer.", blocks: [], attachments: [], source: "model" },
  });
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  const { handlers } = await listenAndCapture();
  await act(async () => {
    handlers.onFinal("first by voice");
    handlers.onEnd();
  });
  await waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
  await act(async () => Speech.speak.mock.calls[0][1].onDone());
  Speech.speak.mockClear();

  await type("now by keyboard");
  await waitFor(() => expect(sendSpotMessage).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText("Typed answer.")).toBeTruthy());
  expect(Speech.speak).not.toHaveBeenCalled();
  expect(screen.queryByText(/hands-free/)).toBeNull();
});

test("Read aloud uses the phone's voice when the server has none, and tapping again stops it", async () => {
  sendSpotMessage.mockResolvedValue(answered("Read me."));
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  await type("say something");
  await waitFor(() => expect(screen.getByTestId("spot-speak")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("spot-speak"));
  expect(Speech.speak).toHaveBeenCalledWith("Read me.", expect.any(Object));
  expect(createAudioPlayer).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByText("Stop")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("spot-speak"));
  expect(Speech.stop).toHaveBeenCalled();
  await waitFor(() => expect(screen.getByText("Read aloud")).toBeTruthy());
});

test("with an AI voice configured, Read aloud streams the answer's audio with the bearer token", async () => {
  fetchSpotStatus.mockResolvedValue({ ...on, voice: true });
  sendSpotMessage.mockResolvedValue(answered("In a warmer voice."));
  const player = { play: jest.fn(), pause: jest.fn(), remove: jest.fn(), addListener: jest.fn() };
  createAudioPlayer.mockReturnValue(player);
  await render(<SpotScreen navigation={navigation} route={route} />);
  await waitFor(() => expect(screen.getByTestId("spot-empty")).toBeTruthy());
  await type("say it nicely");
  await waitFor(() => expect(screen.getByTestId("spot-speak")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("spot-speak"));
  await waitFor(() => expect(player.play).toHaveBeenCalled());
  const source = createAudioPlayer.mock.calls[0][0];
  expect(source.uri).toMatch(/\/api\/spot\/conversations\/c1\/messages\/m2\/audio$/);
  expect(source.headers).toEqual({ Authorization: "Bearer id-token" });
  expect(Speech.speak).not.toHaveBeenCalled();
  // The end of playback clears the control.
  const [, onStatus] = player.addListener.mock.calls[0];
  await act(async () => onStatus({ didJustFinish: true }));
  await waitFor(() => expect(screen.getByText("Read aloud")).toBeTruthy());
  expect(player.remove).toHaveBeenCalled();
});
