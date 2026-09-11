# Insurance slot — the care hub entry that shows nothing until a partner exists

Status: **built and verified** (2026-09-10) - boot-refusal cases proven in a
subprocess, hub suite 29/29. Decided with you 2026-09-10: plan the slot,
partner later. To switch on: set `INSURANCE_COMPARE_URL` and
`INSURANCE_PARTNER_NAME` together in `backend/.env`.

## Goal

Pet insurance is the largest evidenced revenue lane in the research (NAPHIA
2026: $5.68B GWP, 95%+ of US dogs and cats uninsured; Wag!'s insurance
comparison was its biggest segment). There is no partner yet. Build the place
it will live so switching it on is one env var, and so the disclosure rule the
care hub already has ("if a link is paid, the fact belongs on screen next to
it") is enforced by code rather than remembered.

## Architecture

- `backend/config/env.js`: `insurance: { enabled, url, partner }` from
  `INSURANCE_COMPARE_URL` and `INSURANCE_PARTNER_NAME`. Both or neither -
  `env.js` fails fast if only one is set, because a link with no named partner
  is exactly the undisclosed affiliate the hub refuses to be.
- `GET /api/petcare/picks` gains `insurance: { url, partner } | null`. Nothing
  else changes server-side.
- `MoreScreen`: a `Card` under the health shelf, rendered only when
  `insurance` is non-null: "Compare pet insurance" with the line
  "Opens {partner}. PetPals may be paid if you buy a policy." and
  `Linking.openURL`. Copy is the whole feature.
- No new model, no click tracking. Ponytail: if a partner wants attribution,
  it goes in the URL they give us.

## Todos

| # | Task | Status |
| --- | --- | --- |
| 1 | `env.js` insurance block with the both-or-neither check; `.env.example` | todo |
| 2 | `PetCareController.getPicks` returns `insurance` | todo |
| 3 | `api/petCare.js` + `api.ts` (`InsuranceOffer`); `MoreScreen` card with disclosure | todo |
| 4 | Tests: `env` both-or-neither (subprocess, like `contract.test.js` does for Firebase); `MoreScreen.test.js` renders nothing without it and the disclosure with it; gallery board | todo |

## Risks

- Store rules: an affiliate link out of the app is fine on both stores as long
  as it is not selling digital content. Insurance is not.
- The disclosure wording should be checked against the partner's affiliate
  terms when there is one - some require specific phrasing.
