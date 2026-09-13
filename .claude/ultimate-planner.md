# PetPalsConnect - planner map

Hand-written map for `ultimate-planner`. Read this, then `CLAUDE.md` (the hard
rules and the reasoning behind every convention live there; this file only says
where things are and what to run). Update it when the layout changes.

## Three packages, no root package

| Package | What | Stack |
| --- | --- | --- |
| `PetPalsConnectApp/` | Expo app | Expo SDK 57, RN 0.86, React 19, mixed JS/TS, jest-expo + RNTL 14, `twrnc` bound to `src/styles/tokens.ts` |
| `backend/` | API | Express 5, CommonJS, Mongoose 9, socket.io, node-cron, `node --test` via `scripts/test.js` |
| `data-fetch-scripts/` | seeding | one-off, not a build |

Node 22.13+. The app and the backend never import each other; `backend/test/contract.test.js` enforces it.

## Where a feature touches

**Backend**
- Route registration: the `routes` map in `backend/Server.js` mounts `routes/<file>.js` at `/api/<key>` behind `authenticate` (+ a tighter limiter from `TIGHTER`). Webhooks (`stripeWebhooks`, `revenuecatWebhooks`) and `tracking/ingest` mount above that by hand.
- Controllers: `backend/controllers/*Controller.js`, object literals with method shorthand (the auth audit parses that shape). Identity is `req.userId`, always.
- Services: `backend/services/` - one file per rule (`blocking`, `audience`, `settings`, `vaccinations`, `regions`, `notificationTypes`, `reportStates`, `accountDeletion`, `retention`, `scheduler`, `realtime`, `photos`, `places`), plus folders `matching/`, `petCare/`, `store/`, `subscriptions/`, `tracking/`. Source tables (picks, emergency numbers, products, toxins) are code, not collections.
- Models: `backend/models/`. `Pet` is a discriminator of `Content`. Every owner-keyed model must appear in `services/accountDeletion.js` (cascade or `RETAINED`) - the test forces it.
- Optional integrations are read from env at call time and answer 503 when unset: Stripe, RevenueCat, Google Places, tracking vendor, insurance link. Follow that pattern for any new key.
- Settings: `services/settings.js` is the only place a setting can be written; `settingsEnforcement.test.js` requires each one to change an answer.
- Notifications: `services/NotificationService.notify()` only; types in `services/notificationTypes.js`, mirrored in the app and checked by `types.test.js`.
- Realtime: `services/realtime.emitToUser(userId, event, payload)`; rooms come from the token.

**App**
- Navigation: `src/screens/navigation/AppStack.js` (every non-tab screen, flat), `BottomTab.js` (six tabs), `RootNavigator.js` picks a tree from `AuthSessionContext` state. `withRequiredPet` wraps screens that need a pet.
- API client: `src/api/axios.ts` + one module per area in `src/api/`. Query strings go in `params`.
- UI kit: `src/components/ui/` (`Screen`, `Text`, `Button`, `Card`, `EmptyState`, `Skeleton`, `Toast`, settings rows, `SegmentedControl`). Feedback is `useToast()`; `Alert` only for destructive confirms (test-enforced).
- Design tokens: `src/styles/tokens.ts`; `useTailwind()` / `useTokens()`. `npm run check:colours` bans any colour outside tokens, including stock Tailwind colour classes and colourless text styles.
- State: redux (`src/redux/`), `store.test.js` checks every selector path. Contexts: `AuthSessionContext`, `SettingsContext`, `DevicePreferencesContext`, `AppThemeContext`.
- Types: `src/types/api.ts` is the one description of API payloads, checked field-by-field against Mongoose in `backend/test/types.test.js`.
- Gallery: `tools/gallery/boards.js` + `npm run gallery && npm run screenshots` renders real screens to `screenshots/`. Add a board for any new screen.

**Content**: `content/articles/articles.json`, `content/toxins/toxins.json`, `content/research/*.md` (sourcing policy in `standards.md`, exclusions in `topics.md`). Health copy never prescribes.

**Legal**: `docs/privacy.html`, `docs/terms.html` (GitHub Pages); `src/config/legal.ts` names them.

## Verification (run these, in this order)

```bash
cd backend && npm run lint && npm run check:schemas && npm run check:auth && npm test
cd PetPalsConnectApp && npm run lint && npm run typecheck && npm run check:colours && npm test
node data-fetch-scripts/articles/seedArticles.js --dry-run
cd PetPalsConnectApp && npm run gallery && npm run screenshots
npx expo export --platform android && npx expo export --platform ios
```

`node --test test/<file>.test.js` runs one backend file. CI: `.github/workflows/ci.yml`.

## Gotchas that have bitten plans before

- Contract test `:param` hole: a literal call segment matches a `:param` route, so a wrong path can pass. Declare static routes before `/:id`.
- Reachability: screens and endpoints get built and nothing navigates to them. Every plan names the entry point.
- `HomeScreen.test.js` "renders a pet by its schema fields" flakes on a clean HEAD; don't chase it inside another change.
- RNTL 14: `render` and `fireEvent` are async in this setup; await both.
- Another session may edit this tree concurrently: stage by path, never `git add <dir>`; re-read shared files before editing.
- `__`-prefixed files under `src/` are scratch and skipped by every source walker.
- Windows: `path.relative` gives backslashes; anything keyed by a reported path normalises to POSIX.

## Prior plans

`.claude/plans/*.plan.md`, one per feature, each recording the decisions made with Lewy and the commit hashes once built. Read the nearest one before planning next to it.

## Standing rules from Lewy

- Ponytail full: smallest correct implementation, `ponytail:` comments on deliberate ceilings.
- New logic gets a test; bug fixes start with a failing test.
- Never assign to AI what software can do; software may wear the assistant's voice.
- One confident recommendation, not an options menu; state assumptions and proceed.
