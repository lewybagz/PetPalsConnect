import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { createAudioPlayer } from "expo-audio";

import { Button, Card, EmptyState, Screen, Text, useToast } from "../../components/ui";
import SpotMessage from "../../components/spot/SpotMessage";
import QuotaNotice from "../../components/spot/QuotaNotice";
import SpotConsentSheet from "./SpotConsentSheet";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useSettings } from "../../context/SettingsContext";
import { useSpotDelta } from "../../hooks/useSocketEvents";
import {
  SPOT_ERRORS,
  audioSource,
  createConversation,
  deleteConversation,
  deleteNote,
  fetchConversation,
  fetchSpotStatus,
  flagSpotMessage,
  giveSpotConsent,
  listConversations,
  listNotes,
  sendSpotMessage,
  undo as undoBlock,
} from "../../api/spot";
import { addWeight } from "../../api/weight";
import { fetchVaccinationStatus } from "../../api/health";
import { fetchToxins } from "../../api/toxins";
import { pickPhoto, compressForSpot } from "../../services/photos";
import { requestDictationPermission, startDictation } from "../../services/dictation";
import {
  answerConvert,
  answerDue,
  answerEmergency,
  answerFact,
  answerOpen,
  answerToxin,
  answerWeight,
  chipsFor,
  resolveIntent,
} from "./intents";

/**
 * Spot.
 *
 * A message goes through `intents.js` first. The questions people ask the
 * same way every time are answered on the device from data the app already
 * holds, in Spot's voice, with no model turn and no quota - "is Bella due",
 * "log her at 42", "emergency numbers", "she ate grapes". Everything else is
 * sent to the server, which runs the model with tools bound to this owner
 * and streams the text back through the socket room while it writes.
 *
 * The screen holds no secret and no rule. Consent is the server's date, the
 * quota is the server's count, the blocks come back attached. What it owns
 * is the transcript on screen and the three states the person needs to tell
 * apart: Spot is off, Spot has not been agreed to, and today's messages are
 * used up.
 */

const local = (role, text, extra = {}) => ({
  _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text,
  blocks: [],
  attachments: [],
  source: "software",
  createdAt: new Date().toISOString(),
  ...extra,
});

