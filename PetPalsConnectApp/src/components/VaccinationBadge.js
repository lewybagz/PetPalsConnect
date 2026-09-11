import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../styles/tailwind";
import { useTokens } from "../context/AppThemeContext";
import { Text } from "./ui";
import { describeVaccination, fetchVaccinationStatus } from "../api/health";

/**
 * A pet's vaccination status, as a pill.
 *
 * Takes a `status` when the caller already has one - every deck card does -
 * or a `petId` and fetches it. It renders nothing until it has an answer,
 * because a placeholder pill that says nothing is a pill somebody reads as
 * "no vaccinations".
 *
 * The wording comes from `describeVaccination`, which never says "verified":
 * this is what an owner entered, and the note on the pill says so.
 */
const VaccinationBadge = ({ status: given, petId, style, testID = "vaccination-badge" }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (given || !petId) return undefined;

    let cancelled = false;
    fetchVaccinationStatus(petId)
      .then((status) => {
        if (!cancelled) setFetched(status);
      })
      .catch(() => {
        // A card without the pill is a card; a card with an error on it is not.
      });

    return () => {
      cancelled = true;
    };
  }, [given, petId]);

  const described = describeVaccination(given ?? fetched);
  if (!described) return null;

  const colour = {
    success: tokens.success,
    warning: tokens.warning,
    muted: tokens.textMuted,
  }[described.tone];

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={
        described.note ? `${described.label}, ${described.note}` : described.label
      }
      style={[
        tailwind("flex-row items-center self-start bg-surfaceAlt rounded-pill px-md py-xs"),
        style,
      ]}
    >
      <Ionicons name={described.icon} size={14} color={colour} />
      <Text variant="caption" tone={described.tone} weight="600" style={tailwind("ml-xs")}>
        {described.label}
      </Text>
      {described.note ? (
        <Text variant="caption" tone="faint" style={tailwind("ml-xs")}>
          · {described.note}
        </Text>
      ) : null}
    </View>
  );
};

export default VaccinationBadge;
