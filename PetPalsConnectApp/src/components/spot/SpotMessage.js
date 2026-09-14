import React, { useCallback, useState } from "react";
import { View, Pressable, Linking, Image, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card, Text } from "../ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";

/**
 * One turn in a Spot conversation, and the rich pieces beside it.
 *
 * Spot's replies are not bubbles. A three-paragraph answer about
 * leptospirosis should read like the article it is quoting, so it is a
 * full-width reading column in the body face; the person's own messages are
 * compact pills on the right. Blocks are cards: a chip row that navigates, a
 * "Spot did this" card with its undo, and the helpline numbers rendered the
 * way the toxin screen renders them - tappable, with the region and the fee
 * note on the same line as the number.
 */

const Links = ({ items = [], onNavigate }) => {
  const tailwind = useTailwind();
  if (items.length === 0) return null;
  return (
    <View style={tailwind("flex-row flex-wrap mt-sm")} testID="spot-links">
      {items.map((chip) => (
        <Button
          key={`${chip.screen}-${JSON.stringify(chip.params)}`}
          title={chip.label}
          variant="soft"
          fullWidth={false}
          testID={`spot-link-${chip.screen}`}
          onPress={() => onNavigate?.(chip.screen, chip.params)}
          style={tailwind("mr-sm mb-sm")}
        />
      ))}
    </View>
  );
};

const Done = ({ block, onUndo }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const [state, setState] = useState("done");

  const undo = useCallback(async () => {
    setState("undoing");
    try {
      await onUndo?.(block);
      setState("undone");
    } catch {
      setState("done");
    }
  }, [block, onUndo]);

  return (
    <Card testID="spot-done" style={tailwind("mt-sm border-success")}>
      <View style={tailwind("flex-row items-center")}>
        <Ionicons
          name={state === "undone" ? "arrow-undo-outline" : "checkmark-circle-outline"}
          size={20}
          color={state === "undone" ? tokens.textMuted : tokens.success}
        />
        <Text style={tailwind("ml-sm flex-1")} tone={state === "undone" ? "muted" : undefined}>
          {state === "undone" ? "Undone" : block.summary}
        </Text>
      </View>
      {block.undo && state !== "undone" ? (
        <Button
          title="Undo"
          variant="ghost"
          fullWidth={false}
          loading={state === "undoing"}
          testID="spot-undo"
          onPress={undo}
          style={tailwind("mt-xs self-start")}
        />
      ) : null}
    </Card>
  );
};

/** An article, a place, a pal's pet: a picture, two lines, and the tap the chip had. */
const Cards = ({ items = [], onNavigate }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  if (items.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tailwind("mt-sm")} testID="spot-cards">
      {items.map((item) => (
        <Pressable
          key={`${item.chip.screen}-${JSON.stringify(item.chip.params)}`}
          testID={`spot-card-${item.chip.screen}`}
          accessibilityRole="button"
          accessibilityLabel={`${item.chip.label}: ${item.title}`}
          onPress={() => onNavigate?.(item.chip.screen, item.chip.params)}
          style={[tailwind("mr-sm"), { width: 180 }]}
        >
          <Card style={tailwind("p-0 overflow-hidden")}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={{ width: "100%", height: 100 }} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[tailwind("bg-primarySoft items-center justify-center"), { height: 64 }]}>
                <Ionicons
                  name={item.chip.screen === "ArticleDetail" ? "book-outline" : item.chip.screen === "PetDetails" ? "paw-outline" : "location-outline"}
                  size={24}
                  color={tokens.primary}
                />
              </View>
            )}
            <View style={tailwind("p-sm")}>
              <Text weight="600" numberOfLines={1}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text variant="caption" tone="muted" numberOfLines={2}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
};

/** Retailer searches from the picks table. Opens the browser; never a named product. */
const Web = ({ items = [] }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  if (items.length === 0) return null;
  return (
    <Card testID="spot-web" style={tailwind("mt-sm")}>
      {items.map((item) => (
        <Pressable
          key={item.url}
          testID="spot-web-link"
          accessibilityRole="link"
          accessibilityLabel={`Search for ${item.label}`}
          onPress={() => Linking.openURL(item.url).catch(() => {})}
          style={[tailwind("flex-row items-center"), { minHeight: 44 }]}
        >
          <Ionicons name="open-outline" size={18} color={tokens.primary} />
          <Text tone="primary" style={tailwind("ml-sm flex-1")}>
            {item.label}
          </Text>
        </Pressable>
      ))}
      <Text variant="caption" tone="faint" style={tailwind("mt-xs")}>
        Categories to search for, not products. PetPals is not paid for these.
      </Text>
    </Card>
  );
};

