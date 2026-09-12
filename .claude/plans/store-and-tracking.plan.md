# The shop and the tracking collar

Status: **planned**. Written 2026-09-11 against `main` @ `b37f9b4`.
Scope decided with Lewy: Stripe Checkout + 3PL, catalog as a source table (admin
portal planned, not built), the collar's software half built now behind a vendor
adapter, everything in one pass on one branch as sequenced commits.

## Why this is two features, not one

A shop selling physical goods and a GPS collar reporting live positions share a
branch and nothing else. They are planned together because one product - the
collar - is sold by the first and tracked by the second, and kept apart in the
code because their failure modes are not comparable: a broken checkout loses a
sale, a broken location rule is a safety incident.

## The policy constraint that shapes everything

**Physical goods must not use IAP, and digital content must.** Apple 3.1.1 and
Play's payments policy require IAP for anything unlocking in-app content - that
is why `subscribed` moved to RevenueCat. Apple 3.1.3(e) and Play's physical-goods
exemption require the *opposite* for shipped merchandise: a normal payment
processor, and Apple explicitly permits opening a browser for it.

So the repo carries two processors on purpose, and the rule is one line:

> **RevenueCat sells entitlements. Stripe sells objects that ship. Neither ever
> sells the other's kind of thing.**

A store product must never grant an entitlement, or it becomes digital content
sold outside IAP - a rejection on both stores. `products.js` has no
`entitlement` field for exactly this reason, and `store.test.js` asserts the
catalog cannot grant one.

This also means **Stripe returns to the repo** after Phase 2 of
`store-readiness` removed it. It returns as a backend dependency only: there is
no `@stripe/stripe-react-native`, no card form, no PCI scope. The app opens a
Stripe-hosted Checkout URL.

## Architecture decisions

### 1. Checkout is a hosted URL, not an in-app sheet

`POST /api/store/checkout` creates a Stripe Checkout Session server-side and
returns its `url`; the app opens it with `Linking.openURL`. Stripe's own page
collects the card, the shipping address and the tax, which keeps three things
out of this repo: card data, an address form, and US sales-tax calculation.

`automatic_tax: { enabled: true }` and `shipping_address_collection` do the work
`Stripe Tax` and the address form would otherwise be. Shipping rates are Stripe
`shipping_rate` objects named in `shipping_options`, so a rate change is a
dashboard edit, not a deploy.

Return is a deep link back into the app (`petpals://store/order/{sessionId}`),
and the success screen says **"we are confirming your order"** rather than
"paid": the same rule the subscription confirmation already follows, because the
webhook lands a moment after the redirect and the redirect is not proof of
payment.

### 2. `Order` is written by the webhook and nothing else

Exactly `services/subscriptions/revenuecat.js`, one domain over:
`services/store/stripeOrders.syncFromEvent` is the only writer of `Order`.
Stripe is the source of truth for money; Mongo mirrors it. A status the app
invents and a status Stripe holds will drift, and Stripe is the one with the
money.

- Mounted **before** `express.json()`, not merely before `authenticate`.
  `constructEvent` verifies a signature over the **raw bytes**, so the route
  needs `express.raw({ type: "application/json" })`. The RevenueCat webhook did
  not care - it authenticates by a header and reads a parsed body - so copying
  its mount position exactly would produce a signature that never verifies.
  `sanitize` also strips `$`-prefixed keys, which would corrupt the raw body.
- Idempotent on `paymentIntentId`, so Stripe's retries land on one row.
- Every acknowledged event answers 200, including unknown types: Stripe retries
  non-2xx for days.
- No `REVENUECAT_*`-style secret sharing - `STRIPE_WEBHOOK_SECRET` is its own,
  and unset means the route answers 503, the same "payments are optional"
  rule the app already follows.

Events handled: `checkout.session.completed` (the order exists and is paid),
`checkout.session.async_payment_failed`, `charge.refunded`,
`charge.dispute.created`. Fulfilment status comes from the 3PL, not Stripe.

### 3. The catalog is a source table, with a portal-shaped seam

`services/store/products.js`, on the same reasoning `picks.js`, `emergency.js`,
`notificationTypes.js` and `reportStates.js` are tables: 10-20 SKUs, no admin
console in this repo, and a price change ought to be a reviewed diff.

**Stripe holds the authoritative price.** The table holds copy, photos,
category, and a `stripePriceId` per variant; `checkout` never takes a price from
the client or from the table. A client-supplied price is the oldest e-commerce
hole there is, and `store.test.js` asserts the checkout call passes only
`price` ids and quantities.

