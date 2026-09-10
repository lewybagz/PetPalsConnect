import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, Linking, RefreshControl } from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import {
  copilot,
  walkthroughable,
  CopilotStep,
  TOURS,
} from "../../components/walkthrough";
import CustomTooltip from "../../components/CustomTooltip";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { Button, Card, Screen, Skeleton, Text, useToast } from "../../components/ui";
import {
  fetchCarePicks,
  fetchCarePlaces,
  savePlace,
  unsavePlace,
} from "../../api/petCare";
import { importPlaces } from "../../api/maps";

/**
 * The pet owner's hub.
 *
 * This screen was five unstyled buttons in a centred column - Group Chat
 * Creation, Favorites, Notifications, Profile, Add Pet - each a `TouchableOpacity`
 * with a hard-coded padding, and nothing else. It was the app's only home for
 * everything that is not swiping, chatting or playdates, and it did not tell
 * anybody anything.
 *
 * It is the hub now: the things an owner needs *for the pets they have*, as
 * opposed to the social half of the app. Four sections, in the order somebody
 * needs them:
 *
 *  1. Emergency numbers, first and always present. They need no location, no
 *     Google key and no rows in the database, and they are the one thing here
 *     somebody might open the app in a panic to find.
 *  2. What to get for each pet, from `services/petCare/` on the server.
 *  3. Vets, shops, groomers and boarders nearby.
 *  4. The links this screen already had, kept where people expect them.
 *
 * Every section degrades on its own. No pets, no shared position, no imported
 * places and no Google key are all ordinary states here, not errors, and each
 * says what it is rather than rendering blank.
 */

const WalkthroughableView = walkthroughable(View);

/** The links this screen carried before it was a hub. */
const SHORTCUTS = [
  { label: "Profile", route: "Profile", icon: "person-outline", step: "profile", order: 5 },
  { label: "Add a pet", route: "AddPet", icon: "add-circle-outline", step: "addPet", order: 4 },
  { label: "Favourites", route: "Favorites", icon: "heart-outline", step: "favorites", order: 2 },
  {
    label: "Notifications",
    route: "Notifications",
    icon: "notifications-outline",
    step: "notifications",
    order: 3,
  },
  {
    label: "New group chat",
    // Straight to GroupChatCreation with no params meant `selectedPets` was
    // empty and the screen refused with "choose at least one pet" while
    // offering no way to choose one. PetSelection is that missing step, and it
    // navigates onward with the pets it collected.
    route: "PetSelection",
    icon: "people-outline",
    step: "groupChatCreation",
    order: 1,
  },
  { label: "Settings", route: "Settings", icon: "settings-outline", step: null },
];

/** Human names for the place categories the server speaks in. */
const PLACE_LABELS = {
  vet: "Vets",
  petStore: "Pet shops",
  groomer: "Groomers",
  boarding: "Boarding",
};

/** Human names for the pick shelves. */
const SHELF_LABELS = {
  food: "Food",
  supplies: "Supplies",
  enrichment: "Toys and enrichment",
  grooming: "Grooming",
  health: "Health",
};

const SPECIES_LABELS = {
  dog: "dog",
  cat: "cat",
  smallMammal: "small pet",
  bird: "bird",
  reptile: "reptile",
  fish: "fish",
};

/**
 * "For your adult, medium dog" - the sentence that makes a list a
 * recommendation rather than a shelf of adverts.
 *
 * Assembled from whatever is actually known rather than from a template with
 * gaps: a pet with no age and no weight gets "For your cat", not "For your
 * null, null cat".
 *
 * "Your" rather than "a", which avoids having to pick between "a" and "an" -
 * the first version of this read "For a adult, medium dog" - and is the truer
 * sentence anyway, since these are picked from this owner's pet.
 */
const describePet = (pet) => {
  const traits = [pet.stage, pet.size].filter(Boolean).join(", ");
  const species = SPECIES_LABELS[pet.species] ?? "pet";
  return traits ? `For your ${traits} ${species}` : `For your ${species}`;
};

const openExternal = (url) => {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    // A device with no browser or no dialler is not something this screen can
    // fix, and an error dialog about it helps nobody.
  });
};

const HubSkeleton = () => {
  const tailwind = useTailwind();

  return (
    <View testID="hub-loading">
      {[0, 1].map((index) => (
        <View key={index} style={tailwind("mb-lg")}>
          <Skeleton width={140} height={16} />
          <View style={tailwind("mt-sm")}>
            <Skeleton width="100%" height={72} rounded="card" />
          </View>
        </View>
      ))}
    </View>
  );
};

