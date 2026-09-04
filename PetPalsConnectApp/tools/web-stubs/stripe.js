/**
 * `@stripe/stripe-react-native` has no web build.
 *
 * `PaymentsProvider` already renders its children untouched when Stripe is not
 * configured - payments are optional everywhere - so this only has to exist,
 * not work.
 */
import React from "react";

export const StripeProvider = ({ children }) => <>{children}</>;
export const useStripe = () => ({
  initPaymentSheet: async () => ({ error: { message: "unavailable on web" } }),
  presentPaymentSheet: async () => ({ error: { message: "unavailable on web" } }),
});
export const usePaymentSheet = () => ({});
export const initStripe = async () => {};
