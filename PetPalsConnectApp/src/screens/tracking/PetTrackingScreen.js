import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { useTailwind } from "../../styles/tailwind";
import AskSpotButton from "../../components/spot/AskSpotButton";
import { useAppTheme, useTokens } from "../../context/AppThemeContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import { darkMapStyle } from "../../styles/mapStyle";
import { hit, radius, space } from "../../styles/tokens";
import {
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  Screen,
  SegmentedControl,
  Text,
  useToast,
} from "../../components/ui";
import {
  SHARE_DURATIONS,
  claimDevice,
  describeLastSeen,
  describeUntil,
  fetchPetPositions,
  fetchShares,
  fetchTrackingStatus,
  isStale,
  removeDevice,
  sharePet,
  unsharePet,
} from "../../api/tracking";
import { fetchFriends, otherSide } from "../../api/friends";

/**
 * Where a pet's collar is, and who else may see that.
 *
 * One screen, two people. The owner sees the position, the trail, the
 * battery, the friends it is shared with and the collar itself; a friend
 * with a live share sees the position and who shared it. The server decides
 * which - a friend's request for a pet they may not see is a 404, and this
 * screen renders that as the same quiet "not available" it would for a pet
 * with no collar.
 *
 * Every position says how old it is, on every view. A collar that stopped
 * reporting yesterday looks exactly like one reporting now unless the screen
 * says so, and that is the one mistake here that could get a dog lost twice.
 * No position at all is an empty state, never a marker at 0,0.
 *
 * Positions refresh while the screen is focused and stop when it is not:
 * nothing here runs in the background, and the phone never reports the
 * pet's position - the collar does.
 */

/** How often to ask again while the screen is open. */
const REFRESH_MS = 15 * 1000;

/** Zoomed to a few streets, which is what "where is the dog" means. */
const SPAN = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

const provider = Platform.select({ android: PROVIDER_GOOGLE, default: PROVIDER_DEFAULT });

const idOf = (value) => String(value?._id ?? value ?? "");

const batteryIcon = (percent) => {
  if (percent == null) return "battery-dead-outline";
  if (percent > 66) return "battery-full-outline";
  if (percent > 33) return "battery-half-outline";
  return "battery-dead-outline";
};

const PetTrackingScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { isDark } = useAppTheme();
  const { profile, userId } = useAuthSession();

  const myPets = useMemo(() => (Array.isArray(profile?.pets) ? profile.pets : []), [profile]);
  const routePetId = route?.params?.petId ?? route?.params?.pet?._id ?? null;

  const [petId, setPetId] = useState(routePetId ? String(routePetId) : null);
  const [status, setStatus] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState([]);
  const [friends, setFriends] = useState([]);
  const [hours, setHours] = useState(24);
  const [busyId, setBusyId] = useState(null);
  const [serial, setSerial] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [secret, setSecret] = useState(null);

  const isOwner = useMemo(
    () => Boolean(petId) && myPets.some((pet) => idOf(pet) === String(petId)),
    [myPets, petId]
  );
  const petFromProfile = useMemo(
    () => myPets.find((pet) => idOf(pet) === String(petId)) ?? route?.params?.pet ?? null,
    [myPets, petId, route?.params?.pet]
  );

  const load = useCallback(async () => {
    try {
      const enabled = await fetchTrackingStatus();
      setStatus(enabled);
      if (!enabled.enabled || !petId) {
        setData(null);
        return;
      }
      const positions = await fetchPetPositions(petId);
      setData(positions);
    } catch (error) {
      console.warn("[tracking]", error.message);
      toast.error("Could not load the collar.");
    } finally {
      setLoading(false);
    }
  }, [petId, toast]);

  const loadSharing = useCallback(async () => {
    if (!isOwner) return;
    try {
      const [mine, friendships] = await Promise.all([fetchShares(), fetchFriends()]);
      setShares(mine.given.filter((row) => idOf(row.pet) === String(petId)));
      setFriends(
        friendships
          .map((friendship) => otherSide(friendship, userId))
          .filter((user) => user && typeof user === "object")
      );
    } catch (error) {
      console.warn("[tracking] sharing:", error.message);
    }
  }, [isOwner, petId, userId]);

  useEffect(() => {
    load();
    loadSharing();
  }, [load, loadSharing]);

  // Refresh while looking, and only while looking.
  useFocusEffect(
    useCallback(() => {
      if (!data?.device) return undefined;
      const timer = setInterval(load, REFRESH_MS);
      return () => clearInterval(timer);
    }, [data?.device, load])
  );

  const claim = async () => {
    if (!petId || claiming) return;
    setClaiming(true);
    try {
      const result = await claimDevice(serial, petId);
      setSecret(result.secret);
      setSerial("");
      toast.success("Collar registered.");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Could not register that collar.");
    } finally {
      setClaiming(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    await Clipboard.setStringAsync(secret);
    toast.success("Copied.");
  };

  const remove = () => {
    if (!data?.device) return;
    Alert.alert(
      "Remove this collar?",
      "Its position history goes with it. You can register it again later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeDevice(data.device._id);
              setData(null);
              setSecret(null);
            } catch (error) {
              toast.error(error.response?.data?.message ?? "Could not remove the collar.");
            }
          },
        },
      ]
    );
  };

  const toggleShare = async (friend) => {
    const friendId = idOf(friend);
    const existing = shares.find((row) => idOf(row.viewer) === friendId);
    setBusyId(friendId);
    try {
      if (existing) {
        await unsharePet(petId, friendId);
        setShares((current) => current.filter((row) => idOf(row.viewer) !== friendId));
      } else {
        const row = await sharePet(petId, friendId, hours);
        setShares((current) => [...current.filter((r) => idOf(r.viewer) !== friendId), { ...row, viewer: friend }]);
      }
    } catch (error) {
      toast.error(error.response?.data?.message ?? "Could not change sharing.");
    } finally {
      setBusyId(null);
    }
  };

  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <Screen testID="tracking-loading" scroll>
        <CardSkeleton />
      </Screen>
    );
  }

  if (status && !status.enabled) {
    return (
      <Screen testID="tracking-disabled">
        <EmptyState
          icon="radio-outline"
          title="Tracking isn't available yet"
          message="Collars can't report to this server right now. Everything else about your pet still works."
        />
      </Screen>
    );
  }

  // No pet chosen (arriving from an order): pick one of your own.
  if (!petId) {
    return (
      <Screen testID="tracking-choose-pet" scroll>
        <Text variant="display" style={tailwind("mb-xs")}>
          Set up your collar
        </Text>
        <Text tone="muted" style={tailwind("mb-lg")}>
          Which pet is wearing it?
        </Text>
        {myPets.length === 0 ? (
          <EmptyState
            icon="paw-outline"
            title="Add a pet first"
            message="A collar is registered to one of your pets."
            actionLabel="Add a pet"
            onAction={() => navigation.navigate("AddPet")}
          />
        ) : (
          myPets.map((pet) => (
            <Card
              key={idOf(pet)}
              testID={`tracking-pick-${idOf(pet)}`}
              style={tailwind("mb-sm")}
              onPress={() => {
                setLoading(true);
                setPetId(idOf(pet));
              }}
            >
              <Text variant="title">{pet.name}</Text>
            </Card>
          ))
        )}
      </Screen>
    );
  }

  // The owner, with no collar yet: register one.
  if (!data && isOwner) {
    const name = petFromProfile?.name ?? "your pet";
    return (
      <Screen testID="tracking-claim" scroll>
        <Text variant="display" style={tailwind("mb-xs")}>
          {name}&apos;s collar
        </Text>
        <Text tone="muted" style={tailwind("mb-lg")}>
          Enter the serial printed inside the collar to register it.
        </Text>

        {secret ? (
          <Card testID="tracking-secret" style={tailwind("mb-lg border-warning")}>
            <Text weight="600" style={tailwind("mb-xs")}>
              Your collar&apos;s key - shown once
            </Text>
            <Text selectable style={tailwind("mb-sm")}>
              {secret}
            </Text>
            <Text variant="caption" tone="muted" style={tailwind("mb-md")}>
              Enter it in the collar&apos;s set-up app. We don&apos;t keep a copy, so save it
              somewhere safe before leaving this screen.
            </Text>
            <Button testID="tracking-copy-secret" title="Copy key" variant="secondary" onPress={copySecret} />
          </Card>
        ) : null}

        <Card>
          <Text variant="label" tone="muted" style={tailwind("mb-sm uppercase")}>
            Serial number
          </Text>
          <TextInput
            testID="tracking-serial"
            value={serial}
            onChangeText={setSerial}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="PPC-000000"
            placeholderTextColor={tokens.textFaint}
            accessibilityLabel="Collar serial number"
            style={[
              tailwind("border border-border rounded-control px-md text-text bg-surface mb-md"),
              { minHeight: hit.min, fontSize: 16 },
            ]}
          />
          <Button
            testID="tracking-claim-button"
            title="Register collar"
            onPress={claim}
            loading={claiming}
            disabled={serial.trim().length < 6}
          />
          <Text variant="caption" tone="faint" style={tailwind("mt-md")}>
            The collar shows where it last reported. It is not a safety device and
            cannot replace a tag, a chip or a leash.
          </Text>
        </Card>
      </Screen>
    );
  }

  // A friend without a live share, a stranger, or a pet with no collar.
  if (!data) {
    return (
      <Screen testID="tracking-unavailable">
        <EmptyState
          icon="radio-outline"
          title="Not available"
          message="There's no collar position to show for this pet right now."
        />
      </Screen>
    );
  }

  const { pet, owner, device, latest, trail } = data;
  const stale = isStale(latest?.recordedAt);
  const region = latest ? { latitude: latest.latitude, longitude: latest.longitude, ...SPAN } : null;

  return (
    <Screen testID="tracking" scroll padded={false}>
      <View style={[tailwind("bg-surfaceAlt"), { height: 280 }]}>
        {latest ? (
          <MapView
            testID="tracking-map"
            style={StyleSheet.absoluteFill}
            provider={provider}
            initialRegion={region}
            customMapStyle={isDark ? darkMapStyle : []}
            userInterfaceStyle={isDark ? "dark" : "light"}
          >
            {trail.length > 1 ? (
              <Polyline
                testID="tracking-trail"
                coordinates={trail.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))}
                strokeColor={tokens.primary}
                strokeWidth={3}
              />
            ) : null}
            <Marker
              testID="tracking-marker"
              coordinate={{ latitude: latest.latitude, longitude: latest.longitude }}
              title={pet.name}
              description={describeLastSeen(latest.recordedAt)}
            >
              <View style={[styles.pin, { backgroundColor: stale ? tokens.textFaint : tokens.primary }]}>
                <Ionicons name="paw" size={18} color={tokens.onPrimary} />
              </View>
            </Marker>
          </MapView>
        ) : (
          <EmptyState
            testID="tracking-no-position"
            icon="locate-outline"
            title="No position yet"
            message="The collar hasn't reported in. Give it a few minutes outdoors."
          />
        )}
      </View>

      <View style={tailwind("p-lg")}>
        <Card testID="tracking-status" style={tailwind("mb-lg")}>
          <View style={tailwind("flex-row items-center justify-between")}>
            <Text variant="title" style={tailwind("flex-1 mr-md")}>
              {pet.name}
            </Text>
            <View style={tailwind("flex-row items-center")}>
              <Ionicons
                name={batteryIcon(device.batteryPercent)}
                size={18}
                color={device.batteryPercent != null && device.batteryPercent <= 20 ? tokens.danger : tokens.textMuted}
              />
              <Text variant="caption" tone="muted" style={tailwind("ml-xs")}>
                {device.batteryPercent != null ? `${device.batteryPercent}%` : "—"}
              </Text>
            </View>
          </View>
          <Text
            testID="tracking-last-seen"
            tone={stale ? "danger" : "muted"}
            weight={stale ? "600" : undefined}
            style={tailwind("mt-xs")}
          >
            {latest ? `Last seen ${describeLastSeen(latest.recordedAt).toLowerCase()}` : "No position yet"}
            {latest?.accuracyMeters != null ? ` · within ${Math.round(latest.accuracyMeters)} m` : ""}
          </Text>
          {!isOwner && owner?.username ? (
            <Text variant="caption" tone="faint" style={tailwind("mt-xs")}>
              Shared with you by @{owner.username}
            </Text>
          ) : null}
          <Text variant="caption" tone="faint" style={tailwind("mt-sm")}>
            Shows where the collar last reported. Not a safety device.
          </Text>
        </Card>

        {isOwner ? (
          <>
            <Text variant="label" tone="muted" style={tailwind("mb-sm uppercase")}>
              Share with a friend
            </Text>
            <Card testID="tracking-sharing" style={tailwind("mb-lg")}>
              <Text tone="muted" style={tailwind("mb-sm")}>
                A friend you share with sees {pet.name}&apos;s exact position on their map
                until the time runs out. You can stop it any time.
              </Text>
              <SegmentedControl
                testID="tracking-hours"
                options={SHARE_DURATIONS}
                value={hours}
                onChange={setHours}
                accessibilityLabel="How long to share for"
              />
              {friends.length === 0 ? (
                <Text variant="caption" tone="faint" style={tailwind("mt-md")}>
                  Sharing is with pals only. Make some first.
                </Text>
              ) : (
                friends.map((friend) => {
                  const friendId = idOf(friend);
                  const share = shares.find((row) => idOf(row.viewer) === friendId);
                  return (
                    <View
                      key={friendId}
                      testID={`tracking-friend-${friendId}`}
                      style={tailwind("flex-row items-center justify-between py-sm border-t border-border mt-sm")}
                    >
                      <View style={tailwind("flex-1 mr-md")}>
                        <Text weight="600">@{friend.username ?? "friend"}</Text>
                        {share ? (
                          <Text variant="caption" tone="primary">
                            {describeUntil(share.expiresAt)}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        testID={`tracking-share-${friendId}`}
                        accessibilityRole="button"
                        accessibilityLabel={share ? `Stop sharing with ${friend.username}` : `Share with ${friend.username}`}
                        disabled={busyId === friendId}
                        onPress={() => toggleShare(friend)}
                        style={[
                          tailwind(
                            `rounded-pill px-lg justify-center border ${
                              share ? "bg-surface border-border" : "bg-primary border-primary"
                            }`
                          ),
                          { minHeight: hit.min },
                        ]}
                      >
                        <Text variant="label" tone={share ? "muted" : "onPrimary"}>
                          {share ? "Stop" : "Share"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </Card>

            <Text variant="label" tone="muted" style={tailwind("mb-sm uppercase")}>
              The collar
            </Text>
            <Card testID="tracking-device" style={tailwind("mb-lg")}>
              <Text weight="600">Serial {device.serial}</Text>
              <Text variant="caption" tone="muted" style={tailwind("mt-xs")}>
                {device.lastSeenAt ? `Last report ${describeLastSeen(device.lastSeenAt).toLowerCase()}` : "Has not reported yet"}
              </Text>
              <Button
                testID="tracking-remove"
                title="Remove this collar"
                variant="ghost"
                onPress={remove}
                style={tailwind("mt-md")}
              />
            </Card>
          </>
        ) : null}
      </View>
      <View style={tailwind("px-lg pb-lg")}>
        <AskSpotButton inline navigation={navigation} context={{ petId: String(pet?._id ?? petId), screen: "tracking" }} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  pin: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
});

export default PetTrackingScreen;