const SectionHeading = ({ children }) => {
  const tailwind = useTailwind();
  return (
    <Text variant="title" style={tailwind("mb-sm mt-xl")}>
      {children}
    </Text>
  );
};

const MoreScreen = ({ route, start, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const [picks, setPicks] = useState(null);
  const [places, setPlaces] = useState(null);
  const [placeCategory, setPlaceCategory] = useState(null);
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Whether this session has already tried to pull places in for this area.
   *
   * An import is a handful of billed Google requests, so it fires at most once
   * per mount and never again after a failure - a server that is rate-limited
   * or misconfigured must not be asked repeatedly by a screen the user is
   * pulling to refresh. A ref rather than state because changing it must not
   * re-render, and because the effect that reads it also sets it.
   */
  const importAttempted = useRef(false);

  useEffect(() => {
    if (route.params?.showTutorial) start();
  }, [route.params?.showTutorial, start]);

  /**
   * Re-reads when the tab comes back into view, but not on the first one.
   *
   * The hub is a tab, so it stays mounted: adding a pet from the "Add a pet"
   * button and coming back showed the same "Add a pet to see this" card,
   * because nothing had asked again. `useFocusEffect` fires on the initial
   * focus too, which would make every launch fetch twice, so the first one is
   * skipped and the effect only bumps the token on a genuine return.
   */
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setReloadToken((token) => token + 1);
    }, [])
  );

  /**
   * Reads the position we already have permission for, and never asks.
   *
   * `getForegroundPermissionsAsync` reads the current answer rather than
   * prompting, which is the same rule `useLocationSync` follows: the prompt
   * belongs where somebody asked for something location-shaped, not on a tab
   * they happened to open. Without it the hub still lists places, just
   * unsorted and without distances.
   */
  const currentPosition = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) return null;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    /**
     * The two halves are fetched independently and a failure costs one
     * section, not the screen. The emergency numbers ride on both responses,
     * so they survive either one failing.
     */
    const load = async () => {
      const position = await currentPosition();

      const [pickData, placeData] = await Promise.all([
        fetchCarePicks().catch(() => null),
        fetchCarePlaces({
          ...(position ?? {}),
          category: placeCategory,
        }).catch(() => null),
      ]);

      if (cancelled) return;
      setPicks(pickData);
      setPlaces(placeData);
      setLoading(false);
      setRefreshing(false);

      /**
       * Fill an empty area in, rather than telling somebody to go and do it.
       *
       * Sending a user to a different tab to fix an empty list on this one is
       * a dead end, so the hub pulls its own places in. Every condition here
       * is load-bearing:
       *
       * - Nothing came back, so there is genuinely nothing to fill.
       * - We know where they are; importing around a position we do not have
       *   would spend requests on the wrong city.
       * - The server says Places is configured, so this is not a request that
       *   is going to come back 503.
       * - We have not tried yet this session. An import is billed Google
       *   traffic, and a screen that retries on every pull-to-refresh turns a
       *   quota problem into a bill.
       */
      const nothingHere = (placeData?.places?.length ?? 0) === 0;
      if (
        nothingHere &&
        position &&
        placeData?.importable &&
        !importAttempted.current
      ) {
        importAttempted.current = true;
        setImporting(true);
        try {
          const result = await importPlaces({ ...position });
          if (cancelled) return;
          // Only worth a re-read if it actually found something; otherwise the
          // empty state below already says the right thing.
          if (result.imported > 0) {
            const filled = await fetchCarePlaces({
              ...position,
              category: placeCategory,
            }).catch(() => null);
            if (!cancelled && filled) setPlaces(filled);
          }
        } catch {
          // Left to the empty state, which says what it can. A failed import
          // is not something to interrupt somebody with.
        } finally {
          if (!cancelled) setImporting(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, placeCategory, currentPosition]);

  // Memoised rather than defaulted inline: a fresh `[]` on every render would
  // re-run the memo below every time.
  const pets = useMemo(() => picks?.pets ?? [], [picks]);

  // Defaults to the first pet and follows the owner's choice after that. Held
  // as an id rather than an index so a refresh that reorders cannot silently
  // switch which pet is on screen.
  const selectedPet = useMemo(
    () => pets.find((pet) => String(pet.petId) === String(selectedPetId)) ?? pets[0] ?? null,
    [pets, selectedPetId]
  );

  const savedPlaces = useMemo(() => places?.saved ?? [], [places]);
  const savedIds = useMemo(
    () => new Set(savedPlaces.map((place) => String(place._id))),
    [savedPlaces]
  );

  /**
   * Saves or unsaves a place, optimistically.
   *
   * The list moves under the thumb the moment it is tapped and rolls back with
   * a toast if the write fails - the same shape the deck uses for a swipe, and
   * for the same reason: waiting on a round trip to redraw a star makes a
   * working app feel broken.
   */
  const toggleSaved = useCallback(
    async (place) => {
      const wasSaved = savedIds.has(String(place._id));
      const optimistic = wasSaved
        ? savedPlaces.filter((saved) => String(saved._id) !== String(place._id))
        : [place, ...savedPlaces];

      setPlaces((current) => ({ ...current, saved: optimistic }));

      try {
        if (wasSaved) await unsavePlace(place._id);
        else await savePlace(place._id);
      } catch {
        setPlaces((current) => ({ ...current, saved: savedPlaces }));
        toast.error(wasSaved ? "Couldn't remove that." : "Couldn't save that.");
      }
    },
    [savedIds, savedPlaces, toast]
  );

  const emergency = picks?.emergency ?? places?.emergency ?? [];
  const placeCategories = picks?.placeCategories ?? ["vet", "petStore", "groomer", "boarding"];

  return (
    <Screen
      testID="care-hub"
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={tokens.textMuted}
          onRefresh={() => {
            setRefreshing(true);
            setReloadToken((token) => token + 1);
          }}
        />
      }
    >
      <Text variant="display" style={tailwind("mb-xs")}>
        Pet care
      </Text>
      <Text tone="muted" style={tailwind("mb-md")}>
        Everything for the pets you have.
      </Text>

      {/* ---- Emergency ---------------------------------------------------
          First, and never behind a loading state: these come from a table in
          the source, so there is nothing to wait for and nothing that can be
          missing. */}
      <Card testID="hub-emergency" style={tailwind("border-danger")}>
        <View style={tailwind("flex-row items-center mb-sm")}>
          <Ionicons name="medkit-outline" size={20} color={tokens.danger} />
          <Text variant="title" style={tailwind("ml-sm")}>
            Emergency
          </Text>
        </View>
        {emergency.length === 0 ? (
          <Text tone="muted">Contact your vet, or the nearest emergency clinic.</Text>
        ) : (
          emergency.map((contact) => (
            <Pressable
              key={contact.id}
              testID={`emergency-${contact.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Call ${contact.name} on ${contact.phone}`}
              onPress={() => openExternal(`tel:${contact.phone.replace(/[^0-9+]/g, "")}`)}
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

      {loading ? (
        <View style={tailwind("mt-xl")}>
          <HubSkeleton />
        </View>
      ) : (
        <>
          {/* ---- Picks --------------------------------------------------- */}
          <SectionHeading>For your pets</SectionHeading>

          {pets.length === 0 ? (
            /*
              Two different nothings, told apart by whether the request came
              back at all - not by `hasPet` from the session, which is what
              this did first and which was wrong in the case that matters. A
              petless owner and a failed fetch both leave `pets` empty, and
              answering a petless owner with "we could not read your pets"
              turns an invitation into an apology for a bug that did not
              happen.
            */
            <Card testID="hub-no-pets">
              <Text weight="600" style={tailwind("mb-xs")}>
                {picks === null ? "Nothing to show yet" : "Add a pet to see this"}
              </Text>
              <Text tone="muted" style={tailwind("mb-md")}>
                {picks === null
                  ? "We could not read your pets just now. Pull down to try again."
                  : "Food, supplies and toys are picked from your pet's species, age and size."}
              </Text>
              {picks === null ? null : (
                <Button
                  testID="hub-add-pet"
                  title="Add a pet"
                  onPress={() => navigation.navigate("AddPet")}
                />
              )}
            </Card>
          ) : (
            <>
              {/* Only shown when there is a choice to make. */}
              {pets.length > 1 ? (
                <View style={tailwind("flex-row flex-wrap mb-md")}>
                  {pets.map((pet) => {
                    const active = String(pet.petId) === String(selectedPet?.petId);
                    return (
                      <Pressable
                        key={String(pet.petId)}
                        testID={`hub-pet-${pet.petId}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setSelectedPetId(pet.petId)}
                        style={tailwind(
                          `border rounded-lg px-md py-sm mr-sm mb-sm ${
                            active ? "bg-primary border-primary" : "bg-surface border-border"
                          }`
                        )}
                      >
                        <Text
                          variant="caption"
                          weight="600"
                          tone={active ? "onPrimary" : "muted"}
                        >
                          {pet.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {selectedPet ? (
                <View testID="hub-picks">
                  <Text variant="caption" tone="muted" style={tailwind("mb-sm")}>
                    {describePet(selectedPet)}
                  </Text>

                  {/*
                    An owner who wrote anything in `specialNeeds` gets their
                    vets, not a product. Deciding what to feed a pet with a
                    condition is a conversation with a vet, and the server
                    never lets those notes reach a recommendation.
                  */}
                  {selectedPet.seeAVet ? (
                    <Card testID="hub-see-a-vet" style={tailwind("mb-md border-warning")}>
                      <Text weight="600" style={tailwind("mb-xs")}>
                        Check with your vet
                      </Text>
                      <Text tone="muted" style={tailwind("mb-md")}>
                        You noted something about {selectedPet.name}&apos;s care. We
                        will not guess at that here - your vet can.
                      </Text>
                      <Button
                        testID="hub-see-a-vet-action"
                        title="Find a vet nearby"
                        variant="secondary"
                        onPress={() => setPlaceCategory("vet")}
                      />
                    </Card>
                  ) : null}

                  {selectedPet.shelves.length === 0 ? (
                    <Card>
                      <Text tone="muted">
                        Nothing picked for {selectedPet.name} yet. Adding an age and
                        a weight sharpens this.
                      </Text>
                    </Card>
                  ) : (
                    selectedPet.shelves.map((shelf) => (
                      <View key={shelf.category} style={tailwind("mb-md")}>
                        <Text variant="caption" tone="faint" style={tailwind("mb-xs")}>
                          {(SHELF_LABELS[shelf.category] ?? shelf.category).toUpperCase()}
                        </Text>
                        {shelf.picks.map((pick) => (
                          <Card
                            key={pick.id}
                            testID={`pick-${pick.id}`}
                            style={tailwind("mb-sm")}
                            onPress={() => openExternal(pick.url)}
                            accessibilityLabel={`${pick.title}. ${pick.why}`}
                          >
                            <View style={tailwind("flex-row items-center justify-between")}>
                              <Text weight="600" style={tailwind("flex-1 mr-sm")}>
                                {pick.title}
                              </Text>
                              <Ionicons
                                name="open-outline"
                                size={16}
                                color={tokens.textMuted}
                              />
                            </View>
                            <Text variant="caption" tone="muted" style={tailwind("mt-xs")}>
                              {pick.why}
                            </Text>
                          </Card>
                        ))}
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </>
          )}

          {/* ---- Places -------------------------------------------------- */}
          <SectionHeading>Care near you</SectionHeading>

          <View style={tailwind("flex-row flex-wrap mb-md")}>
            {[null, ...placeCategories].map((category) => {
              const active = category === placeCategory;
              return (
                <Pressable
                  key={category ?? "all"}
                  testID={`hub-category-${category ?? "all"}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setPlaceCategory(category)}
                  style={tailwind(
                    `border rounded-lg px-md py-sm mr-sm mb-sm ${
                      active ? "bg-primary border-primary" : "bg-surface border-border"
                    }`
                  )}
                >
                  <Text variant="caption" weight="600" tone={active ? "onPrimary" : "muted"}>
                    {category ? PLACE_LABELS[category] ?? category : "All"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/*
            Saved places sit above the search, unfiltered by the chips and by
            the range. Somebody's own vet is the one entry they opened this
            screen to find, and making them hunt for it among the twenty
            nearest is the opposite of what a saved list is for.
          */}
          {savedPlaces.length > 0 ? (
            <View testID="hub-saved">
              <Text variant="caption" tone="faint" style={tailwind("mb-xs")}>
                SAVED
              </Text>
              {savedPlaces.map((place) => (
                <PlaceCard
                  key={place._id}
                  place={place}
                  saved
                  onToggleSave={() => toggleSaved(place)}
                  onOpen={() =>
                    navigation.navigate("PotentialPlaydateLocation", {
                      locationId: place._id,
                    })
                  }
                />
              ))}
            </View>
          ) : null}

          {/*
            Only when there is a saved list above to distinguish it from -
            otherwise the results are the only thing here and a label on them
            is noise.
          */}
          {savedPlaces.length > 0 && places?.places?.length ? (
            <Text variant="caption" tone="faint" style={tailwind("mb-xs mt-sm")}>
              NEARBY
            </Text>
          ) : null}

          {places?.places?.length ? (
            places.places.map((place) => (
              <PlaceCard
                key={place._id}
                place={place}
                saved={savedIds.has(String(place._id))}
                onToggleSave={() => toggleSaved(place)}
                onOpen={() =>
                  navigation.navigate("PotentialPlaydateLocation", {
                    locationId: place._id,
                  })
                }
              />
            ))
          ) : (
            <Card testID="hub-no-places">
              {/*
                Four different nothings, and they are not the same thing. A
                list that says "no vets near you" when it has simply never
                been given a position is a lie the user cannot correct - and
                one that says it while an import is still running is a lie
                that is about to correct itself.
              */}
              <Text tone="muted">
                {importing
                  ? "Looking for places near you…"
                  : places?.locationKnown === false
                    ? "Share your location on the map to see places near you."
                    : places?.importable
                      ? "Nothing found for your area yet."
                      : "No places have been added for your area yet."}
              </Text>
            </Card>
          )}

          {/* ---- The links this screen already had ----------------------- */}
          <SectionHeading>More</SectionHeading>

          {SHORTCUTS.map((shortcut) =>
            shortcut.step ? (
              <CopilotStep
                key={shortcut.route}
                text={`${shortcut.label}, from here.`}
                order={shortcut.order}
                name={shortcut.step}
              >
                <WalkthroughableView>
                  <ShortcutRow shortcut={shortcut} navigation={navigation} />
                </WalkthroughableView>
              </CopilotStep>
            ) : (
              <ShortcutRow
                key={shortcut.route}
                shortcut={shortcut}
                navigation={navigation}
              />
            )
          )}
        </>
      )}
    </Screen>
  );
};

/**
 * One place, with a save toggle that is its own tap target.
 *
 * The star is a `Pressable` beside the card's own press rather than inside it:
 * nesting one press handler in another makes which one fires depend on where
 * exactly the thumb landed, and "I tried to save it and it opened instead" is
 * the kind of bug nobody reports and everybody notices.
 */
const PlaceCard = ({ place, saved, onToggleSave, onOpen }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  return (
    <Card testID={`place-${place._id}`} style={tailwind("mb-sm")}>
      <View style={tailwind("flex-row items-start")}>
        <Pressable
          testID={`place-open-${place._id}`}
          accessibilityRole="button"
          accessibilityLabel={`Open ${place.name}`}
          onPress={onOpen}
          style={tailwind("flex-1 mr-sm")}
        >
          <Text weight="600">{place.name}</Text>
          <Text variant="caption" tone="muted">
            {place.address}
          </Text>
          {place.distanceMiles != null ? (
            <Text variant="caption" tone="faint" style={tailwind("mt-xs")}>
              {place.distanceMiles} miles away
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          testID={`place-save-${place._id}`}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={
            saved ? `Remove ${place.name} from saved` : `Save ${place.name}`
          }
          onPress={onToggleSave}
          // The 44pt floor: a star is a small glyph and a small glyph is not a
          // tap target.
          style={tailwind("items-center justify-center")}
          hitSlop={12}
        >
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={22}
            color={saved ? tokens.primary : tokens.textMuted}
          />
        </Pressable>
      </View>
    </Card>
  );
};

/**
 * One row in the More list.
 *
 * A single `Pressable` carrying the padding, the label and the handler. The
 * old buttons put padding on the outer view and the press handler on it too,
 * which was right - but they were 15pt tall boxes with no minimum, so the tap
 * target was whatever the text happened to be.
 */
const ShortcutRow = ({ shortcut, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  return (
    <Pressable
      testID={`shortcut-${shortcut.route}`}
      accessibilityRole="button"
      accessibilityLabel={shortcut.label}
      onPress={() => navigation.navigate(shortcut.route)}
      style={tailwind(
        "flex-row items-center justify-between bg-surface border border-border rounded-card px-lg py-md mb-sm"
      )}
    >
      <View style={tailwind("flex-row items-center")}>
        <Ionicons name={shortcut.icon} size={20} color={tokens.primary} />
        <Text style={tailwind("ml-md")}>{shortcut.label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tokens.textMuted} />
    </Pressable>
  );
};

export default copilot({
  tooltipComponent: CustomTooltip,
  name: TOURS.more,
})(MoreScreen);
