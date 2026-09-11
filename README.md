# PetPalsConnect

A mobile app for pet owners: match pets with nearby pals, schedule playdates at
real locations, chat one-to-one or in groups, and manage subscriptions. Ships to
the Apple App Store and Google Play from one codebase.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Expo SDK 57, React Native 0.86, React 19 | One codebase, both stores, managed native builds |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) | Native screen performance |
| State | Redux Toolkit + React Redux | Already the app's model; RTK removes the boilerplate |
| Styling | twrnc (Tailwind classes for RN) | Matches the existing `tailwind("...")` call style |
| Auth | Firebase Auth (React Native Firebase) | Free tier, email/phone/Google, and it issues the API's tokens |
| API | Express 5 on Node 22 | Plain, cheap to host anywhere |
| Database | MongoDB (Atlas M0 free tier works) | Single source of truth for all app data |
| Push | Firebase Cloud Messaging | Free, works on both platforms |
| Jobs | MongoDB-backed scheduler (`node-cron`) | Avoids paying for a Redis instance |
| Builds | EAS Build + Continuous Native Generation | `ios/` and `android/` are generated, never hand-edited |

**One database.** Data lives in MongoDB behind the API. Firebase is used only
for authentication, push, and file storage. The app previously kept overlapping
copies in Realm and Firestore as well; both are gone.

## Repository layout

```
PetPalsConnectApp/    Expo app
  src/screens/        Screens, grouped by feature
  src/screens/navigation/   RootNavigator -> AuthStack | AppStack -> BottomTab
  src/api/axios.js    API client; attaches the Firebase ID token
  src/services/       Local cache helpers
  src/redux/          Store, actions, reducers
backend/              Express API
  controllers/        Route handlers
  models/             Mongoose schemas
  routes/             Route definitions (all mounted behind auth)
  services/           Scheduler and notifications
data-fetch-scripts/   One-off scripts for seeding location data and articles
content/              Editorial content for the in-app Articles feature
  research/           The verified claims, with citations
  articles/           The finished articles, as seed-ready JSON
```

## Getting started

Requires **Node 22.13+**.

### 1. Backend

```bash
cd backend
cp .env.example .env      # fill in MONGODB_URI and the FIREBASE_* values
npm install
npm run dev
```

Check it: `curl http://localhost:4000/health`

```json
{ "status": "ok", "database": "connected", "firebase": "configured" }
```

### 2. App

```bash
cd PetPalsConnectApp
cp .env.example .env      # set EXPO_PUBLIC_API_URL
npm install
```

Add your Firebase client config files to `PetPalsConnectApp/`:

- `google-services.json` (Firebase console → Project settings → Android app)
- `GoogleService-Info.plist` (→ iOS app)

Both are gitignored. For EAS builds, upload them as file-type secrets.

Because the app uses React Native Firebase, it needs a **development build** —
it will not run in Expo Go:

```bash
npx expo run:ios       # or: npx expo run:android
```

## Migrations

Conversations moved from being keyed by the pair of owners to the pair of pets,
and friendships gained the two animals they are about. Existing data needs
backfilling once:

```bash
cd backend
node scripts/migrate-to-pets.js --dry-run   # prints what it would change
node scripts/migrate-to-pets.js
```

It is idempotent and skips rows that already carry their pets. A conversation
whose pets cannot be resolved is left exactly as it is rather than given a
wrong key.

`backend/test/migration.test.js` runs the script for real against seeded
legacy-shaped data and checks the properties that matter: the new key is the
one `findOrCreateChat` will compute (so a migrated thread is reused rather than
stranded beside a new empty one), messages and participants are untouched, a
second run changes nothing, and `--dry-run` writes nothing.

## Content

The in-app Articles feature is backed by `content/`. `content/research/` holds
the verified material — claims, numbers and the source each came from —
and `content/articles/articles.json` is the batch built from it: 60 articles,
~49,000 words, 224 citations, covering dogs, cats, rabbits, guinea pigs, birds,
reptiles and fish — from playdate mechanics and preventive health through to
cognitive decline, quality-of-life assessment and grief.

In the app they are browsable by topic: `/api/articles/topics` derives the
index from the tags the corpus carries, `/latest` pages and filters, and each
article ends with further reading ranked by shared tags.

`content/research/standards.md` is the sourcing and editorial policy, and
`content/research/topics.md` maps every article to the app feature it supports
and lists the researched backlog.

```bash
# Validate the corpus. No database, no dependencies, no network.
node data-fetch-scripts/articles/seedArticles.js --dry-run

# Seed it. Idempotent - upserts on `slug`, so re-run after any edit.
# Reads MONGODB_URI from the environment or backend/.env.
node data-fetch-scripts/articles/seedArticles.js

# ...and remove seeded articles whose slug has left the JSON.
node data-fetch-scripts/articles/seedArticles.js --prune
```

Health content describes published veterinary guidance and never prescribes.
Every article carries its sources, which the app renders, and a
`lastReviewedDate` recording when a human last checked its claims. Vaccination,
parasite and toxicology guidance should be re-checked annually.

## Store builds

`ios/` and `android/` are generated by `npx expo prebuild` and are not committed.
Configure the app through `app.json`, never by editing native files.

```bash
eas build --profile production --platform all
eas submit --profile production --platform all
```

Both stores use the bundle identifier `com.petpalsconnect.app`.

## Before you can ship

- [ ] **Rotate the credentials that were committed to this public repo** — the
      MongoDB URI, the Google Cloud service-account key, the Maps API key and
      the Redis password are all in git history. See "Security" below.
