import { useEffect } from "react";

import { syncPurchasesUser } from "../api/subscriptions";
import { useAuthSession } from "../context/AuthSessionContext";

/**
 * Keeps the RevenueCat SDK pointed at whoever is signed in.
 *
 * The app user id is the Firebase uid, which is what the server's webhook
 * resolves to a profile - so a purchase made here lands on the right account
 * there. Signing out logs the SDK out, so the next account on this phone does
 * not inherit the previous one's entitlement.
 *
 * Renders its children untouched, and does nothing at all without a key:
 * payments are optional everywhere, and a missing key must never stop the app
 * from opening.
 */
const PurchasesProvider = ({ children }) => {
  const { firebaseUser } = useAuthSession();
  const uid = firebaseUser?.uid ?? null;

  useEffect(() => {
    syncPurchasesUser(uid).catch((error) =>
      console.warn("[purchases] Could not sync user:", error.message)
    );
  }, [uid]);

  return children;
};

export default PurchasesProvider;
