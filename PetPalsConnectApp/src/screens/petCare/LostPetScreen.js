import { useCallback, useEffect, useState } from "react";
import { View, Pressable, Linking, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen, Card, Text, ListSkeleton } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import AskSpotButton from "../../components/spot/AskSpotButton";

import { useTokens } from "../../context/AppThemeContext";
import { fetchLostPet } from "../../api/lostPet";
import { KIND_LABELS } from "../../api/health";

/**
 * What to do in the first hours after a pet goes missing.
 *
 * The checklist describes published guidance, in order, each step citing where
 * it came from. What makes it more than an article is the top card: the
 * owner's own chip numbers, because the first step is "check the registration"
 * and answering it otherwise means going to find a number while panicking.
 *
 * Deliberately not here: a broadcast to other users, a map of lost pets, an
 * alert radius. None of the apps surveyed ship one, and a feature that implies
 * a search party exists when it does not would be worse than this.
 */
const LostPetScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchLostPet()
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData({ steps: [], contacts: [], identification: [], stale: true });
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const open = useCallback((url) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  const steps = data?.steps ?? [];
  const identification = data?.identification ?? [];

  return (
    <Screen testID="lost-pet">
      <ScrollView contentContainerStyle={{ paddingBottom: 72 }}>
        <Text variant="display">If your pet is missing</Text>
        <Text tone="muted" style={tailwind("mt-xs mb-md")}>
          The first hours matter most. Work down this list.
        </Text>

        {loading ? (
          <ListSkeleton />
        ) : (
          <>
            {/* The owner's own numbers, above the advice that needs them. */}
            <Card testID="lost-pet-identification" style={tailwind("mb-md")}>
              <View style={tailwind("flex-row items-center mb-sm")}>
                <Ionicons name="barcode-outline" size={20} color={tokens.primary} />
                <Text variant="title" style={tailwind("ml-sm")}>
                  Your numbers
                </Text>
              </View>

              {identification.length === 0 ? (
                <>
                  <Text tone="muted">
                    You have not recorded a microchip number. About half of pets
                    have a chip and many of those are registered to an address
                    that is out of date - it is the single thing most likely to
                    bring a pet home.
                  </Text>
                  <Pressable
                    testID="lost-pet-add-chip"
                    accessibilityRole="button"
                    accessibilityLabel="Add a microchip number"
                    onPress={() => navigation?.navigate?.("Profile")}
                    style={tailwind("pt-sm")}
                  >
                    <Text tone="primary" weight="600">
                      Add one from your pet{String.fromCharCode(8217)}s health records
                    </Text>
                  </Pressable>
                </>
              ) : (
                identification.map((row) => (
                  <View
                    key={`${row.petId}-${row.kind}-${row.label}`}
                    testID={`lost-pet-id-${row.kind}`}
                    style={tailwind("py-xs")}
                  >
                    <Text variant="caption" tone="faint">
                      {[row.petName, KIND_LABELS[row.kind] ?? row.kind]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    <Text weight="600">{row.label}</Text>
                  </View>
                ))
              )}
            </Card>

            {steps.map((step, index) => (
              <Card key={step.id} testID={`lost-pet-step-${step.id}`} style={tailwind("mb-sm")}>
                <Text variant="caption" tone="faint">
                  STEP {index + 1}
                </Text>
                <Text variant="title" style={tailwind("mt-xs")}>
                  {step.title}
                </Text>
                <Text tone="muted" style={tailwind("mt-xs")}>
                  {step.body}
                </Text>
                {step.source ? (
                  <Pressable
                    testID={`lost-pet-source-${step.id}`}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${step.source.name}`}
                    onPress={() => open(step.source.url)}
                    style={tailwind("pt-sm")}
                  >
                    <Text variant="caption" tone="primary">
                      {step.source.name}
                    </Text>
                  </Pressable>
                ) : null}
              </Card>
            ))}

            {steps.length === 0 ? (
              <Card testID="lost-pet-empty" style={tailwind("border-warning")}>
                <Text variant="title">Ring the shelters and vets near you</Text>
                <Text tone="muted" style={tailwind("mt-xs")}>
                  The full checklist could not be loaded. Start with the local
                  shelters, animal control and every vet within a few miles.
                </Text>
              </Card>
            ) : null}

            <Pressable
              testID="lost-pet-find-vets"
              accessibilityRole="button"
              accessibilityLabel="Find vets near me"
              onPress={() => navigation?.navigate?.("Care")}
              style={tailwind("py-md")}
            >
              <Text tone="primary" weight="600">
                Find vets and shelters near you
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <AskSpotButton navigation={navigation} context={{ screen: "missing pet checklist" }} />
    </Screen>
  );
};

export default LostPetScreen;
