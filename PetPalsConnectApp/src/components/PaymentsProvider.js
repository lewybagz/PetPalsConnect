import React from "react";
import { StripeProvider } from "@stripe/stripe-react-native";

import { STRIPE_PUBLISHABLE_KEY } from "../config/env";
import { paymentsConfigured } from "../api/subscriptions";

/**
 * Wraps the app in Stripe's context, but only when a publishable key exists.
 *
 * `StripeProvider` with an empty key throws on the native side at startup, so a
 * developer who has not set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY would be unable
 * to open the app at all. Payments are optional; the rest of the app is not.
 *
 * The key is public by design - it identifies the account, it does not
 * authorise charges. The secret key lives on the server only.
 */
const PaymentsProvider = ({ children }) => {
  if (!paymentsConfigured()) return children;

  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      urlScheme="petpalsconnect" // Return path for 3D Secure / bank redirects.
    >
      {children}
    </StripeProvider>
  );
};

export default PaymentsProvider;
