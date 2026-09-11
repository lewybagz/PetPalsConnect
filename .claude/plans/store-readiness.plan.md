# Store readiness — closing the gaps in existing features

Status: **in progress** - Phases 0-3 done (billing decision: RevenueCat). Written 2026-09-09 against `main` @ `34d232b`.
Source: the end-to-end gap audit of the same day (screen → API client → route → controller, plus `app.json` against each platform's requirements).

## Overview and goal

Every feature the app already has should work end to end on a real iPhone and a real Android phone, and nothing in the build should be a known App Store / Play review rejection. No new features; the one architectural change (billing) exists only because the current one cannot ship.

"Done" = an EAS production build of both platforms that a reviewer can sign in to with Apple, Google, email or phone, receives a push on, can read the privacy policy from, and where every button in the audit list does what it says.

Non-goals (deferred, listed at the end): universal links, multi-device push, calendar/share integrations, phone-auth polish beyond correctness.

## Architecture decisions

### 1. Billing: RevenueCat replaces Stripe — pending your yes

`subscribed` widens the matching deck ([backend/controllers/PetMatchController.js:57-61](../../backend/controllers/PetMatchController.js#L57-L61)). That is digital content, so Apple 3.1.1 and Play's payments policy require native IAP. The Stripe PaymentSheet flow in [ChoosePlanScreen.js](../../PetPalsConnectApp/src/screens/settings/subscription/ChoosePlanScreen.js) is a rejection on both stores regardless of how well it works.

| Option | Fits repo | Files | New deps | Risk | Verdict |
| --- | --- | --- | --- | --- | --- |
| **RevenueCat** (`react-native-purchases`) | Keeps the existing shape exactly: one webhook is the only writer of `Subscription`, then `user.subscribed`. Mirrors `syncFromStripe` line for line. | ~10 | 1 app dep, 0 backend deps (webhook is plain HTTP) | Low — receipt validation, renewals, refunds, grace periods all handled server-side by RC; free under $2.5k MTR | **Recommended** |
| `expo-iap` / `react-native-iap` direct | Repo would own receipt validation for App Store Server API + Play Developer API, renewal polling, and two webhook formats | ~20 | 1 app dep + 2 backend deps (Google/Apple verifiers) | High — this is the category of code that fails silently in month 3 | No |
| Drop premium for launch | Delete Stripe surface; `isSubscribed` path stays false | ~-15 | 0 | None | Acceptable fallback if you'd rather not set up IAP products now |

Design (if RevenueCat):

- **App user id = Firebase uid.** `Purchases.configure({ apiKey, appUserID: firebaseUser.uid })` once the session is signed in, `Purchases.logOut()` on sign-out. The webhook's `app_user_id` then resolves to a `User` by `firebaseUid`, which is already unique-indexed.
- **One entitlement, `premium`.** The client checks `customerInfo.entitlements.active.premium` for instant UI; the *server* still reads `user.subscribed`, which only the webhook writes. Same split as today ("Stripe is the source of truth; Mongo mirrors it").
- **Webhook** `POST /api/revenuecat-webhooks`, mounted like `stripeWebhooks` (before `authenticate`, authenticated by the `Authorization` header RC sends, compared in constant time against `REVENUECAT_WEBHOOK_SECRET`). Idempotent: upsert on `(user, store, productId)`; RC retries on non-2xx, so unknown event types answer 200.
- **Manage/cancel** is the store's job: `SubscriptionManagementScreen` links to `customerInfo.managementURL`. `cancel`/`resume` routes go.
- **Restore purchases** button is an Apple requirement — `Purchases.restorePurchases()`.

```mermaid
sequenceDiagram
  participant App
  participant RC as RevenueCat
  participant Store as App Store / Play
  participant API as backend
  App->>RC: configure(uid); getOfferings()
  App->>Store: purchasePackage()
  Store-->>RC: receipt
  RC-->>App: customerInfo (entitlements.active.premium)
  RC->>API: POST /api/revenuecat-webhooks (INITIAL_PURCHASE / RENEWAL / EXPIRATION …)
  API->>API: syncFromRevenueCat → Subscription upsert → user.subscribed
  App->>API: GET /api/users/me (subscribed: true)
```

### 2. Sign in with Apple: `@invertase/react-native-apple-authentication`

Same maintainer as the RNFB packages the app already runs on; it generates and returns the nonce itself, so no `expo-crypto`. Expo needs `"ios": { "usesAppleSignIn": true }` for the entitlement. iOS only — the button is hidden on Android (RNFB docs confirm it is not required there). Firebase credential: `new OAuthProvider("apple.com").credential({ idToken, rawNonce })` (`AppleAuthProvider` is deprecated as of RNFB v25).

Apple also requires **token revocation on account deletion** for Sign in with Apple users (guideline 5.1.1(v), since June 2022). RNFB exposes `revokeToken(authorizationCode)`; it needs a fresh Apple `authorizationCode`, so `deleteAccount` re-prompts Apple users before calling `DELETE /api/users/me`. Email/Google users are unaffected.

### 3. Android notification icon, channel and app badge: `expo-notifications` for config only

FCM delivery stays on RNFB — nothing moves to Expo push. `expo-notifications` is added for the three things RNFB messaging does not do: the config plugin (`icon`, `color`, `defaultChannel`), `setNotificationChannelAsync` on launch, and `setBadgeCountAsync` for the iOS app-icon badge. Without a created channel FCM drops Android 8+ notifications into "Miscellaneous" with a grey square icon.

### 4. Everything else is a fix inside an existing pattern

No new abstractions. Each item below names the helper that already exists and is not being called.

## Phases

Each phase is one PR. Phase 0 unblocks device testing of everything after it; Phase 2 is independent of the rest and can slot anywhere once the billing decision is made.

### Phase 0 — config-only store blockers (done 2026-09-10)

Files: [PetPalsConnectApp/app.json](../../PetPalsConnectApp/app.json), [PetPalsConnectApp/.env.example](../../PetPalsConnectApp/.env.example), new `PetPalsConnectApp/app.config.test.js`.

| id | todo | status |
| --- | --- | --- |
| 0.1 | Add `ios.entitlements["aps-environment"] = "production"` and `ios.infoPlist.UIBackgroundModes = ["remote-notification"]` (RNFB docs: required since SDK 51; without them `getToken()` throws on every iPhone) | done |
| 0.2 | Add `["@react-native-google-signin/google-signin", { "iosUrlScheme": "<REVERSED_CLIENT_ID from GoogleService-Info.plist>" }]` to `plugins` — read it from the plist at config time via `app.config.js` rather than committing it | done |
| 0.3 | Set `ios.requireFullScreen: true` (keeps `supportsTablet`; the alternative is dropping iPad) | done |
| 0.4 | Remove `NSLocationAlwaysAndWhenInUseUsageDescription` and `NSPhotoLibraryAddUsageDescription` — neither capability is used, and reviewers read them | done |
| 0.5 | Remove `expo-secure-store` from `plugins` and `dependencies` (0 imports) | done |
| 0.6 | Add `app.config.test.js`: asserts the entitlement, the background mode, the google-signin plugin, `requireFullScreen`, and that no `NS*UsageDescription` key names a capability with no matching `plugins` entry — the gate that stops 0.1–0.4 regressing | done |
| 0.7 | Note in `.env.example` that `EXPO_PUBLIC_FIREBASE_*` are unused (RNFB reads the native config files) and delete them | done |

Prerequisite outside the repo: `eas init` (the `projectId` is all zeros), APNs auth key uploaded to Firebase → Cloud Messaging.

### Phase 1 — Sign in with Apple (1 session)

Files: [LoginScreen.js](../../PetPalsConnectApp/src/screens/auth/LoginScreen.js), [RegisterScreen.js](../../PetPalsConnectApp/src/screens/auth/RegisterScreen.js), [AuthSessionContext.js](../../PetPalsConnectApp/src/context/AuthSessionContext.js), new `src/api/appleAuth.js`, `app.json`.

| id | todo | status |
| --- | --- | --- |
| 1.1 | `npm i @invertase/react-native-apple-authentication`; `ios.usesAppleSignIn: true` in `app.json`; extend `app.config.test.js` | done |
| 1.2 | `src/api/appleAuth.js`: `signInWithApple()` — `performRequest` → `OAuthProvider("apple.com").credential({ idToken, rawNonce })` → `signInWithCredential`. One function, used by both auth screens (the Google handler is already duplicated across them; do not add a third copy) | done |
| 1.3 | `AppleButton` (the lib's HIG-compliant control) on Login and Register, `Platform.OS === "ios"` only, above Google | done |
| 1.4 | `deleteAccount` in `AuthSessionContext`: if `providerData` includes `apple.com`, re-run `performRequest` and `revokeToken(authorizationCode)` before `DELETE /api/users/me` | done |
| 1.5 | Test: `appleAuth.test.js` with the lib mocked in `jest.setup.js` — asserts the credential is built from `identityToken` + `nonce` and that a missing token throws before any Firebase call | done |

Console: Firebase → Authentication → Apple provider enabled; Apple Developer → identifier → Sign in with Apple capability.

### Phase 2 — billing on RevenueCat (done; decision: RevenueCat)

Backend files: new `routes/revenuecatWebhooks.js`, [SubscriptionController.js](../../backend/controllers/SubscriptionController.js), [models/Subscription.js](../../backend/models/Subscription.js), [services/subscriptions/plans.js](../../backend/services/subscriptions/plans.js), [Server.js](../../backend/Server.js), [test/subscriptions.test.js](../../backend/test/subscriptions.test.js). App files: [PaymentsProvider.js](../../PetPalsConnectApp/src/components/PaymentsProvider.js), [subscriptions.ts](../../PetPalsConnectApp/src/api/subscriptions.ts), the four `settings/subscription/*` screens, [types/api.ts](../../PetPalsConnectApp/src/types/api.ts).

| id | todo | status |
| --- | --- | --- |
| 2.1 | `Subscription` model: replace `stripe*` fields with `store` (`app_store`/`play_store`), `productId`, `rcOriginalTransactionId`; keep `status` enum but map RC events onto it (`active`, `trialing`, `past_due` for BILLING_ISSUE, `canceled` for EXPIRATION). `schemaAudit` + `types.test.js` enforce the rename on both sides | done |
| 2.2 | `syncFromRevenueCat(event)` next to where `syncFromStripe` was: resolve `User` by `firebaseUid = app_user_id`, upsert, set `user.subscribed`; unit-tested with fixture events including a duplicate delivery | done |
| 2.3 | `routes/revenuecatWebhooks.js` mounted before `authenticate`; constant-time compare of the `Authorization` header with `REVENUECAT_WEBHOOK_SECRET`; unknown types → 200 | done |
| 2.4 | Delete: `config/stripe.js`, `routes/stripeWebhooks.js`, `routes/payments.js`, `PaymentController.js`, `POST /subscriptions`, `/cancel`, `/resume`, `stripe` dep, `STRIPE_*` env keys and their `.env.example` entries; `plans.js` becomes a list of `{ id, entitlement, productIds }` | done |
| 2.5 | App: `PurchasesProvider` replaces `PaymentsProvider` — `Purchases.configure({ apiKey: Platform.select(...), appUserID: uid })` when the session has a Firebase user, `logOut()` when it doesn't; renders children untouched when no key (same "payments are optional" rule) | done |
| 2.6 | `ChoosePlanScreen`: `getOfferings()` → packages → `purchasePackage()`; **Restore purchases** button; on success `refresh()` the session and navigate to confirmation. `SubscriptionManagementScreen`: opens `managementURL`; history stays on `/api/subscriptions/history` | done |
| 2.7 | Delete `AddPaymentMethodScreen`, `PaymentMethodsScreen`, their `AppStack` entries and the Settings row; `@stripe/stripe-react-native` and its plugin go | done |
| 2.8 | Test: `subscriptions.test.js` rewritten for the webhook (signature, idempotency, `user.subscribed` flip both ways); `contract.test.js` must still pass with the deleted routes | done |

Console: RevenueCat project, `premium` entitlement, one monthly product on each store, webhook URL + secret, public API keys → `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Real purchases need a dev build (Expo Go runs the SDK in preview mode).

### Phase 3 — legal pages (done 2026-09-10; documents researched and rewritten the same day)

Files: [LegalPoliciesScreen.js](../../PetPalsConnectApp/src/screens/settings/LegalPoliciesScreen.js), move `PetPalsConnectApp/docs/index.html` + `privacy-policy.html` → repo-root `docs/` for GitHub Pages, new `docs/terms.html`.

| id | todo | status |
| --- | --- | --- |
| 3.1 | Host the privacy policy: repo-root `docs/privacy.html` (GitHub Pages from `/docs`), write `docs/terms.html` from the same template — a URL the store listing can cite | done |
| 3.2 | `LegalPoliciesScreen` → two `SettingsRow`s from `components/ui` opening the URLs with `Linking.openURL` (stdlib; no in-app WebView dep). Delete the placeholder switch | done |
| 3.3 | Register screen: one line under the button — "By continuing you agree to the Terms and Privacy Policy" with both tappable | done |

### Phase 4 — sign-out hygiene and push on both platforms (1 session)

Files: [usePushNotifications.js](../../PetPalsConnectApp/src/hooks/usePushNotifications.js), [AuthSessionContext.js](../../PetPalsConnectApp/src/context/AuthSessionContext.js), [SettingsScreen.js:55](../../PetPalsConnectApp/src/screens/settings/SettingsScreen.js#L55), [useSessionStore.js](../../PetPalsConnectApp/src/hooks/useSessionStore.js), [redux/reducers.js](../../PetPalsConnectApp/src/redux/reducers.js), [NotificationController.js:168](../../backend/controllers/NotificationController.js#L168), [routes/notifications.js](../../backend/routes/notifications.js), [NotificationService.js:78](../../backend/services/NotificationService.js#L78), `app.json`.

| id | todo | status |
| --- | --- | --- |
| 4.1 | Backend `DELETE /api/notifications/device-token` — clears `fcmToken` only if the body's token matches (a stale device must not wipe a newer one); test in `push.test.js` | todo |
| 4.2 | `AuthSessionContext.signOut`: delete the token, `disconnectSocket()`, clear cache, then Firebase `signOut`. `SettingsScreen.handleSignOut` calls the context's `signOut` instead of Firebase directly (it currently skips the cache clear too) | todo |
| 4.3 | `usePushNotifications`: subscribe `onTokenRefresh` and re-POST; FCM rotates tokens | todo |
| 4.4 | Redux `RESET_SESSION` handled by every slice; `useSessionStore` dispatches it when `userId` becomes null — chats, notifications and playdates from account A must not render for account B | todo |
| 4.5 | `sendPush` payload: `apns: { payload: { aps: { sound: "default", badge } } }`, `android: { priority: "high", notification: { channelId: "default" } }`; `badge` = unread count (one `Notification.countDocuments`) | todo |
| 4.6 | `expo-notifications`: plugin entry with `icon: "./assets/notification-icon.png"` (monochrome, white on transparent), `color: tokens.primary`, `defaultChannel: "default"`; create the channel on launch; `setBadgeCountAsync(unread)` wherever `setUnreadCount` is dispatched | todo |
| 4.7 | Test: `push.test.js` asserts the `apns`/`android` blocks and that the delete route ignores a non-matching token; `usePushNotifications.test.js` asserts sign-out deletes before Firebase sign-out | todo |

### Phase 5 — flows that exist but don't complete (1 session)

| id | todo | files | status |
| --- | --- | --- | --- |
| 5.1 | Friend requests: use `acceptFriendRequest`/`declineFriendRequest` from `src/api/friends.js` (fixes the decline body bug and the hand-set header), remove the row on success, show `EmptyState` when none | [FriendRequestsScreen.js](../../PetPalsConnectApp/src/screens/profile/FriendRequestsScreen.js) | todo |
| 5.2 | Give Pals an entry point: "Pals" and "Pal requests" in `MoreScreen.SHORTCUTS` (already the hub's link table), requests row shows a count | [MoreScreen.js:53](../../PetPalsConnectApp/src/screens/bottomTab/MoreScreen.js#L53) | todo |
| 5.3 | `playdateRange` from `useSettings()` in both playdate screens; delete app-root `services/UserService.js` once nothing imports it | [SchedulePlaydateScreen.js:159](../../PetPalsConnectApp/src/screens/playdate/SchedulePlaydateScreen.js#L159), [PotentialPlaydateLocationsScreen.js:50](../../PetPalsConnectApp/src/screens/playdate/PotentialPlaydateLocationsScreen.js#L50) | todo |
| 5.4 | Favourites: long-press → `ActionSheet` "Remove from favourites" → `removeFavorite` (exists, unused) | [FavoritesScreen.js](../../PetPalsConnectApp/src/screens/profile/FavoritesScreen.js) | todo |
| 5.5 | Delete Profile's no-op Logout button (Settings has the real one) and the two dead email-verification screens + their `AuthStack` entries; keep `sendEmailVerification` on register | [ProfileScreen.js:246](../../PetPalsConnectApp/src/screens/profile/ProfileScreen.js#L246), `EmailAuthScreen.js`, `VerificationSelectionScreen.js` | todo |
| 5.6 | Phone auth on the design system: `Screen`/`Button`/`Text`, `autoComplete="tel"` + `textContentType="telephoneNumber"` on the number, `autoComplete="sms-otp"` + `textContentType="oneTimeCode"` on the code so both OSes autofill it, two-step layout (number → code) | [PhoneAuthScreen.js](../../PetPalsConnectApp/src/screens/auth/PhoneAuthScreen.js) | todo |
| 5.7 | The missing gate: extend `navigation.test.js` — every screen registered in `AppStack`/`AuthStack` must be named by a `navigate()`, a link table, or a notification destination. This is the check the memory notes say the repo lacks; it would have caught 5.2 and 5.5 | [navigation.test.js](../../PetPalsConnectApp/src/screens/navigation/navigation.test.js) | todo |

### Phase 6 — chat on a phone (1 session)

Files: [ChatScreen.js](../../PetPalsConnectApp/src/screens/bottomTab/ChatScreen.js), [MessageItemComponent.js](../../PetPalsConnectApp/src/components/MessageItemComponent.js), [services/photos.js](../../PetPalsConnectApp/src/services/photos.js), [chatController.handleSendMedia](../../backend/controllers/chatController.js), [DiscoverScreen.js](../../PetPalsConnectApp/src/screens/swipe/DiscoverScreen.js).

| id | todo | status |
| --- | --- | --- |
| 6.1 | `KeyboardAvoidingView` (`behavior="padding"` on iOS, `keyboardVerticalOffset` = header height via `useHeaderHeight`); drop `Keyboard.dismiss()` on send | todo |
| 6.2 | Local `sending` state replaces the global `chat.isLoading` — a send must never unmount the conversation into a spinner | todo |
| 6.3 | `inverted` FlatList with messages reversed; removes the `scrollToEnd` effect | todo |
| 6.4 | Read `handleSendMedia`'s contract first, then: attach button → `pickPhoto` + `compressPhoto` → upload to `chat/<uid>/…` (`storage.rules` already allows it) → `POST /api/chats/sendmedia`; `MessageItemComponent` renders an image message; `MediaView` already displays them | todo |
| 6.5 | `expo-haptics`: `notificationAsync(Success)` on a mutual match, `impactAsync(Light)` when a swipe crosses the commit threshold (`stampOpacity` reaching 1 is the existing signal) | todo |
| 6.6 | Tests: `ChatScreen.test.js` — sending keeps the list mounted; media message renders an `Image`; `chat.test.js` covers `sendmedia` with a non-storage URL rejected (same rule as `services/photos.js` on the backend) | todo |

### Phase 7 — dead weight (½ session, last)

| id | todo | status |
| --- | --- | --- |
| 7.1 | Delete app-root `utils/tokenutil.js`, `services/`, `firebase/`; strip the 15 hand-set `Authorization` headers (the axios interceptor overwrites them anyway) | todo |
| 7.2 | Remove `lottie-react-native`, `expo-constants` (0 imports); keep `react-native-pager-view` (peer of material-top-tabs) and `expo-linking` (Expo internal) | todo |
| 7.3 | `store.test.js`-style walker: fail on any import from outside `src/` except `App.js`/`index.js` — stops the app-root dirs coming back | todo |

### Phase 3b — legal research and the two code exposures it found (done 2026-09-10)

| id | todo | status |
| --- | --- | --- |
| 3b.1 | Rewrite `docs/privacy.html` to what the app does (no card data, no analytics, precise location with consent shown coarse, Firebase/RevenueCat/Google Maps disclosures, retention table, US-state and PIPEDA/Law 25 sections, placeholders for address and privacy officer) | done |
| 3b.2 | Complete `docs/terms.html`: Apple minimum EULA terms, Google Maps ToS incorporation, ROSCA/state-ARL subscription disclosures, DMCA agent + procedure, UGC moderation per Apple 1.2, assumption of risk / release / indemnity for meetups, AAA arbitration with 30-day opt-out and Canadian carve-out, Texas ASAA minors clause, placeholders for state/address/agent | done |
| 3b.3 | `docs/delete-account.html` — the web deletion resource Google Play requires | done |
| 3b.4 | Account deletion cascades through every model (`services/accountDeletion.js`) and empties the account's Storage folders; `accountDeletion.test.js` fails on a new `ref: "User"` model that is neither cascaded nor in `RETAINED` | done |
| 3b.5 | `/api/petmatches/map` rounds other users' coordinates to ~1 km; `map.test.js` asserts the exact value never leaves the server | done |
| 3b.6 | Plan picker carries the renewal terms and links to Terms/Privacy (Apple 3.1.2, Play subscriptions policy) | done |

Still on you: fill the placeholders, register the DMCA agent, enable Pages, paste the URLs into both consoles, and have a lawyer read both documents - see the README checklist.

## Env vars and dashboard prerequisites

| Where | What |
| --- | --- |
| `eas init` | real `projectId` (currently zeros) |
| Apple Developer | Sign in with Apple capability on the app id; APNs auth key (.p8) |
| Firebase console | Apple provider enabled; APNs key uploaded; Play Integrity API enabled for phone auth; SHA-256 fingerprints registered |
| RevenueCat (Phase 2) | project, `premium` entitlement, products, webhook secret → `REVENUECAT_WEBHOOK_SECRET` (backend `.env`), `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` (app `.env`) |
| App Store Connect / Play Console | one auto-renewing product each; privacy policy URL from Phase 3 |
| Repo settings | GitHub Pages from `/docs` |

## Test plan

Exactly what CI runs ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)):

```bash
cd backend && npm run lint && npm run check:schemas && npm run check:auth && npm test
cd PetPalsConnectApp && npx eslint . && npm run typecheck && npm run check:colours && npm test
cd PetPalsConnectApp && npx expo export --platform android --output-dir /tmp/export-android
cd PetPalsConnectApp && npx expo export --platform ios --output-dir /tmp/export-ios
cd PetPalsConnectApp && npx expo-doctor@latest
node data-fetch-scripts/articles/seedArticles.js --dry-run
cd PetPalsConnectApp && npm run gallery && npm run screenshots   # after Phases 3, 5, 6
```

New tests per phase are named in the done tables. Every phase leaves at least one that fails if the fix regresses (repo rule: new logic gets a test).

Manual smoke on devices (there is no simulator here — needs a dev build on real hardware):

1. iPhone: Sign in with Apple (first time and again after "Hide my email"); receive a push with the app killed; tap it → lands on the right screen; badge count matches the tab.
2. Android: notification shows the app's icon, not a grey square; SMS code autofills.
3. Both: sign out on device A, send a message from device B → nothing arrives on A. Sign in as a different account on A → empty notification tab.
4. Both (Phase 2): sandbox purchase → `GET /api/users/me` returns `subscribed: true` within the webhook delay; "Restore purchases" on a reinstall.
5. Both: playdate range set to 5 mi → place picker respects it.

## Risks and open questions

- ~~Billing decision~~ RevenueCat, done. Not yet verified live: a sandbox purchase end to end, and the webhook against RevenueCat's real payloads (event names came from its docs, not a live delivery).
- Apple token revocation (1.4) needs a live Apple sign-in to test; can't be covered by jest beyond the branch logic.
- Phone auth on iOS relies on silent APNs — Phase 0's entitlement is a prerequisite, and the reCAPTCHA fallback needs the plist's `REVERSED_CLIENT_ID` URL scheme, which 0.2 adds for Google anyway.
- `handleSendMedia`'s request shape was not read during the audit; 6.4 starts by reading it.
- RNFB docs recommend `useFrameworks: "dynamic"` in their current Expo snippet; the repo has `static`. Not changed here — it builds — but flag it if a Phase 0 build fails on iOS.
- Library facts verified against Context7 today: RNFB messaging Expo config, RNFB Apple/Google credential APIs, `react-native-purchases` configure/logIn/entitlements. Not verified live: `expo-notifications` plugin option names (`icon`/`color`/`defaultChannel` — stable for several SDKs) and RevenueCat webhook event names (check the dashboard's sample payload when wiring 2.2).

## Deferred (real, not now)

- Universal links / App Links so notification deep links survive an uninstalled app; the `linking` config on `NavigationContainer`.
- Multi-device push (`fcmTokens: [String]` instead of one).
- "Add to calendar" on an accepted playdate (`expo-calendar`); share a pet profile (RN `Share`, needs links first).
- Email-verification enforcement as a session state — not a store requirement; the mail is still sent.

## Skills for implementation

Domain tags: iOS/Android platform config · Auth (Apple/Google/phone) · Billing/IAP · Push · UI (chat, phone auth, legal) · Security.

- Read during planning: `security-guidance` (runs automatically on Edit/Write/commit — will flag the webhook secret compare and the token-delete route), CLAUDE.md hard rules (identity from the token, one writer for `Subscription`, no app↔backend imports, `Alert` only for destructive confirmations, colours from tokens).
- Invoke per phase: `frontend-design` on Phases 3, 5.6 and 6 (auto-fires on UI work); `security-review` before merging Phases 2 and 4; `/code-review` on each PR.
- No installed skill covers RevenueCat/IAP or Sign in with Apple and no marketplace search tool is exposed in this session — run `/plugin` (Discover) for a RevenueCat skill if you want one before Phase 2; the plan does not depend on it.
- No installs performed.