const Contacts = ({ items = [] }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const call = useCallback((phone) => {
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
  }, []);

  return (
    <Card testID="spot-contacts" style={tailwind("mt-sm border-danger")}>
      <View style={tailwind("flex-row items-center mb-xs")}>
        <Ionicons name="call-outline" size={20} color={tokens.danger} />
        <Text variant="title" style={tailwind("ml-sm")}>
          Ring somebody now
        </Text>
      </View>
      {items.map((contact) => (
        <Pressable
          key={contact.id}
          testID={`spot-call-${contact.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Call ${contact.name} on ${contact.phone}`}
          onPress={() => call(contact.phone)}
          style={tailwind("py-sm")}
        >
          <Text weight="600">{contact.name}</Text>
          <Text tone="primary">{contact.phone}</Text>
          <Text variant="caption" tone="faint">
            {[contact.region, contact.note].filter(Boolean).join(" · ")}
          </Text>
        </Pressable>
      ))}
    </Card>
  );
};

const Block = ({ block, onNavigate, onUndo }) => {
  switch (block?.type) {
    case "links":
      return <Links items={block.items} onNavigate={onNavigate} />;
    case "done":
      return <Done block={block} onUndo={onUndo} />;
    case "contacts":
      return <Contacts items={block.items} />;
    case "web":
      return <Web items={block.items} />;
    case "cards":
      return <Cards items={block.items} onNavigate={onNavigate} />;
    default:
      return null;
  }
};

const SpotMessage = ({ message, onNavigate, onUndo, onFlag, onSpeak, speaking = false }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const [flagged, setFlagged] = useState(Boolean(message.flagged));

  if (message.role === "user") {
    const photo = (message.attachments ?? []).some((a) => a.kind === "photo");
    return (
      <View style={tailwind("items-end mb-md")} testID="spot-user-message">
        <View style={tailwind("bg-primarySoft rounded-lg px-md py-sm max-w-[85%]")}>
          {photo ? (
            <View style={tailwind("flex-row items-center mb-xs")}>
              <Ionicons name="image-outline" size={16} color={tokens.primary} />
              <Text variant="caption" tone="primary" style={tailwind("ml-xs")}>
                Photo
              </Text>
            </View>
          ) : null}
          {message.text ? <Text tone="primary">{message.text}</Text> : null}
        </View>
      </View>
    );
  }

  const paragraphs = String(message.text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <View style={tailwind("mb-lg")} testID="spot-assistant-message">
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={tailwind(index > 0 ? "mt-sm" : "")}>
          {paragraph}
        </Text>
      ))}
      {(message.blocks ?? []).map((block, index) => (
        <Block key={index} block={block} onNavigate={onNavigate} onUndo={onUndo} />
      ))}
      {onSpeak && message.text ? (
        <Pressable
          testID="spot-speak"
          accessibilityRole="button"
          accessibilityLabel={speaking ? "Stop reading" : "Read aloud"}
          onPress={() => onSpeak(message)}
          style={[tailwind("mt-sm self-start flex-row items-center"), { minHeight: 44 }]}
        >
          <Ionicons name={speaking ? "stop-circle-outline" : "volume-medium-outline"} size={18} color={tokens.textMuted} />
          <Text variant="caption" tone="muted" style={tailwind("ml-xs")}>
            {speaking ? "Stop" : "Read aloud"}
          </Text>
        </Pressable>
      ) : null}
      {message.source === "model" && onFlag ? (
        <Pressable
          testID="spot-flag"
          accessibilityRole="button"
          accessibilityLabel={flagged ? "Reported" : "Report this answer"}
          disabled={flagged}
          onPress={async () => {
            await onFlag(message);
            setFlagged(true);
          }}
          style={[tailwind("mt-sm self-start"), { minHeight: 44, justifyContent: "center" }]}
        >
          <Text variant="caption" tone="faint">
            {flagged ? "Reported. Thank you." : "Something wrong with this answer?"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export default SpotMessage;
