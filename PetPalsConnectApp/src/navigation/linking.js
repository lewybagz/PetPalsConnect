/**
 * Deep links into the app.
 *
 * The one link the app has to answer today is Stripe Checkout sending the
 * buyer back: `petpalsconnect://store/order/{session}` after a payment and
 * `petpalsconnect://store/cancelled` if they backed out. The scheme is
 * `app.json`'s; `linking.test.js` checks the two agree, and that every screen
 * named here is one `AppStack` registers - a link to a route that does not
 * exist opens the app on whatever was there before, silently.
 *
 * Nested under `App` because that is the Root navigator's name for the
 * signed-in tree. A link that arrives while signed out is dropped, which is
 * right: an order is read against the account that placed it.
 */
export const SCHEME = "petpalsconnect";

export const linking = {
  prefixes: [`${SCHEME}://`],
  config: {
    screens: {
      App: {
        screens: {
          OrderDetail: "store/order/:sessionId",
          Shop: "store/cancelled",
        },
      },
    },
  },
};

export default linking;
