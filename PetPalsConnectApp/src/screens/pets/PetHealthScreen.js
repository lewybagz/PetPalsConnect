import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../../api/axios";
import {
  KIND_LABELS,
  addHealthRecord,
  describeForOwner,
  fetchHealth,
  removeHealthRecord,
} from "../../api/health";
import { addPetPhoto } from "../../services/photos";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { hit } from "../../styles/tokens";
import {
  Button,
  Card,
  EmptyState,
  ListSkeleton,
  Screen,
  SettingsRow,
  SettingsSection,
  Text,
  useToast,
} from "../../components/ui";
import VaccinationBadge from "../../components/VaccinationBadge";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";

/**
 * A pet's vaccination records: what the owner has entered, and what that adds
 * up to.
 *
 * The app arranged for strangers' dogs to meet with no health information at
 * all - the one thing every daycare, boarder and group class asks to see
 * before a dog walks in. This is where an owner records it. What it is *not*
 * is verification: the words on this screen say "as you entered it", the
 * status somebody else sees says "owner-reported", and nothing here ever says
 * "verified", because nothing checked.
 *
 * It also stores no advice. Which vaccines a dog needs, and when, is a
 * conversation with a vet; this screen records the answer and remembers the
 * date.
 */

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** One selectable vaccine. A multi-way choice, so a radio rather than a checkbox. */
const KindChip = ({ label, selected, onPress, testID }) => {
  const tailwind = useTailwind();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        tailwind(
          `rounded-pill px-md mr-sm mb-sm border ${
            selected ? "bg-primary border-primary" : "bg-surface border-border"
          }`
        ),
        { minHeight: hit.min, justifyContent: "center" },
      ]}
    >
      <Text variant="body" tone={selected ? "onPrimary" : "default"}>
        {label}
      </Text>
    </Pressable>
  );
};

const PetHealthScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const petId = route?.params?.petId ?? route?.params?.pet?._id;
  const [pet, setPet] = useState(route?.params?.pet ?? null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(Boolean(petId));

  const [kind, setKind] = useState("rabies");
  const [administeredAt, setAdministeredAt] = useState(startOfToday);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState(startOfToday);
  const [certificatePhoto, setCertificatePhoto] = useState(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Bumped after a save or a delete, so the list is re-read from the server
  // rather than patched locally - the status is computed there.
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    if (!petId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const next = await fetchHealth(petId);
        if (!cancelled) setHealth(next);
      } catch (error) {
        if (cancelled) return;
        console.warn("[health]", error.message);
        toast.error("Could not load these records.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [petId, version, toast]);

  // A push notification arrives with an id and nothing else.
  useEffect(() => {
    if (pet || !petId) return undefined;

    let cancelled = false;
    api
      .get(`/api/pets/${petId}`)
      .then(({ data }) => {
        if (!cancelled) setPet(data);
      })
      .catch((error) => console.warn("[health]", error.message));

    return () => {
      cancelled = true;
    };
  }, [petId, pet]);

  const attachCertificate = async () => {
    setUploading(true);
    try {
      const result = await addPetPhoto({ petId, fromCamera: false });
      if (result.denied) {
        toast.warning("Photo access is off. You can turn it on in Settings.");
        return;
      }
      if (result.cancelled) return;
      setCertificatePhoto(result.url);
    } catch (error) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (hasExpiry && expiresAt <= administeredAt) {
      toast.show("The next due date has to be after the date it was given.");
      return;
    }

    setSaving(true);
    try {
      await addHealthRecord(petId, {
        kind,
        administeredAt: administeredAt.toISOString(),
        expiresAt: hasExpiry ? expiresAt.toISOString() : undefined,
        certificatePhoto: certificatePhoto ?? undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`${KIND_LABELS[kind]} recorded`);
      setCertificatePhoto(null);
      setNotes("");
      setHasExpiry(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (record) =>
    Alert.alert(`Remove this ${KIND_LABELS[record.kind]} record?`, undefined, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeHealthRecord(petId, record._id);
            load();
          } catch (error) {
            toast.error(error.response?.data?.message ?? "Couldn't remove that.");
          }
        },
      },
    ]);

  if (!petId) {
    return (
      <Screen testID="health-missing">
        <EmptyState title="This pet is no longer available." />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen testID="health-loading">
        <ListSkeleton rows={3} />
      </Screen>
    );
  }

  const records = health?.records ?? [];
  const kinds = health?.kinds ?? Object.keys(KIND_LABELS);

  const describeRecord = (record) => {
    const parts = [`Given ${formatDate(record.administeredAt)}`];
    if (record.expiresAt) parts.push(`next due ${formatDate(record.expiresAt)}`);
    if (record.verification === "documented") parts.push("certificate attached");
    return parts.join(" · ");
  };

  return (
    <Screen scroll testID="pet-health">
      <Text variant="title">{pet?.name ? `${pet.name}'s vaccinations` : "Vaccinations"}</Text>
      <Text variant="caption" tone="muted" style={tailwind("mt-xs mb-lg")}>
        As you enter it. PetPals doesn&apos;t check certificates - a daycare or
        boarder will still ask to see the originals.
      </Text>

      <Card testID="health-status" style={tailwind("mb-xl")}>
        <VaccinationBadge status={health?.status ?? "unknown"} />
        <Text variant="body" style={tailwind("mt-md")}>
          {describeForOwner(health?.status)}
        </Text>
      </Card>

      {records.length === 0 ? (
        <View testID="health-empty" style={tailwind("mb-xl")}>
          <EmptyState
            icon="shield-outline"
            title="Nothing recorded yet"
            message="Add each vaccination below, from the certificate your vet gave you."
          />
        </View>
      ) : (
        <SettingsSection title="Recorded" footer="Tap a record to remove it.">
          {records.map((record, index) => (
            <SettingsRow
              key={record._id}
              testID={`health-record-${index}`}
              label={KIND_LABELS[record.kind] ?? record.kind}
              description={describeRecord(record)}
              icon="shield-checkmark-outline"
              onPress={() => remove(record)}
            />
          ))}
        </SettingsSection>
      )}

      <SettingsSection title="Add a record">
        <SettingsRow label="Vaccine">
          <View style={tailwind("flex-row flex-wrap")}>
            {kinds.map((entry) => (
              <KindChip
                key={entry}
                testID={`health-kind-${entry}`}
                label={KIND_LABELS[entry] ?? entry}
                selected={kind === entry}
                onPress={() => setKind(entry)}
              />
            ))}
          </View>
        </SettingsRow>

        <SettingsRow label="Given on" description="The date on the certificate.">
          <View testID="health-given">
            <DateTimePickerComponent mode="date" date={administeredAt} onDateChange={setAdministeredAt} />
          </View>
        </SettingsRow>

        <SettingsRow
          testID="health-expiry-toggle"
          label="I know when the next dose is due"
          description="Your vet's certificate usually says. We'll remind you a month before."
          value={hasExpiry}
          onValueChange={setHasExpiry}
        />

        {hasExpiry ? (
          <SettingsRow label="Next due">
            <View testID="health-expiry">
              <DateTimePickerComponent mode="date" date={expiresAt} onDateChange={setExpiresAt} />
            </View>
          </SettingsRow>
        ) : null}

        <SettingsRow
          label="Certificate photo"
          description="Optional. Only you can see it."
        >
          {certificatePhoto ? (
            <View style={tailwind("flex-row items-center")}>
              <Image
                testID="health-certificate"
                source={{ uri: certificatePhoto }}
                style={tailwind("h-16 w-16 rounded-xl mr-md")}
              />
              <Button
                testID="health-remove-photo"
                title="Remove"
                variant="ghost"
                onPress={() => setCertificatePhoto(null)}
              />
            </View>
          ) : (
            <Button
              testID="health-add-photo"
              title={uploading ? "Uploading…" : "Attach a photo"}
              variant="secondary"
              disabled={uploading}
              onPress={attachCertificate}
            />
          )}
        </SettingsRow>

        <SettingsRow label="Notes" description="Optional. Batch number, clinic, anything you want to keep.">
          <TextInput
            testID="health-notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes"
            placeholderTextColor={tokens.textFaint}
            style={tailwind("border border-border rounded-card p-md text-text")}
            maxLength={500}
          />
        </SettingsRow>
      </SettingsSection>

      <Button
        testID="health-save"
        title={saving ? "Saving…" : "Save record"}
        onPress={save}
        disabled={saving || uploading}
      />

      <Pressable
        testID="health-done"
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={[tailwind("items-center py-lg"), { minHeight: hit.min }]}
      >
        <Text tone="muted">Done</Text>
      </Pressable>
      <View style={tailwind("flex-row items-center justify-center mb-xl")}>
        <Ionicons name="information-circle-outline" size={14} color={tokens.textFaint} />
        <Text variant="caption" tone="faint" style={tailwind("ml-xs")}>
          Which vaccines your dog needs is a question for your vet.
        </Text>
      </View>
    </Screen>
  );
};

export default PetHealthScreen;
