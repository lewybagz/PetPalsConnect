import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card, Screen, Text, useToast } from "../../components/ui";
import { fetchWaitlistStatus, joinWaitlist } from "../../api/waitlist";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useTokens } from "../../context/AppThemeContext";
import { useTailwind } from "../../styles/tailwind";

/**
 * What somebody outside the launch area sees first.
 *
 * The app is open in Arizona and nowhere else yet, on purpose: every
 * competitor that launched everywhere launched into an empty deck. This
 * screen says so plainly, offers one tap to be told when it opens near them -
 * the email is already on the account, so nothing is typed - and lets them
 * through to the half of the app that works anywhere: their pets, records,
 * reminders and the care hub. It is a session state like the onboarding
 * gates, not a wall.
 */
const WaitlistScreen = () => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { profile, continueAnyway, signOut } = useAuthSession();

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  // A reinstall should not ask somebody to join twice.
  useEffect(() => {
    let cancelled = false;
    fetchWaitlistStatus()
      .then((status) => {
        if (!cancelled) setJoined(status.joined);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const join = async () => {
    setJoining(true);
    try {
      await joinWaitlist();
      setJoined(true);
      toast.success("We'll email you when PetPals opens near you.");
    } catch {
      toast.error("Couldn't add you just now. Try again in a moment.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen testID="waitlist" scroll edges={["top", "bottom"]}>
      <View style={tailwind("items-center mt-xl mb-lg")}>
        <View
          style={[
            tailwind("bg-primarySoft items-center justify-center mb-lg"),
            { width: 72, height: 72, borderRadius: 36 },
          ]}
        >
          <Ionicons name="map-outline" size={34} color={tokens.primary} />
        </View>
        <Text variant="display" align="center">
          Not in your area yet
        </Text>
      </View>

      <Text tone="muted" align="center" style={tailwind("mb-xl")}>
        PetPals Connect is open in Arizona to start with, so there are enough
        dogs nearby for a playdate to actually happen. We&apos;re opening more
        places one at a time
        {profile?.zip ? `, and ${profile.zip} is on the list` : ""}.
      </Text>

      <Card style={tailwind("mb-lg")}>
        <Text variant="label" style={tailwind("mb-sm")}>
          Hear when it opens near you
        </Text>
        <Text tone="muted" style={tailwind("mb-lg")}>
          One email to {profile?.email ?? "your address"} when playdates are on
          in your area. Nothing else.
        </Text>
        <Button
          testID="waitlist-join"
          title={joined ? "You're on the list" : "Notify me"}
          variant={joined ? "secondary" : "primary"}
          loading={joining}
          disabled={joined}
          onPress={join}
        />
      </Card>

      <Card style={tailwind("mb-lg")}>
        <Text variant="label" style={tailwind("mb-sm")}>
          Use the rest in the meantime
        </Text>
        <Text tone="muted" style={tailwind("mb-lg")}>
          Your pets, their vaccination and medication reminders, and the care
          hub work anywhere. Only finding playdates is waiting on your area.
        </Text>
        <Button
          testID="waitlist-continue"
          title="Continue to my pets"
          variant="secondary"
          onPress={continueAnyway}
        />
      </Card>

      <Button
        testID="waitlist-sign-out"
        title="Sign out"
        variant="ghost"
        onPress={signOut}
        style={tailwind("mb-xl")}
      />
    </Screen>
  );
};

export default WaitlistScreen;
