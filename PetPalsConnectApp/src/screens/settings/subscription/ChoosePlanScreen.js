import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTailwind } from "../../../styles/tailwind";
import {
  fetchPackages,
  purchase,
  purchasesConfigured,
  restore,
} from "../../../api/subscriptions";
import { useAuthSession } from "../../../context/AuthSessionContext";
import { useTokens } from "../../../context/AppThemeContext";
import { useToast } from "../../../components/ui";
import { PRIVACY_URL, TERMS_URL } from "../../../config/legal";

const STORE = Platform.OS === "ios" ? "the App Store" : "Google Play";

/**
 * Plan picker.
 *
 * The plans are the current offering in RevenueCat, so the name, description
 * and price on each card are the store's own - the app never hardcodes an
 * amount, and a plan not on the offering is not on this screen. Buying goes
 * through the store's sheet; RevenueCat tells the server over a webhook a
 * moment later, which is why the confirmation says "a few seconds".
 *
 * "Restore purchases" is an Apple requirement wherever purchases are offered:
 * a reinstall, or a second device, gets its subscription back without paying
 * again.
 */
const ChoosePlanScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const { refresh } = useAuthSession();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // a package identifier, or "restore"

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const available = await fetchPackages();
        if (!cancelled) setPackages(available);
      } catch (error) {
        if (!cancelled) console.warn("[plans]", error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const buy = useCallback(
    async (pkg) => {
      setBusy(pkg.identifier);
      try {
        const entitled = await purchase(pkg);
        if (entitled === null) return; // closed the sheet

        // The server learns from the webhook; re-reading the profile picks
        // the flag up once it lands, and the confirmation screen says so.
        refresh().catch(() => {});
        navigation.navigate("SubscriptionConfirmation", {
          action: entitled ? "started" : "received",
          planName: pkg.product.title,
        });
      } catch (error) {
        toast.error(error.message ?? "That purchase didn't go through.");
      } finally {
        setBusy(null);
      }
    },
    [navigation, refresh, toast]
  );

  const onRestore = useCallback(async () => {
    setBusy("restore");
    try {
      const entitled = await restore();
      if (entitled) {
        refresh().catch(() => {});
        toast.success("Your subscription is back.");
        navigation.navigate("SubscriptionManagement");
      } else {
        toast.show(`No subscription found for your ${STORE} account.`);
      }
    } catch (error) {
      toast.error(error.message ?? "Couldn't restore purchases.");
    } finally {
      setBusy(null);
    }
  }, [navigation, refresh, toast]);

  if (loading) {
    return (
      <View style={tailwind("flex-1 items-center justify-center")}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!purchasesConfigured() || packages.length === 0) {
    return (
      <View style={tailwind("flex-1 items-center justify-center p-8")}>
        <Text style={tailwind("text-lg font-semibold text-center mb-2 text-text")}>
          Subscriptions are not available yet
        </Text>
        <Text style={tailwind("text-base text-textMuted text-center")}>
          Check back soon - everything in the app still works without one.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={tailwind("p-4")}>
      {packages.map((pkg) => (
        <TouchableOpacity
          key={pkg.identifier}
          testID={`package-${pkg.identifier}`}
          disabled={busy !== null}
          onPress={() => buy(pkg)}
          style={tailwind(
            `bg-surface border border-border rounded-2xl p-5 mb-4 ${
              busy !== null && busy !== pkg.identifier ? "opacity-50" : ""
            }`
          )}
        >
          <Text style={tailwind("text-xl font-bold mb-1 text-text")}>
            {pkg.product.title}
          </Text>
          {pkg.product.description ? (
            <Text style={tailwind("text-base text-textMuted mb-4")}>
              {pkg.product.description}
            </Text>
          ) : null}

          <View style={tailwind("bg-primary rounded-xl py-3 items-center justify-center")}>
            {busy === pkg.identifier ? (
              <ActivityIndicator color={tokens.surface} />
            ) : (
              <Text style={tailwind("text-onPrimary font-semibold text-base")}>
                {pkg.product.priceString}
                {pkg.packageType === "ANNUAL"
                  ? " / year"
                  : pkg.packageType === "MONTHLY"
                    ? " / month"
                    : ""}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        testID="restore-purchases"
        disabled={busy !== null}
        onPress={onRestore}
        style={tailwind("py-3 items-center")}
      >
        {busy === "restore" ? (
          <ActivityIndicator color={tokens.primary} />
        ) : (
          <Text style={tailwind("text-primary font-semibold")}>Restore purchases</Text>
        )}
      </TouchableOpacity>

      {/* Apple 3.1.2 and Google Play both want the renewal terms and links to
          the Terms and Privacy Policy on the screen that sells the subscription,
          not only in the store listing. */}
      <Text style={tailwind("text-xs text-textMuted text-center mt-2")}>
        Billed to your {STORE} account at the price shown. Renews automatically
        each period until you cancel, at least 24 hours before it renews, in your{" "}
        {STORE} subscription settings. Cancelling keeps your access to the end of
        the period you paid for. By subscribing you agree to the{" "}
        <Text
          testID="plans-terms"
          style={tailwind("text-primary")}
          onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
        >
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text
          testID="plans-privacy"
          style={tailwind("text-primary")}
          onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </ScrollView>
  );
};

export default ChoosePlanScreen;