- [ ] Register `com.petpalsconnect.app` in App Store Connect and Play Console
- [ ] Create an EAS project (`eas init`) and set the real `extra.eas.projectId`
- [ ] Add the two Firebase config files as EAS secrets
- [ ] Deploy the Storage rules: `firebase deploy --only storage` (they live in
      `storage.rules` and are wired in `PetPalsConnectApp/firebase.json`)
- [ ] Restrict the Google Maps API key by platform and API
- [ ] Fill in Apple privacy nutrition labels and Play data-safety declarations
- [ ] RevenueCat: create the project, a `premium` entitlement, one
      auto-renewing product per store attached to the current offering, and
      set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- [ ] Add the RevenueCat webhook (`/api/revenuecat-webhooks`) with an
      Authorization header, and set `REVENUECAT_WEBHOOK_SECRET` to the same value
- [ ] Enable the Apple sign-in provider in Firebase Authentication and the
      Sign in with Apple capability on the app id
- [ ] Enable the Google provider in Firebase Authentication and re-download
      `GoogleService-Info.plist` so it carries `REVERSED_CLIENT_ID` - without it
      `app.config.js` leaves Google Sign-In off on iOS
- [ ] Repo settings > Pages > deploy from `main` `/docs`, so
      https://lewybagz.github.io/PetPalsConnect/privacy.html, `terms.html` and
      `delete-account.html` resolve; both store listings cite them and
      `src/config/legal.ts` opens them
- [ ] Fill the `[STATE]`, `[MAILING ADDRESS]`, `[TITLE]`, `[AGENT NAME]`,
      `[DATABASE HOST]` and `[SERVER HOST]` placeholders in `docs/terms.html`
      and `docs/privacy.html`, then have both reviewed by a lawyer
- [ ] Register a DMCA designated agent with the US Copyright Office
      (dmca.copyright.gov, $6, renew every three years) and put the name in
      `docs/terms.html` section 9
- [ ] App Store Connect: paste https://lewybagz.github.io/PetPalsConnect/terms.html
      as the custom EULA and privacy.html as the privacy policy URL; privacy
      nutrition labels: Contact Info (email/phone), User Content (photos,
      messages), Identifiers (user id), Location (precise, app functionality),
      Purchases - none used for tracking
- [ ] Play Console: privacy policy URL, Data safety form matching
      `docs/privacy.html` section 2, and `delete-account.html` as the account
      deletion URL
- [ ] Set `FIREBASE_STORAGE_BUCKET` in backend `.env` if the project is not on
      `<project-id>.firebasestorage.app`, so account deletion can empty the
      account's photo folders

## Security

Credentials were committed to this repository while it was public. Removing the
files does not remove them from history — **every one of those secrets must be
rotated**:

- MongoDB Atlas database user password
- Firebase / Google Cloud service-account key (delete the key in IAM, generate a new one)
- Google Maps API key
- Redis password (no longer used, but rotate anyway)

Server-side secrets belong in `backend/.env`. Anything named `EXPO_PUBLIC_*` is
compiled into the app bundle and is public by definition — never put a secret there.

## Tests

```bash
cd backend && npm test               # 511 tests, ~40s, no database or credentials needed
cd PetPalsConnectApp && npm test     # 555 tests, ~10s
```

The suite boots the real Express app against an in-memory MongoDB with a stubbed
Firebase Admin, so everything except those two boundaries is the production code
path. `backend/test/contract.test.js` additionally compares the app's API calls
against the backend's declared routes, which catches the "compiles fine, 404s at
runtime" class of bug.

CI runs lint, the backend suite, and an `expo export` for both platforms on
every pull request.

## How signing up works

Onboarding is driven by the session status, not by screens navigating to each
other:

```
signedOut  ->  needsProfile  ->  needsPet  ->  ready
 AuthStack    CreateProfile     AddFirstPet    AppStack
```

1. `RegisterScreen` (or Google sign-in) creates the **Firebase account** only.
2. Firebase auth state changes, so `RootNavigator` re-evaluates the session.
3. No Mongo profile yet -> `needsProfile`. `CreateProfileScreen` collects a
   username (availability checked as you type) and calls `POST /api/users`,
   which derives identity from the verified token.
4. Profile but no pets -> `needsPet`. `AddFirstPetScreen` asks for a name,
   breed, age and weight, and `POST /api/pets` links the pet to the profile.
   This step can be **skipped** — the choice is remembered per user, so it is
   not re-asked on every launch, and adding a pet later clears it.
5. `ready` — the app tree mounts.

Those three writes cannot be made atomic, which is the point of modelling them
as states: if the app crashes or the network drops partway, the next launch
resumes at whichever step is still outstanding rather than dropping the user
into an app where every request 404s. `POST /api/users` is idempotent for the
same reason.

Because the pet step is skippable, reaching the app does **not** guarantee a
pet. Screens that cannot work without one (matching, playdate scheduling,
starting a chat) are wrapped in `withRequiredPet` where they are registered,
which shows one consistent "add a pet" prompt rather than each screen growing
its own empty state.

Once the app tree mounts, Home, More and Favourites each introduce themselves
once with a short guided tour — a dimmed screen, a ring around the thing being
described, and a sentence about it. Each is remembered separately, so a tour
plays on a first visit to its own screen and never again unless Settings ->
**Show the App Tour Again** forgets them.

Accounts can be deleted from Settings, which removes the Mongo profile and the
Firebase credential. Apple requires this of any app offering account creation.

## Known gaps

- Facebook login was removed; Google and email/phone remain
- Subscriptions are store purchases through RevenueCat; there is no card
  entry in the app and no Stripe
- The app is part TypeScript and part JavaScript, converting a module at a
  time; `checkJs` is off, so unconverted files are not typechecked. The backend
  is plain CommonJS JavaScript
