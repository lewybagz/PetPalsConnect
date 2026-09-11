import React from "react";
import { Linking } from "react-native";

import { Screen, SettingsRow, SettingsSection, Text, useToast } from "../../components/ui";
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from "../../config/legal";

/**
 * Links to the documents, rather than a copy of them.
 *
 * This rendered "Terms of Service content here..." - placeholder text behind
 * two tabs - which is a store rejection on its own, and a second copy of a
 * legal document is one that drifts from the one the store listing cites.
 * The pages live in the repo's `docs/` folder and are published by GitHub
 * Pages, so the app, the App Store and Google Play all point at one file.
 */
const LegalPoliciesScreen = () => {
  const toast = useToast();

  const open = (url) =>
    Linking.openURL(url).catch(() => toast.error("Couldn't open that page."));

  return (
    <Screen testID="legal-screen" scroll>
      <SettingsSection title="Documents">
        <SettingsRow
          testID="legal-privacy"
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          detail="What we collect and why"
          onPress={() => open(PRIVACY_URL)}
        />
        <SettingsRow
          testID="legal-terms"
          icon="document-text-outline"
          label="Terms of Service"
          detail="The agreement for using PetPals Connect"
          onPress={() => open(TERMS_URL)}
        />
      </SettingsSection>

      <SettingsSection title="Questions">
        <SettingsRow
          testID="legal-contact"
          icon="mail-outline"
          label="Email us"
          detail={SUPPORT_EMAIL}
          onPress={() => open(`mailto:${SUPPORT_EMAIL}`)}
        />
      </SettingsSection>

      <Text variant="caption" tone="muted">
        Both documents open in your browser so you always see the current
        version.
      </Text>
    </Screen>
  );
};

export default LegalPoliciesScreen;
