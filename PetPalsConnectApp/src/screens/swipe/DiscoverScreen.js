import React, { useCallback, useEffect, useState } from "react";
import { Image, Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { hit } from "../../styles/tokens";
import {
  Button,
  CardSkeleton,
  EmptyState,
  Screen,
  Text,
  useToast,
} from "../../components/ui";
import SafetyMenu from "../../components/SafetyMenu";
import SwipeableCard from "./SwipeableCard";
import {
  decide,
  describeDistance,
  describeScore,
  fetchCandidates,
  topReasons,
} from "../../api/discovery";

/**
 * Browse pets and say yes or no. This is the app's core loop, and it did not
 * exist: the matching engine ranked pets and stored the results, but no screen
 * ever asked for them, there was no tab to reach one, and there was no way to
 * express interest. Everything downstream - chat, playdates - starts here.
 *
 * The card leads with *why* two pets matched rather than a bare percentage.
 * "Similar size, likes the same things" is something an owner can agree with;
 * "78%" is not.
 *
 * The card can be thrown left or right as well as decided with the buttons.
 * Both go through `submit`, which is the only thing that talks to the API: the
 * gesture is a faster way to reach the same decision, never a second one. The
 * buttons stay because a drag is unavailable to VoiceOver and switch control,
 * and WCAG 2.5.1 requires a single-pointer alternative to a path-based gesture
 * regardless.
 */

const petPhoto = (pet) =>
  (Array.isArray(pet?.photos) ? pet.photos[0] : null) ?? null;

/** You block a person, not a dog. `owner` may be an id or a populated user. */
const ownerId = (pet) => {
  const owner = pet?.owner;
  return owner == null ? null : String(owner?._id ?? owner);
};

const Stat = ({ tailwind, label, value }) =>
  value == null || value === "" ? null : (
    <View style={tailwind("mr-xl")}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text weight="600">{value}</Text>
    </View>
  );

const DiscoverScreen = ({ navigation, previewTranslateX = 0 }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const [myPet, setMyPet] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [threshold, setThreshold] = useState(0);
  const [preview, setPreview] = useState(false);
  const [range, setRange] = useState(null);
  const [locationKnown, setLocationKnown] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [match, setMatch] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchCandidates();
      setMyPet(result.pet);
      setCandidates(result.candidates);
      setThreshold(result.threshold);
      setPreview(result.preview);
      setRange(result.range);
      setLocationKnown(result.locationKnown);
      setIndex(0);
    } catch (error) {
      console.warn("[discover]", error.message);
      toast.error("Could not load matches. Pull to try again.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const current = candidates[index];

  const submit = async (decision) => {
    if (!current || !myPet || deciding) return;

    setDeciding(true);
    // Advance immediately: waiting on the network before showing the next card
    // makes the whole screen feel broken on a slow connection.
    setIndex((position) => position + 1);

    try {
      const result = await decide({
        fromPetId: myPet._id,
        toPetId: current.pet._id,
        decision,
      });
      if (result?.mutual) setMatch(result.matchedPet);
    } catch (error) {
      console.warn("[discover] decide failed:", error.message);
      // A modal here stops the deck dead for a transient network blip on the
      // app's core loop. The card comes back; that is the feedback that matters.
      toast.error("That didn't save. Please try again.");
      setIndex((position) => Math.max(0, position - 1));
    } finally {
      setDeciding(false);
    }
  };

  /**
   * Takes every pet belonging to one owner out of the deck.
   *
   * Not just the card in front of you: somebody with three dogs would otherwise
   * come back twice more after being blocked, which reads as the block having
   * failed. The server excludes them from the next load either way; this is so
   * the current deck agrees with what just happened.
   */
  const dropCurrent = useCallback(
    (blockedOwnerId) => {
      const theirs = (candidate) => ownerId(candidate.pet) === blockedOwnerId;

      // The index points into the list being rewritten. Removing a card the
      // cursor has already passed shifts everything down, so without this the
      // deck skips a pet nobody ever saw.
      const removedBefore = candidates.slice(0, index).filter(theirs).length;

      setCandidates(candidates.filter((candidate) => !theirs(candidate)));
      setIndex(Math.max(0, index - removedBefore));
    },
    [candidates, index]
  );

  // Rendered next to *every* branch, not inside the card: deciding on the last
  // candidate flips the screen to its empty state, and a match modal declared
  // after that early return would never appear - which is exactly when a match
  // is most likely, since it is the card you just acted on.
  const matchModal = (
    <Modal visible={Boolean(match)} transparent animationType="fade">
      <View
        style={[
          tailwind("flex-1 items-center justify-center p-xxl"),
          { backgroundColor: tokens.scrim },
        ]}
      >
        <View
          testID="discover-match"
          style={tailwind("bg-surface rounded-card p-xxl items-center w-full")}
        >
          <Ionicons name="heart" size={48} color={tokens.primary} />
          <Text variant="display" align="center" style={tailwind("mt-md")}>
            It&apos;s a match!
          </Text>
          <Text tone="muted" align="center" style={tailwind("mt-sm")}>
            {myPet?.name} and {match?.name} both said yes.
          </Text>

          <Button
            testID="discover-say-hello"
            title="Say hello"
            onPress={() => {
              const matched = match;
              setMatch(null);
              navigation.navigate("Chat", { pet: matched });
            }}
            style={tailwind("mt-xl")}
          />

          <Button
            testID="discover-keep-browsing"
            title="Keep browsing"
            variant="ghost"
            onPress={() => setMatch(null)}
            style={tailwind("mt-sm")}
          />
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    // A skeleton rather than a spinner: this card's structure is completely
    // known before the response arrives, and this is the screen a new user
    // waits on first.
    return (
      <Screen testID="discover-loading">
        <View style={tailwind("mb-sm")}>
          <Text variant="caption" tone="muted">
            Finding matches…
          </Text>
        </View>
        <CardSkeleton />
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen testID="discover-empty" padded={false}>
        <EmptyState
          testID="discover-empty-state"
          title="That's everyone for now"
          message={
            range == null
              ? "New pets join all the time. Check back soon."
              : `Nobody new within ${range} miles. Widen your range in Settings, or check back soon.`
          }
          actionLabel="Refresh"
          onAction={load}
        />
        {!locationKnown ? (
          <Text
            testID="discover-location-hint"
            variant="caption"
            tone="faint"
            align="center"
            style={tailwind("px-xl pb-xl")}
          >
            Sharing your location lets us show pets you could actually meet.
          </Text>
        ) : null}
        {matchModal}
      </Screen>
    );
  }

  const reasons = topReasons(current.breakdown);

  return (
    <Screen testID="discover-card">
      <Text variant="caption" tone="muted" style={tailwind("mb-sm")}>
        {preview ? "Pets near you" : `Matches for ${myPet?.name}`}
      </Text>

      <SwipeableCard
        testID="discover-swipe"
        // Preview mode browses rather than decides - there is no pet to decide
        // *with* - so there is nothing for a throw to commit.
        enabled={!preview && !deciding}
        onDecide={submit}
        // Only the gallery passes this: a headless browser cannot pan, and the
        // lean and the stamps are the part of this screen a screenshot is most
        // needed for.
        previewTranslateX={previewTranslateX}
      >
      <View
        style={tailwind(
          "flex-1 bg-surface rounded-card border border-border overflow-hidden",
        )}
      >
        {petPhoto(current.pet) ? (
          <Image
            source={{ uri: petPhoto(current.pet) }}
            style={tailwind("w-full h-64")}
          />
        ) : (
          <View
            style={tailwind(
              "w-full h-64 bg-surfaceAlt items-center justify-center",
            )}
          >
            <Ionicons name="paw-outline" size={48} color={tokens.textFaint} />
          </View>
        )}

        <View style={tailwind("p-lg flex-1")}>
          <View style={tailwind("flex-row items-center justify-between")}>
            <Text variant="display" style={tailwind("flex-1")} numberOfLines={1}>
              {current.pet.name}
            </Text>
            <View style={tailwind("flex-row items-center")}>
              {preview ? null : (
                <View style={tailwind("bg-primarySoft rounded-pill px-md py-xs")}>
                  <Text testID="discover-score" variant="caption" tone="primary" weight="600">
                    {describeScore(current.score, threshold)}
                  </Text>
                </View>
              )}
              {/* This is where strangers meet, so this is where reporting one
                  has to be. It used to live only on a card component nothing
                  rendered. */}
              <SafetyMenu
                testID="discover-safety"
                userId={ownerId(current.pet)}
                name={`${current.pet.name}'s owner`}
                navigation={navigation}
                onBlocked={dropCurrent}
              />
            </View>
          </View>

          {describeDistance(current.distanceMiles) ? (
            <Text
              testID="discover-distance"
              variant="caption"
              tone="muted"
              style={tailwind("mt-xs")}
            >
              {describeDistance(current.distanceMiles)}
            </Text>
          ) : null}

          <View style={tailwind("flex-row mt-lg")}>
            <Stat tailwind={tailwind} label="Breed" value={current.pet.breed} />
            <Stat
              tailwind={tailwind}
              label="Age"
              value={current.pet.age != null ? `${current.pet.age}` : null}
            />
            <Stat
              tailwind={tailwind}
              label="Weight"
              value={
                current.pet.weight != null ? `${current.pet.weight} lb` : null
              }
            />
          </View>

          {preview ? (
            <Text variant="caption" tone="faint" style={tailwind("mt-lg")}>
              Add a pet and we&apos;ll show you how well they fit.
            </Text>
          ) : reasons.length > 0 ? (
            <View style={tailwind("mt-lg")}>
              {reasons.map((reason) => (
                <View
                  key={reason}
                  style={tailwind("flex-row items-center mb-xs")}
                >
                  <Ionicons name="checkmark-circle" size={16} color={tokens.success} />
                  <Text style={tailwind("ml-sm flex-1")}>{reason}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            testID="discover-details"
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate("PetDetails", { petId: current.pet._id })
            }
            style={[tailwind("mt-auto justify-center"), { minHeight: hit.min }]}
          >
            <Text tone="primary" weight="600">
              See full profile
            </Text>
          </Pressable>
        </View>
      </View>
      </SwipeableCard>

      {/*
        Without a pet there is nothing to match *with*, so the deck browses
        rather than decides. Asking here - next to a specific dog somebody is
        already looking at - is a better moment than the wall this screen used
        to put up before showing anything at all.
      */}
      {preview ? (
        <View testID="discover-preview" style={tailwind("py-lg")}>
          <Text variant="caption" tone="muted" align="center" style={tailwind("mb-md")}>
            Add your pet to say hello to {current.pet.name}.
          </Text>
          <Button
            testID="discover-add-pet"
            title="Add my pet"
            onPress={() => navigation.navigate("AddPet")}
          />
          <Button
            testID="discover-preview-next"
            title="Keep looking"
            variant="ghost"
            onPress={() => setIndex((position) => position + 1)}
          />
        </View>
      ) : (
      /* Icon-only, so each needs a label of its own: without one a screen
         reader announces the two most important controls in the app as
         nothing at all. */
      <View style={tailwind("flex-row justify-center items-center py-xl")}>
        <Pressable
          testID="discover-pass"
          accessibilityRole="button"
          accessibilityLabel={`Pass on ${current.pet.name}`}
          accessibilityState={{ disabled: deciding }}
          disabled={deciding}
          onPress={() => submit("pass")}
          style={({ pressed }) => [
            tailwind(
              "h-16 w-16 rounded-pill border border-borderStrong items-center justify-center mr-xxl",
            ),
            { opacity: deciding ? 0.5 : pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="close" size={28} color={tokens.textMuted} />
        </Pressable>

        <Pressable
          testID="discover-like"
          accessibilityRole="button"
          accessibilityLabel={`Like ${current.pet.name}`}
          accessibilityState={{ disabled: deciding }}
          disabled={deciding}
          onPress={() => submit("like")}
          style={({ pressed }) => [
            tailwind("h-16 w-16 rounded-pill bg-primary items-center justify-center"),
            { opacity: deciding ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="heart" size={28} color={tokens.onPrimary} />
        </Pressable>
      </View>
      )}

      {matchModal}
    </Screen>
  );
};

export default DiscoverScreen;
