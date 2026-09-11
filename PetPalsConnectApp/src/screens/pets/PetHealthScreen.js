import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../../api/axios";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEFAULT_INTERVALS,
  KIND_LABELS,
  addHealthRecord,
  categoryOf,
  describeForOwner,
  fetchHealth,
  markDone,
  removeHealthRecord,
  repeats,
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
 * A pet's health records: what the owner has entered, and what that adds up
 * to.
 *
 * The app arranged for strangers' dogs to meet with no health information at
 * all - the one thing every daycare, boarder and group class asks to see
 * before a dog walks in. This is where an owner records it, and it is also the
 * app's recurring reason to open: the monthly preventatives are the reminders
 * people actually forget, and "Log today's dose" is what re-arms the next one.
 *
 * What it is *not* is verification: the words on this screen say "as you
 * entered it", the status somebody else sees says "owner-reported", and nothing
 * here ever says "verified", because nothing checked.
 *
 * It also stores no advice. Which vaccines a dog needs, how often a
 * preventative is given, what a medication is for - all of that is a
 * conversation with a vet; this screen records the answer and remembers the
 * date. A medication has a name and a date and deliberately no field for how
 * much.
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

/** One selectable kind. A multi-way choice, so a radio rather than a checkbox. */
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
  const [intervalDays, setIntervalDays] = useState("");
  const [label, setLabel] = useState("");
  const [certificatePhoto, setCertificatePhoto] = useState(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRecord, setBusyRecord] = useState(null);
  // Bumped after a save, a delete or a dose, so the list is re-read from the
  // server rather than patched locally - the status is computed there.
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

  const category = categoryOf(kind);
  const repeating = repeats(kind);

  const chooseKind = (next) => {
    setKind(next);
    // A repeating kind starts with the common cycle filled in; the owner
    // changes it rather than invents it.
    setIntervalDays(repeats(next) ? String(DEFAULT_INTERVALS[next] ?? "") : "");
    if (categoryOf(next) !== "medication") setLabel("");
  };

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
    const interval = repeating ? Number(intervalDays) : null;
    if (repeating && !(interval >= 1 && interval <= 730)) {
      toast.show("Enter how many days between doses, 1 to 730.");
      return;
    }
    if (category === "medication" && !label.trim()) {
      toast.show("Give the medication a name.");
      return;
    }
    if (hasExpiry && expiresAt <= administeredAt) {
      toast.show("The next due date has to be after the date it was given.");
      return;
    }

    // A repeating record is due one interval after it was given; a vaccine or
    // a visit is due when the owner says, if they say.
    const due = repeating
      ? new Date(administeredAt.getTime() + interval * 24 * 60 * 60 * 1000)
      : hasExpiry
        ? expiresAt
        : null;

    setSaving(true);
    try {
      await addHealthRecord(petId, {
        kind,
        administeredAt: administeredAt.toISOString(),
        expiresAt: due ? due.toISOString() : undefined,
        intervalDays: repeating ? interval : undefined,
        label: category === "medication" ? label.trim() : undefined,
        certificatePhoto: certificatePhoto ?? undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`${category === "medication" ? label.trim() : KIND_LABELS[kind]} recorded`);
      setCertificatePhoto(null);
      setNotes("");
      setLabel("");
      setHasExpiry(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const logDose = async (record) => {
    setBusyRecord(record._id);
    try {
      await markDone(petId, record._id);
      toast.success(`${nameOf(record)} logged for today`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Couldn't log that.");
    } finally {
      setBusyRecord(null);
    }
  };

  const remove = (record) =>
    Alert.alert(`Remove this ${nameOf(record)} record?`, undefined, [
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

  /**
   * Grouped by what they are, newest first inside each group, so the section
   * a stranger's card reads from - vaccinations - is on top and a monthly
   * preventative does not sit between two certificates.
   */
  const grouped = CATEGORY_ORDER.map((entry) => ({
    category: entry,
    records: records.filter((record) => categoryOf(record.kind) === entry),
  })).filter((group) => group.records.length > 0);

  const describeRecord = (record) => {
    const parts = [`Given ${formatDate(record.administeredAt)}`];
    if (record.expiresAt) parts.push(`next due ${formatDate(record.expiresAt)}`);
    if (record.intervalDays) parts.push(`every ${record.intervalDays} days`);
    if (record.verification === "documented") parts.push("certificate attached");
    return parts.join(" · ");
  };

  return (
    <Screen scroll testID="pet-health">
      <Text variant="title">{pet?.name ? `${pet.name}'s health` : "Health"}</Text>
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
        grouped.map((group, groupIndex) => (
          <SettingsSection
            key={group.category}
            testID={`health-group-${group.category}`}
            title={CATEGORY_LABELS[group.category]}
            footer={groupIndex === grouped.length - 1 ? "Tap a record to remove it." : undefined}
          >
            {group.records.map((record) => {
              const index = records.indexOf(record);
              return (
                <SettingsRow
                  key={record._id}
                  testID={`health-record-${index}`}
                  label={nameOf(record)}
                  description={describeRecord(record)}
                  icon={ICONS[group.category]}
                  onPress={() => remove(record)}
                >
                  {record.intervalDays ? (
                    <Button
                      testID={`health-done-${index}`}
                      title={busyRecord === record._id ? "Logging…" : "Log today's dose"}
                      variant="soft"
                      disabled={busyRecord !== null}
                      onPress={() => logDose(record)}
                    />
                  ) : null}
                </SettingsRow>
              );
            })}
          </SettingsSection>
        ))
      )}

      <SettingsSection title="Add a record">
        <SettingsRow label="What">
          <View style={tailwind("flex-row flex-wrap")}>
            {kinds.map((entry) => (
              <KindChip
                key={entry}
                testID={`health-kind-${entry}`}
                label={KIND_LABELS[entry] ?? entry}
                selected={kind === entry}
                onPress={() => chooseKind(entry)}
              />
            ))}
          </View>
        </SettingsRow>

        {category === "medication" ? (
          <SettingsRow label="Name" description="Just the name. What it's for and how much stays with your vet.">
            <TextInput
              testID="health-label"
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Apoquel"
              placeholderTextColor={tokens.textFaint}
              style={tailwind("border border-border rounded-card p-md text-text")}
              maxLength={60}
            />
          </SettingsRow>
        ) : null}

        <SettingsRow
          label={repeating ? "Last given" : category === "visit" ? "Visited on" : "Given on"}
          description={category === "vaccine" ? "The date on the certificate." : undefined}
        >
          <View testID="health-given">
            <DateTimePickerComponent mode="date" date={administeredAt} onDateChange={setAdministeredAt} />
          </View>
        </SettingsRow>

        {repeating ? (
          <SettingsRow
            label="Days between doses"
            description="As your vet prescribed. We'll remind you a month before, or when it's due if sooner."
          >
            <TextInput
              testID="health-interval"
              value={intervalDays}
              onChangeText={(text) => setIntervalDays(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={tokens.textFaint}
              style={tailwind("border border-border rounded-card p-md text-text")}
              maxLength={3}
            />
          </SettingsRow>
        ) : (
          <SettingsRow
            testID="health-expiry-toggle"
            label={category === "visit" ? "I know when the next visit is" : "I know when the next dose is due"}
            description={
              category === "visit"
                ? "We'll remind you a month before."
                : "Your vet's certificate usually says. We'll remind you a month before."
            }
            value={hasExpiry}
            onValueChange={setHasExpiry}
          />
        )}

        {!repeating && hasExpiry ? (
          <SettingsRow label="Next due">
            <View testID="health-expiry">
              <DateTimePickerComponent mode="date" date={expiresAt} onDateChange={setExpiresAt} />
            </View>
          </SettingsRow>
        ) : null}

        {category === "vaccine" ? (
          <SettingsRow label="Certificate photo" description="Optional. Only you can see it.">
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
        ) : null}

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
          What your dog needs, and how often, is a question for your vet.
        </Text>
      </View>
    </Screen>
  );
};

const ICONS = {
  vaccine: "shield-checkmark-outline",
  prevention: "bug-outline",
  visit: "medkit-outline",
  medication: "flask-outline",
};

/** A medication is known by its name; everything else by its kind. */
const nameOf = (record) =>
  record.kind === "medication" && record.label
    ? record.label
    : KIND_LABELS[record.kind] ?? record.kind;

export default PetHealthScreen;