The portal seam: every read goes through `listProducts()` / `findVariant()` in
one module. Moving the catalog to Mongo later is a change inside those two
functions plus a migration - not a change at each call site. That is the whole
provision being made now; the portal itself is out of scope and planned below.

### 4. The collar: one adapter, and no vendor chosen

The software half is built now. The vendor boundary is
`services/tracking/vendor/` with one module per vendor and a two-function
contract (`positionsFor(deviceIds)`, `verifyWebhook(req)`), selected by
`TRACKING_VENDOR`. Shipped implementations:

- `simulator.js` - a deterministic walk around a fixed origin, so the feature
  can be developed, tested and screenshotted with no hardware and no account.
- `generic.js` - HTTP ingest: the device (or the vendor's cloud) POSTs positions
  to `POST /api/tracking/ingest` with a per-device shared secret.

A real OEM is then a third file. What is deliberately **not** built is a
protocol guess: no MQTT client, no LoRa decoder, no BLE pairing flow, because
each is a bet on hardware that does not exist. `generic.js` is HTTP because
every vendor cloud speaks it.

### 5. Live location is the dangerous half, and it inverts an existing rule

The app's existing rule is that another user gets the neighbourhood, never the
door: `/api/petmatches/map` rounds to ~0.01deg and `map.test.js` asserts the
exact coordinate never leaves the server. **Live tracking is the exact
opposite** - an owner looking for a lost dog needs metres, not kilometres.

The two coexist because they answer different questions, and the rule is who is
asking:

| Viewer | Precision | Where |
| --- | --- | --- |
| The pet's owner | Exact | `GET /api/tracking/pets/:petId/positions` |
| A friend the owner explicitly shared this pet with | Exact, while the share is live | same route, `canView` |
| Anybody else, incl. matches on the discovery map | Coarse ~1 km, as today | `/api/petmatches/map`, unchanged |

`services/tracking/visibility.js` is the one place that answers "may this
account see this pet's live position", the way `blocking.js` and `audience.js`
are single places for their questions. Every position read goes through it.

Sharing is **per pet, per friend, and expiring**: `TrackingShare` carries
`expiresAt`, defaulting to 24h, because "share my dog's live location with Alex"
is almost always about right now, and a share with no end is a share nobody ever
revokes. A block revokes it instantly - `visibility.js` consults
`blocking.blockedIdsFor` first, since sharing a live position with somebody you
have since blocked is the worst version of this bug.

`DevicePosition` is capped by a TTL index (`RETENTION_DAYS`, 30): a location
history is the most sensitive data this app would ever hold, and the honest
amount to keep is the least that makes the feature work.

### 6. Deletion and retention

`accountDeletion.test.js` fails on any new `ref: "User"` model that is neither
cascaded nor in `RETAINED`, so all three new models must choose:

| Model | On account deletion | Why |
| --- | --- | --- |
| `Device`, `DevicePosition`, `TrackingShare` | **Cascaded** | Location data has no reason to outlive the account. |
| `Order` | **RETAINED** | A paid order is a financial and tax record (IRS 6-year window, state sales-tax audits). Kept with the account id as an opaque reference, like `Report`. |

`services/retention.js` gains orders at 7 years, and **the privacy policy's
retention table has to be updated in the same commit** - it is written from
`RETAINED` and would otherwise be false the moment this ships.

## Phases

One branch, `feat/store-and-tracking`. Sequenced commits so the location work is
reviewable on its own; the branch is not merged until every phase is green.

### Phase 1 - the shop, backend

New: `models/Order.js`, `services/store/products.js`, `services/store/checkout.js`,
`services/store/stripeOrders.js`, `controllers/StoreController.js`,
`routes/store.js`, `routes/stripeWebhooks.js`, `test/store.test.js`.
Touched: `Server.js`, `config/env.js`, `services/authAudit.js`,
`services/retention.js`, `services/accountDeletion.js`, `.env.example`.

| id | todo |
| --- | --- |
| 1.1 | `products.js`: the table + `listProducts()`/`findVariant()`. Every variant names a `stripePriceId`; no variant names an entitlement. |
| 1.2 | `Order.js`: `user`, `stripeSessionId`, `paymentIntentId` (unique), `items[]` snapshotted at purchase (name and price as charged - a later table edit must not rewrite history), `amountTotal`, `currency`, `status` (`pending`/`paid`/`fulfilled`/`refunded`/`disputed`/`failed`), `shipping` (name/address as Stripe collected it), `trackingNumber`, `carrier`. |
| 1.3 | `checkout.js`: builds the Session from variant ids + quantities only. `automatic_tax`, `shipping_address_collection`, `shipping_options`, `client_reference_id = user._id`, `metadata.userId`. Refuses an unknown variant and a quantity outside 1-10. |
| 1.4 | `stripeOrders.syncFromEvent`: the only writer. Upsert on `paymentIntentId`; the four event types; unknown -> 200. |
| 1.5 | `routes/stripeWebhooks.js` mounted in `Server.js` **above `express.json()`** with `express.raw`. Constant-time is `stripe.webhooks.constructEvent`'s job, not ours. |
| 1.6 | `routes/store.js` behind `authenticate`: `GET /products` (catalogue, -> `PUBLIC_READS` with a reason), `POST /checkout`, `GET /orders` (scoped to `req.userId`), `GET /orders/:id` (ownership-checked). |
| 1.7 | `env.js`: `stripe.secretKey` + `stripe.webhookSecret` together or the shop is off, the same both-or-neither shape as the insurance slot. |
| 1.8 | `accountDeletion.js`: `Order` into `RETAINED` with its reason; `retention.js` deletes paid orders after 7 years. |
| 1.9 | `test/store.test.js`: a client-supplied price is ignored; an unknown variant is a 400; the webhook rejects a bad signature, is idempotent on redelivery, and flips `status` on refund; `GET /orders` never returns another account's order; **no catalog entry grants an entitlement**. |

### Phase 2 - the shop, app

New: `src/api/store.ts`, `src/screens/store/ShopScreen.js`,
`ProductDetailScreen.js`, `OrdersScreen.js`, `OrderDetailScreen.js`,
their tests. Touched: `AppStack`, `MoreScreen` (`SHORTCUTS`), `types/api.ts`,
`app.json` (the `store` deep link), `navigation.test.js`.

| id | todo |
| --- | --- |
| 2.1 | `src/api/store.ts` (TS - it is a leaf API module, which is the conversion order CLAUDE.md gives), types added to `types/api.ts` so `types.test.js` checks them against the schema. |
| 2.2 | `ShopScreen`: `Card`/`Text`/`Screen`/`Skeleton` from `components/ui`, tokens only, no hex. A shop with no Stripe key configured is an `EmptyState`, not an error - "payments are optional everywhere". |
| 2.3 | `ProductDetailScreen`: variant picker via `SegmentedControl`, quantity, "Buy" -> `POST /checkout` -> `Linking.openURL`. |
| 2.4 | Deep link `petpals://store/order/:sessionId` -> `OrderDetailScreen`, which says "confirming your order" until the webhook lands. |
| 2.5 | `OrdersScreen` in the hub and in Settings; `EmptyState` when none. |
| 2.6 | Shop + Orders rows in `MoreScreen.SHORTCUTS` - the hub is where the pets-you-already-have half of the app lives, which is what merch is. Not a new bottom tab: 10-20 SKUs does not earn a fifth tab. |
| 2.7 | Order-status push on `fulfilled`, through `notify()` and a new `notificationTypes.js` entry (both copies, or `types.test.js` fails) whose destination is `OrderDetail`. |

### Phase 3 - the collar, backend

New: `models/Device.js`, `DevicePosition.js`, `TrackingShare.js`,
`services/tracking/visibility.js`, `positions.js`, `vendor/{index,simulator,generic}.js`,
`controllers/TrackingController.js`, `routes/tracking.js`, `test/tracking.test.js`.

| id | todo |
| --- | --- |
| 3.1 | `Device`: `owner`, `pet`, `serial` (unique), `vendor`, `ingestSecretHash`, `batteryPercent`, `lastSeenAt`, `status`. Claimed by serial after purchase; `owner` comes from `req.userId`, never the body. |
| 3.2 | `DevicePosition`: `device`, `pet`, `point` (GeoJSON sub-schema with `default: undefined` - the existing trap), `accuracyMeters`, `recordedAt`, TTL index at 30 days. |
| 3.3 | `TrackingShare`: `pet`, `owner`, `viewer`, `expiresAt` (TTL). Unique on `(pet, viewer)`. |
| 3.4 | `visibility.canView(viewerId, petId)`: owner, or a live non-expired share, **and** not blocked in either direction. The one place the question is answered. |
| 3.5 | `vendor/simulator.js` + `vendor/generic.js` behind `vendor/index.js` selected by `TRACKING_VENDOR`; unset -> tracking off, routes 503. |
| 3.6 | `POST /api/tracking/ingest` outside `authenticate` (a collar has no Firebase account), authenticated by the per-device secret compared in constant time, rate-limited per device. |
| 3.7 | Routes behind `authenticate`: claim a device, list my devices, `GET /pets/:petId/positions` (through `canView`), share/unshare, list shares. |
| 3.8 | `test/tracking.test.js`: a stranger gets 404 on positions; an **expired** share gets 404; a **blocked** friend with a live share gets 404; ingest with a wrong secret is 401; the TTL index exists; `/api/petmatches/map` is still coarse (the existing assertion must not regress). |

### Phase 4 - the collar, app

| id | todo |
| --- | --- |
| 4.1 | `src/api/tracking.ts`; live layer on `MapScreen` as a third toggle beside pets and places, polling while focused only (`useFocusEffect`), never in the background. |
| 4.2 | `PetTrackingScreen`: one pet, its position, battery, last-seen, and the share list. "Last seen 4 minutes ago" is stated on every view - a stale position presented as live is the failure mode that matters here. |
| 4.3 | Sharing UI: pick a friend, pick a duration, revoke. Copy says exactly what is shared and for how long. |
| 4.4 | Device claim flow from an order: `OrderDetailScreen` offers "set up your collar" when a delivered order contains one. |
| 4.5 | Tests: an expiring share renders its remaining time; no position renders an `EmptyState`, not a marker at 0,0 (the null-island bug every map feature ships once). |

### Phase 5 - gates and documents

| id | todo |
| --- | --- |
| 5.1 | `docs/privacy.html`: precise-location-while-shared, the 30-day position retention, the 7-year order retention, Stripe as a processor. **This is not optional** - the policy is written from `RETAINED` and would be false without it. |
| 5.2 | `docs/terms.html`: sale of goods, shipping, returns/refunds, and that the collar is not a safety device and must not be relied on for one. |
| 5.3 | Full verification sweep per CLAUDE.md: both packages' lint/typecheck/colour/test, `check:schemas`, `check:auth`, both exports, gallery + screenshots. |

## Planned, not built: the admin portal

Recorded here so the seam above has a stated destination.

The portal is a **separate web app**, not screens in the phone app: it needs
product photo upload, price edits, an order queue with fulfilment status, and a
refund button, and none of that belongs on a device an owner uses to walk their
dog. It also needs a real authorisation model - `MODERATOR_EMAILS` is an env
allowlist chosen precisely because it has no schema and nothing to escalate
into, and a store admin is a different question.

When it is built: `listProducts()`/`findVariant()` move to a Mongo-backed
implementation behind the same signatures, `Product` becomes a model with a
write path that the auth audit must cover, and the source table becomes the
seed. Until then a price change is a deploy, which at 10-20 SKUs is correct.

## Env vars and dashboard prerequisites

| Where | What |
| --- | --- |
| Stripe | secret key -> `STRIPE_SECRET_KEY`; a Product + Price per variant; `shipping_rate` objects; Stripe Tax enabled with a registered nexus (Arizona at minimum); webhook -> `STRIPE_WEBHOOK_SECRET` |
| 3PL / POD | Printful or Printify account, products mapped to the Stripe prices, the fulfilment webhook that flips an order to `fulfilled` |
| Tax | sales-tax registration wherever you have nexus. Stripe Tax calculates; it does not register or file for you. |
| Collar vendor | none chosen. `TRACKING_VENDOR=simulator` until one is. |
| App | `app.json` deep-link scheme for the checkout return |

## Things deliberately left out

- **No cart.** A cart is a persisted multi-item selection with its own model,
  merge rules and abandonment; Checkout accepts multiple line items directly, so
  the one screen builds them and hands them over. Add a cart when somebody
  actually buys three things at once.
- **No in-app card form.** A hosted URL is fewer files, no PCI scope, and the
  policy-sanctioned route for physical goods.
- **No click tracking or affiliate tags** - the care hub's existing rule.
- **No background location.** The collar reports its own position; the phone
  does not report the pet's. This keeps the app out of the
  background-location permission, which is a review conversation of its own.
- **No geofencing / "left the yard" alerts.** The obvious next feature, and it
  needs a real device's update cadence and accuracy to tune against. A false
  "your dog escaped" push at 3am is worse than no alert.
- **The collar is never described as a safety device.** No "keep your pet safe"
  copy anywhere; it is a locator that reports where a device last was.
