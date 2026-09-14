import React, { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Screen, Text } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import { requestPushPermission } from "../../services/pushPermission";

/**
 * The first thing somebody sees after onboarding, and the last screen before
 * the app.
 *
 * Two jobs, and they belong together because they are the same job: telling a
 * brand-new user what this app is for, and asking for the notification
 * permission at the one moment there is a reason to explain it.
 *
 * Before this, "Finish setting up" dropped people on Home - shelves of other
 * people's pets, an empty favourites row, an article - and the OS notification
 * prompt fired on the same frame from a mount effect. So the app's first
 * impression was a system dialog over the least representative screen it has,
 * and the button at the end of this now lands on Discover instead.
 *
 * Deliberately not an `OnboardingProgress`. Onboarding finished at the pet
 * step; a progress bar here would read as a fourth form, and this is the app.
 *
 * A petless owner - somebody who skipped the pet prompt, or whose only pet is
 * a cat - gets a different last panel and a different destination, because
 * Discover is not their screen and sending them to an empty deck would be the
 * exact failure this screen exists to fix.
 */

const Panel = ({ icon, title, children }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  return (
    <View style={tailwind("flex-row items-start mb-xl")}>
      <View
        style={tailwind(
          "w-12 h-12 rounded-pill bg-primarySoft items-center justify-center mr-md"
        )}
      >
        <Ionicons name={icon} size={24} color={tokens.primary} />
      </View>
      <View style={tailwind("flex-1")}>
        <Text variant="title" style={tailwind("mb-xs")}>
          {title}
        </Text>
        <Text tone="muted">{children}</Text>
      </View>
    </View>
  );
};

export default function FirstRunScreen() {
  const tailwind = useTailwind();
  const { finishIntro, profile, hasDog } = useAuthSession();
  const [busy, setBusy] = useState(false);

  // The push sheet says "wants to meet {name}", which is the whole reason to
  // ask here rather than on launch - it can name the actual dog.
  const petName = profile?.pets?.find((pet) => pet?.name)?.name ?? null;

  const onContinue = async () => {
    setBusy(true);
    try {
      // Asked here, in context, with the app's own explanation first. On iOS
      // the OS prompt fires once and permanently, so this is the only chance
      // the app ever gets at it.
      await requestPushPermission({ petName });
    } catch (error) {
      // `requestPushPermission` swallows its own failures, so this is only
      // reachable if the module itself is missing. Caught rather than left to
      // `finally` alone, because an unhandled rejection here would trap
      // somebody on the welcome screen - the worst failure this screen has.
      console.warn("[push] Ask failed:", error.message);
    } finally {
      // Whatever they answered - including "Not now" - the intro is over. A
      // refusal is an answer, and re-showing this screen would make it a nag.
      setBusy(false);
      await finishIntro();
    }
  };

  return (
    <Screen testID="first-run" scroll edges={["top", "bottom"]}>
      <View style={tailwind("items-center mt-xl mb-xl")}>
        <Text variant="display" align="center">
          {petName ? `${petName} is all set` : "You’re all set"}
        </Text>
        <Text tone="muted" align="center" style={tailwind("mt-sm")}>
          Here’s what PetPals is for.
        </Text>
      </View>

      {hasDog ? (
        <Panel icon="heart-outline" title="Find a playmate">
          Swipe through dogs near you. When you both say yes, you can message
          each other and arrange a walk.
        </Panel>
      ) : (
        <Panel icon="paw-outline" title="Everything for your pets">
          Keep vaccinations, weights and reminders in one place - and add a dog
          any time to unlock matching and playdates.
        </Panel>
      )}

      <Panel icon="medkit-outline" title="Care, close to home">
        Vets and emergency numbers, food and supply picks for your pet’s age and
        size, and a poison lookup for the moments that matter.
      </Panel>

      <Panel icon="shield-checkmark-outline" title="You’re in control">
        Your exact location is never shared - other owners see an approximate
        area. Block or report anybody, from anywhere you meet them.
      </Panel>

      <Button
        testID="first-run-continue"
        title={hasDog ? "Start swiping" : "Go to my pets"}
        loading={busy}
        onPress={onContinue}
        style={tailwind("mt-md")}
      />

      <Text variant="caption" tone="faint" align="center" style={tailwind("mt-md")}>
        We’ll ask about notifications next - you can say no and still use
        everything.
      </Text>
    </Screen>
  );
}
