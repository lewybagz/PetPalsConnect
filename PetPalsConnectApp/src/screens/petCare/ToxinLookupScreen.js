import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Pressable, Linking, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen, Card, Text, ListSkeleton } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import {
  fetchToxins,
  searchToxins,
  SEVERITY_LABELS,
  SEVERITY_BLURBS,
} from "../../api/toxins";

/**
 * "My dog just ate this - is it bad?"
 *
 * The screen describes published guidance and never prescribes. There is no
 * question about how much was eaten, no threshold, and no branch that answers
 * whether to worry: that is triage, and the amount is exactly the judgement
 * the helpline exists to make. Every path through this screen ends at a phone
 * number, including - especially - a search that finds nothing.
 *
 * The numbers are rendered before the first keystroke and after every result,
 * and they come from the same table as the hub's emergency card, so a person
 * who opens this screen and immediately gives up still has what they came for.
 *
 * The table is cached, so the whole thing works with no signal. This is the
 * screen somebody opens in a garage at midnight.
 */

const SEVERITY_TONE = {
  emergency: "danger",
  call: "warning",
  avoid: "border",
};

const ToxinLookupScreen = () => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const [query, setQuery] = useState("");
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchToxins()
      .then((payload) => {
        if (cancelled) return;
        setTable(payload);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTable({ toxins: [], contacts: [], stale: true });
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toxins = table?.toxins ?? [];
  const contacts = table?.contacts ?? [];

  // Searching is pure and the table is small, so there is nothing to debounce
  // and no request to race: results follow the keystroke.
  const results = useMemo(() => searchToxins(toxins, query), [toxins, query]);
  const searching = query.trim().length > 0;

  const call = useCallback((phone) => {
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() => {});
  }, []);

  const openSource = useCallback((url) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  return (
    <Screen testID="toxin-lookup">
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text variant="display">Is this dangerous?</Text>
        <Text tone="muted" style={tailwind("mt-xs mb-md")}>
          What published guidance says about things pets eat. It cannot tell you
          whether your pet is in trouble - the helpline can.
        </Text>

        {/* Before the search box, not after it. Somebody who opens this screen
            in a panic and never types anything still has the number. */}
        <Card testID="toxin-contacts" style={tailwind("border-danger mb-md")}>
          <View style={tailwind("flex-row items-center mb-sm")}>
            <Ionicons name="call-outline" size={20} color={tokens.danger} />
            <Text variant="title" style={tailwind("ml-sm")}>
              Ring somebody now
            </Text>
          </View>
          {contacts.length === 0 ? (
            <Text tone="muted">
              Contact your vet, or the nearest emergency clinic.
            </Text>
          ) : (
            contacts.map((contact) => (
              <Pressable
                key={contact.id}
                testID={`toxin-call-${contact.id}`}
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
            ))
          )}
        </Card>

        <TextInput
          testID="toxin-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Chocolate, grapes, rat poison…"
          placeholderTextColor={tokens.textFaint}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search for a food, plant or product"
          style={[
            tailwind("bg-surface border border-border rounded-md px-md text-text"),
            { minHeight: 44 },
          ]}
        />

        {loading ? (
          <View style={tailwind("mt-md")}>
            <ListSkeleton />
          </View>
        ) : (
          <View style={tailwind("mt-md")}>
            {table?.stale && toxins.length > 0 ? (
              <Text variant="caption" tone="faint" style={tailwind("mb-sm")}>
                Showing the copy saved on this device.
              </Text>
            ) : null}

            {searching && results.length === 0 ? (
              /* A miss is a real answer and it still ends at the helpline.
                 Saying nothing here, or showing an approximate match, are the
                 two ways this screen could do harm. */
              <Card testID="toxin-no-match" style={tailwind("border-warning")}>
                <Text variant="title">Not in this list</Text>
                <Text tone="muted" style={tailwind("mt-xs")}>
                  That does not mean it is safe. This list covers the things
                  pets are most often brought in for, and it is not everything.
                  If your pet has eaten it, ring one of the numbers above.
                </Text>
              </Card>
            ) : null}

            {(searching ? results : toxins).map((toxin) => (
              <Card
                key={toxin.slug}
                testID={`toxin-${toxin.slug}`}
                style={tailwind(`mb-sm border-${SEVERITY_TONE[toxin.severity] ?? "border"}`)}
              >
                <Text variant="title">{toxin.name}</Text>
                <Text
                  variant="caption"
                  tone={toxin.severity === "emergency" ? "danger" : "muted"}
                  style={tailwind("mt-xs")}
                >
                  {(SEVERITY_LABELS[toxin.severity] ?? "").toUpperCase()}
                </Text>
                <Text tone="muted" style={tailwind("mt-xs")}>
                  {SEVERITY_BLURBS[toxin.severity]}
                </Text>

                <Text weight="600" style={tailwind("mt-sm")}>
                  What it looks like
                </Text>
                <Text tone="muted">{toxin.signs}</Text>

                <Text weight="600" style={tailwind("mt-sm")}>
                  What the guidance says
                </Text>
                <Text tone="muted">{toxin.guidance}</Text>

                <View style={tailwind("mt-sm")}>
                  {toxin.sources.map((source) => (
                    <Pressable
                      key={source.url}
                      testID={`toxin-source-${toxin.slug}`}
                      accessibilityRole="link"
                      accessibilityLabel={`Open ${source.name}`}
                      onPress={() => openSource(source.url)}
                      style={tailwind("py-xs")}
                    >
                      <Text variant="caption" tone="primary">
                        {source.name} ({source.year})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
};

export default ToxinLookupScreen;
