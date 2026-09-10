/**
 * `react-native-purchases` has no web build.
 *
 * `PurchasesProvider` already does nothing without a key - payments are
 * optional everywhere - so this only has to exist, not work. The gallery
 * never sets a key.
 */
const Purchases = {
  configure: () => {},
  logIn: async () => ({}),
  logOut: async () => ({}),
  setLogLevel: async () => {},
  getOfferings: async () => ({ current: null }),
  purchasePackage: async () => {
    throw new Error("unavailable on web");
  },
  restorePurchases: async () => ({ entitlements: { active: {} }, managementURL: null }),
  getCustomerInfo: async () => ({ entitlements: { active: {} }, managementURL: null }),
};

export const LOG_LEVEL = { DEBUG: "DEBUG" };
export default Purchases;