const SpotScreen = ({ navigation, route }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { profile } = useAuthSession();
  const { units } = useSettings();

  const pets = useMemo(() => (Array.isArray(profile?.pets) ? profile.pets : []), [profile]);
  const context = route?.params?.context ?? null;

  const [status, setStatus] = useState(null);
  const [consenting, setConsenting] = useState(false);
  const [conversationId, setConversationId] = useState(route?.params?.conversationId ?? null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(route?.params?.prefill ?? "");
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [quota, setQuota] = useState(null);
  const [overQuota, setOverQuota] = useState(null);
  const [toxinTable, setToxinTable] = useState(null);
  // "recent" or "notes": a list shown in place of the transcript. The five
  // kept conversations existed for a phase with nothing on screen to open
  // them from - the reachability failure this repo keeps finding.
  const [panel, setPanel] = useState(route?.params?.panel ?? null);
  const [recent, setRecent] = useState(null);
  const [notes, setNotes] = useState(null);
  // Voice. `listening` while the phone transcribes; `handsFree` once a
  // question came in by voice, so the answer is read back and the mic
  // re-arms - the car-park case. Typing turns it off. `speakingId` is the
  // message being read, by the phone's voice or the configured AI voice.
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const stopListeningRef = useRef(null);
  const playerRef = useRef(null);
  const speakRef = useRef(null);

  const scrollRef = useRef(null);
  // The socket listener is registered once and needs the current id without
  // resubscribing; a ref written from an effect is how that is done.
  const conversationRef = useRef(conversationId);
  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);

  // Status first: it says whether Spot is on and whether this person agreed.
  useEffect(() => {
    let cancelled = false;
    fetchSpotStatus()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        setQuota(next.quota);
      })
      .catch(() => {
        if (!cancelled) setStatus({ enabled: false, consented: false, quota: null });
      });
    // The poison table, for the exact-hit intent. Cached, so usually instant.
    fetchToxins()
      .then((table) => {
        if (!cancelled) setToxinTable(table);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // A conversation passed in is loaded once; one created on first send is
  // already in hand and is never fetched back.
  const openedId = route?.params?.conversationId ?? null;
  useEffect(() => {
    if (!openedId || !status?.enabled) return undefined;
    let cancelled = false;
    fetchConversation(openedId)
      .then((conversation) => {
        if (!cancelled) setMessages(conversation.messages);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't open that conversation.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedId, status?.enabled]);

  useEffect(() => {
    if (!panel || !status?.enabled) return undefined;
    let cancelled = false;
    const load = panel === "recent" ? listConversations : listNotes;
    const set = panel === "recent" ? setRecent : setNotes;
    load()
      .then((rows) => {
        if (!cancelled) set(rows);
      })
      .catch(() => {
        if (!cancelled) set([]);
      });
    return () => {
      cancelled = true;
    };
  }, [panel, status?.enabled]);

  useSpotDelta(
    useCallback((payload) => {
      if (payload?.conversationId !== conversationRef.current) return;
      setStreamed((prev) => prev + (payload.text ?? ""));
    }, [])
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd?.({ animated: true });
  }, [messages.length, streamed, overQuota]);

  const append = useCallback((...items) => {
    setMessages((prev) => [...prev, ...items]);
  }, []);

  const navigate = useCallback(
    (screen, params) => navigation.navigate(screen, params),
    [navigation]
  );

  const consent = useCallback(async () => {
    setConsenting(true);
    try {
      await giveSpotConsent();
      setStatus((prev) => ({ ...prev, consented: true }));
    } catch {
      toast.error("Couldn't save that. Try again.");
    } finally {
      setConsenting(false);
    }
  }, [toast]);

  /** Software first. Returns true when the message was answered here. */
  const answerLocally = useCallback(
    async (text) => {
      const intent = resolveIntent(text, { pets, units });
      if (!intent) return false;

      if (intent.kind === "emergency") {
        append(local("user", text), answerEmergency(toxinTable?.contacts ?? []));
        return true;
      }
      if (intent.kind === "open") {
        append(local("user", text), answerOpen(intent.screen, intent.params));
        return true;
      }
      if (intent.kind === "fact") {
        append(local("user", text), answerFact(intent.pet, intent.fact, units));
        return true;
      }
      if (intent.kind === "convert") {
        append(local("user", text), answerConvert(intent));
        return true;
      }
      if (intent.kind === "toxin") {
        const answer = answerToxin(intent.query, toxinTable?.toxins ?? [], toxinTable?.contacts ?? []);
        if (!answer) return false; // a miss goes to the model, which can reason about a fuzzy name
        append(local("user", text), answer);
        return true;
      }
      if (intent.kind === "due") {
        append(local("user", text));
        try {
          const vaccination = await fetchVaccinationStatus(intent.pet._id);
          append(answerDue(intent.pet, vaccination));
        } catch {
          append(local("assistant", "I couldn't reach your records just now. Try again in a moment."));
        }
        return true;
      }
      if (intent.kind === "weight") {
        append(local("user", text));
        try {
          const entry = await addWeight(intent.pet._id, { pounds: intent.pounds });
          append(answerWeight(intent.pet, entry, units));
        } catch {
          append(local("assistant", "I couldn't save that weigh-in. Try again in a moment."));
        }
        return true;
      }
      return false;
    },
    [append, pets, units, toxinTable]
  );

  const send = useCallback(async (spoken) => {
    const text = (typeof spoken === "string" ? spoken : draft).trim();
    if (!text && !photo) return;
    if (sending) return;
    const byVoice = typeof spoken === "string";
    if (!byVoice) setHandsFree(false);

    setDraft("");
    setOverQuota(null);

    if (!photo && (await answerLocally(text))) return;

    const image = photo;
    setPhoto(null);
    setSending(true);
    setStreamed("");

    const pending = local("user", text, {
      source: "model",
      attachments: image ? [{ kind: "photo", width: image.width, height: image.height }] : [],
    });
    append(pending);

    try {
      let id = conversationRef.current;
      if (!id) {
        const created = await createConversation();
        id = created._id;
        setConversationId(id);
        conversationRef.current = id;
      }
      const result = await sendSpotMessage(id, {
        text: context && messages.length === 0 ? `${text}\n\n(Asked from ${describeContext(context, pets)})` : text,
        image,
      });
      setMessages((prev) =>
        prev.map((m) => (m._id === pending._id ? result.userMessage ?? m : m)).concat(result.message ?? [])
      );
      if (result.quota) setQuota(result.quota);
      if (byVoice && result.message?.text) speakRef.current?.speak(result.message, { thenListen: true });
    } catch (error) {
      if (error.code === SPOT_ERRORS.quota) {
        setOverQuota(error.body);
        setQuota({ used: error.body.used, limit: error.body.limit, premium: error.body.premium });
      } else if (error.code === SPOT_ERRORS.consent) {
        setStatus((prev) => ({ ...prev, consented: false }));
      } else if (error.code === SPOT_ERRORS.disabled) {
        setStatus((prev) => ({ ...prev, enabled: false }));
      } else {
        toast.error("Spot couldn't answer just now. Try again in a moment.");
      }
    } finally {
      setSending(false);
      setStreamed("");
    }
  }, [draft, photo, sending, answerLocally, append, context, messages.length, pets, toast]);

  const attach = useCallback(async () => {
    try {
      const picked = await pickPhoto({ fromCamera: false });
      if (picked.cancelled) {
        if (picked.denied) toast.error("Allow photo access in your phone's settings to attach one.");
        return;
      }
      setPhoto(await compressForSpot(picked.asset.uri));
    } catch {
      toast.error("Couldn't read that photo.");
    }
  }, [toast]);

  const flag = useCallback(
    async (message) => {
      try {
        await flagSpotMessage(conversationRef.current, message._id);
        toast.success("Thanks. Somebody will look at that answer.");
      } catch {
        toast.error("Couldn't send that. Try again.");
      }
    },
    [toast]
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop().catch?.(() => {});
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch {
        // already gone
      }
      playerRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  /**
   * Reads one answer aloud: the AI voice when the server has one, the
   * phone's own voice otherwise. Tapping the one being read stops it.
   */
  const speak = useCallback(
    async (message, { thenListen = false } = {}) => {
      if (speakingId === message._id) {
        stopSpeaking();
        return;
      }
      stopSpeaking();
      setSpeakingId(message._id);
      const finished = () => {
        setSpeakingId((current) => (current === message._id ? null : current));
        if (thenListen) speakRef.current?.listen();
      };
      if (status?.voice && conversationRef.current && !String(message._id).startsWith("local-")) {
        try {
          const player = createAudioPlayer(await audioSource(conversationRef.current, message._id));
          playerRef.current = player;
          player.addListener("playbackStatusUpdate", (state) => {
            if (state?.didJustFinish) {
              player.remove();
              if (playerRef.current === player) playerRef.current = null;
              finished();
            }
          });
          player.play();
          return;
        } catch {
          // fall through to the phone's voice
        }
      }
      Speech.speak(message.text, { onDone: finished, onStopped: () => setSpeakingId(null), onError: finished });
    },
    [speakingId, status?.voice, stopSpeaking]
  );

  /** Listens once; the words land in the box, and in hands-free mode they send. */
  const listen = useCallback(async () => {
    if (listening) {
      stopListeningRef.current?.();
      return;
    }
    stopSpeaking();
    const permission = await requestDictationPermission();
    if (permission !== "granted") {
      if (permission === "denied") toast.error("Allow the microphone in your phone's settings to speak to Spot.");
      return;
    }
    setListening(true);
    setHandsFree(true);
    stopListeningRef.current = startDictation({
      onInterim: (text) => setDraft(text),
      onFinal: (text) => {
        setDraft(text);
        if (text.trim()) speakRef.current?.sendNow(text);
      },
      onError: (sentence) => toast.error(sentence),
      onEnd: () => {
        setListening(false);
        stopListeningRef.current = null;
      },
    });
  }, [listening, stopSpeaking, toast]);

  useEffect(
    () => () => {
      stopListeningRef.current?.();
      Speech.stop().catch?.(() => {});
      playerRef.current?.remove?.();
    },
    []
  );

  // The handlers reach each other through a ref: `listen` sends what it heard
  // and `send` reads the answer back, and neither can be defined before the other.
  useEffect(() => {
    speakRef.current = { speak, listen, sendNow: (text) => send(text) };
  }, [speak, listen, send]);

  const startNew = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    conversationRef.current = null;
    setPanel(null);
  }, []);

  const openConversation = useCallback(
    async (id) => {
      try {
        const conversation = await fetchConversation(id);
        setMessages(conversation.messages);
        setConversationId(id);
        conversationRef.current = id;
        setPanel(null);
      } catch {
        toast.error("Couldn't open that conversation.");
      }
    },
    [toast]
  );

  const removeConversation = useCallback(
    async (id) => {
      try {
        await deleteConversation(id);
        setRecent((rows) => (rows ?? []).filter((row) => row._id !== id));
        if (conversationId === id) {
          setMessages([]);
          setConversationId(null);
        }
      } catch {
        toast.error("Couldn't delete that.");
      }
    },
    [conversationId, toast]
  );

  const removeNote = useCallback(
    async (id) => {
      try {
        await deleteNote(id);
        setNotes((rows) => (rows ?? []).filter((row) => row._id !== id));
      } catch {
        toast.error("Couldn't delete that.");
      }
    },
    [toast]
  );

  const undo = useCallback(
    async (block) => {
      try {
        await undoBlock(block);
        toast.success("Undone.");
      } catch (error) {
        toast.error("Couldn't undo that.");
        throw error;
      }
    },
    [toast]
  );

  // -------------------------------------------------------------------------

  if (status && !status.enabled) {
    return (
      <Screen testID="spot-off">
        <EmptyState
          icon="paw-outline"
          title="Spot isn't available right now"
          message="The poison lookup, your records and the care hub all still work."
          actionLabel="Is this dangerous?"
          onAction={() => navigation.navigate("ToxinLookup")}
        />
      </Screen>
    );
  }

  const chips = chipsFor(pets, context);
  const empty = messages.length === 0 && !sending;
  const canSend = (draft.trim().length > 0 || photo) && !sending;

  const iconButton = (name, label, testID, onPress) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}
    >
      <Ionicons name={name} size={22} color={tokens.textMuted} />
    </Pressable>
  );

  const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "");

  return (
    <Screen testID="spot" padded={false}>
      <SpotConsentSheet
        visible={Boolean(status && status.enabled && !status.consented)}
        busy={consenting}
        onContinue={consent}
        onNotNow={() => navigation.goBack()}
      />

      <View style={tailwind("flex-row justify-end px-sm")}>
        {iconButton("time-outline", "Recent conversations", "spot-open-recent", () =>
          setPanel((current) => (current === "recent" ? null : "recent"))
        )}
        {iconButton("bookmark-outline", "What Spot remembers", "spot-open-notes", () =>
          setPanel((current) => (current === "notes" ? null : "notes"))
        )}
      </View>

      {panel ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tailwind("px-lg pb-lg")} testID={`spot-panel-${panel}`}>
          <View style={tailwind("flex-row items-center justify-between mb-sm")}>
            <Text variant="title">{panel === "recent" ? "Recent" : "What Spot remembers"}</Text>
            {iconButton("close-outline", "Close", "spot-panel-close", () => setPanel(null))}
          </View>
          {panel === "recent" ? (
            <>
              <Button title="New conversation" variant="soft" testID="spot-new" onPress={startNew} style={tailwind("mb-md")} />
              {recent === null ? (
                <ActivityIndicator color={tokens.primary} />
              ) : recent.length === 0 ? (
                <Text tone="muted">Nothing yet. Spot keeps your five most recent conversations.</Text>
              ) : (
                recent.map((row) => (
                  <Card key={row._id} testID={`spot-recent-${row._id}`} style={tailwind("mb-sm")}>
                    <View style={tailwind("flex-row items-center")}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${row.title || "conversation"}`}
                        testID={`spot-open-${row._id}`}
                        onPress={() => openConversation(row._id)}
                        style={[tailwind("flex-1"), { minHeight: 44, justifyContent: "center" }]}
                      >
                        <Text weight="600" numberOfLines={1}>
                          {row.title || "Untitled"}
                        </Text>
                        <Text variant="caption" tone="faint">
                          {when(row.updatedAt)}
                          {row.messageCount ? ` · ${row.messageCount} messages` : ""}
                        </Text>
                      </Pressable>
                      {iconButton("trash-outline", "Delete conversation", `spot-delete-${row._id}`, () =>
                        removeConversation(row._id)
                      )}
                    </View>
                  </Card>
                ))
              )}
            </>
          ) : (
            <>
              <Text tone="muted" style={tailwind("mb-md")}>
                Things you asked Spot to remember, in your words. They go with every message you send it.
              </Text>
              {notes === null ? (
                <ActivityIndicator color={tokens.primary} />
              ) : notes.length === 0 ? (
                <Text tone="muted" testID="spot-notes-empty">
                  {'Nothing yet. Tell Spot something worth remembering, like "Bella is scared of thunderstorms".'}
                </Text>
              ) : (
                notes.map((note) => (
                  <Card key={note._id} testID={`spot-note-${note._id}`} style={tailwind("mb-sm")}>
                    <View style={tailwind("flex-row items-center")}>
                      <Text style={tailwind("flex-1")}>{note.text}</Text>
                      {iconButton("trash-outline", "Forget this", `spot-forget-${note._id}`, () => removeNote(note._id))}
                    </View>
                  </Card>
                ))
              )}
            </>
          )}
        </ScrollView>
      ) : null}

      <KeyboardAvoidingView
        style={[tailwind("flex-1"), panel ? { display: "none" } : null]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={tailwind("px-lg pt-md pb-lg")}
        >
          {empty ? (
            <View testID="spot-empty">
              <Text variant="display">Spot</Text>
              <Text tone="muted" style={tailwind("mt-xs mb-md")}>
                Ask about your pets, what is dangerous for them, what is due,
                or where the nearest vet is. Spot is not a vet and always
                points you to one.
              </Text>
              <View style={tailwind("flex-row flex-wrap")}>
                {chips.map((chip) => (
                  <Button
                    key={chip}
                    title={chip}
                    variant="secondary"
                    fullWidth={false}
                    testID="spot-chip"
                    onPress={() => setDraft(chip)}
                    style={tailwind("mr-sm mb-sm")}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {messages.map((message) => (
            <SpotMessage
              key={message._id}
              message={message}
              onNavigate={navigate}
              onUndo={undo}
              onFlag={conversationId ? flag : undefined}
              onSpeak={message.role === "assistant" ? speak : undefined}
              speaking={speakingId === message._id}
            />
          ))}

          {sending ? (
            <View style={tailwind("mb-lg")} testID="spot-thinking">
              {streamed ? (
                <Text>{streamed}</Text>
              ) : (
                <View style={tailwind("flex-row items-center")}>
                  <ActivityIndicator color={tokens.primary} />
                  <Text tone="muted" style={tailwind("ml-sm")}>
                    Spot is looking…
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {overQuota ? (
            <QuotaNotice quota={overQuota} onPremium={() => navigation.navigate("ChoosePlan")} />
          ) : null}
        </ScrollView>

        <View style={tailwind("px-lg pt-sm pb-md bg-surface border-t border-border")}>
          {photo ? (
            <View style={tailwind("flex-row items-center mb-sm")} testID="spot-photo-attached">
              <Ionicons name="image-outline" size={18} color={tokens.primary} />
              <Text variant="caption" tone="primary" style={tailwind("ml-xs flex-1")}>
                Photo attached
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                testID="spot-photo-remove"
                onPress={() => setPhoto(null)}
                style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}
              >
                <Ionicons name="close-circle-outline" size={22} color={tokens.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <View style={tailwind("flex-row items-end")}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach a photo"
              testID="spot-attach"
              onPress={attach}
              disabled={sending}
              style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}
            >
              <Ionicons name="camera-outline" size={24} color={tokens.textMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={listening ? "Stop listening" : "Speak to Spot"}
              accessibilityState={{ selected: listening }}
              testID="spot-mic"
              onPress={listen}
              disabled={sending}
              style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}
            >
              <Ionicons name={listening ? "mic" : "mic-outline"} size={24} color={listening ? tokens.danger : tokens.textMuted} />
            </Pressable>
            <TextInput
              testID="spot-input"
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (handsFree) setHandsFree(false);
              }}
              placeholder={listening ? "Listening…" : "Ask Spot…"}
              placeholderTextColor={tokens.textFaint}
              multiline
              accessibilityLabel="Message Spot"
              editable={!sending}
              style={[
                tailwind("flex-1 bg-bg border border-border rounded-md px-md py-sm text-text mx-sm"),
                { minHeight: 44, maxHeight: 120 },
              ]}
            />
            <Button
              title="Send"
              fullWidth={false}
              disabled={!canSend}
              testID="spot-send"
              onPress={send}
              icon={<Ionicons name="arrow-up" size={18} color={tokens.onPrimary} />}
            />
          </View>
          {quota ? (
            <Text variant="caption" tone="faint" style={tailwind("mt-xs")} testID="spot-quota-caption">
              {quota.used} of {quota.limit} Spot messages today
              {handsFree ? " · hands-free: Spot reads answers aloud" : ""}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

/** "Bella's health screen", for a question asked from a screen. */
const describeContext = (context, pets) => {
  if (context?.petId) {
    const pet = pets.find((p) => String(p._id) === String(context.petId));
    return pet ? `${pet.name}'s ${context.screen ?? "pet"} screen` : "a pet's screen";
  }
  if (context?.articleId) {
    return context.title ? `the article "${context.title}"` : "an article";
  }
  if (context?.playdateId) return `a playdate (playdateId ${context.playdateId})`;
  if (context?.orderId) return `an order (orderId ${context.orderId})`;
  if (context?.chatId) return "a chat with another owner";
  return `the ${context?.screen ?? "app"}`;
};

export default SpotScreen;
