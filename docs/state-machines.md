# State machines

Explicit models for lifecycles that used to be scattered booleans, status strings, and null checks. The source of truth is `lib/state`. Illegal transitions return the current state with `ok: false` instead of inventing a new one.

Stored values are unchanged. Readers accept the old spellings. Writers still save the same strings the screens already saved.

## How a machine is shaped

`defineMachine` in `lib/state/machine.ts` takes an id, a state list, an event list, and a transition table. `can`, `transition`, `eventsFrom`, and `successors` are the only ways to move. `formatTransitionTable` prints the edges.

Async UI uses a different shape, because the interesting part is which fields exist:

| Phase | Carries |
| --- | --- |
| `idle` | nothing |
| `loading` | optional previous data |
| `ready` | data |
| `error` | message, optional previous data |

`reduceAsync` ignores a success or failure that arrives when nothing is loading. `reduceMutation` is the one-shot version (`idle → pending → success | error`). `reduceConfirm` is the two-step version (`idle → armed → submitting`); cancel during submit does nothing.

## Property status

**Where:** `lib/state/property.ts`, stock board, property page, property cards, dashboard, project counts, group delete.

**Stored states:** `available`, `hold`, `reserved`, `under_contract`, `finance_approved`, `sold`, `withdrawn`.

The board labels differ from the column names: `hold` is shown as Reserved, `reserved` as Expression of Interest.

**Hold is two states that share one column.** `describeProperty` distinguishes them:

| Stored | `hold_expires_at` | Lifecycle |
| --- | --- | --- |
| `hold` | null | pending HQ approval |
| `hold` | timestamp | countdown running |
| anything else | ignored | that status |

**Board moves** (`resolveStockMove`) choose the RPC. Any board column can still be dropped on any other column, which matches the permissive SQL setter.

| To | From | Command |
| --- | --- | --- |
| same column | same | no-op |
| `available` | any other | `set_property_status(available)` |
| `sold` | `available`, `hold`, `reserved` | `mark_sold` |
| `sold` | any other known status | `mark_sold`, then `set_property_status(sold)` |
| `hold` | `available` | `request_hold` |
| `hold` | any other | `set_property_status(hold)` |
| `reserved` | any other | `request_reservation` |
| `under_contract` | `available` | `reserve_property(reservation)`, then `set_property_status(under_contract)` |
| `under_contract` | any other | `set_property_status(under_contract)` |
| `finance_approved` | any other | `set_property_status(finance_approved)` |
| anything else | any | refused |

A failed move puts the card back immediately. Withdrawn and unknown lots are listed under the board instead of vanishing.

`RELEASE_ON_GROUP_DELETE` is `hold`, `reserved`, `under_contract`, `finance_approved`. Deleting a group frees those lots. Sold and withdrawn stay as they are.

## Reservation

**Where:** `lib/state/reservation.ts`, reservations page.

| From | Event | To |
| --- | --- | --- |
| `pending` | approve | `active` |
| `pending` | reject | `rejected` |
| `active` | expire | `expired` |
| `active` | release | `released` |
| `active` | convert | `converted` |
| `active` | cancel | `cancelled` |
| `rejected`, `expired`, `released`, `converted`, `cancelled` | — | terminal |

`reservationActions` is what the screen is allowed to show: release on `active`, approve/reject for HQ on `pending`. Everyone still sees "awaiting approval" on a pending row.

`res_type` is `hold` or `reservation`. A hold claims the lot as `hold`; a reservation claims it as `reserved`.

Rows are created as `active` (auto-approved or HQ) or `pending` (group is inside the cooldown). Both are entry states.

## Sale

**Where:** `lib/state/sale.ts` only. Nothing in the UI reads `sales.status` yet.

| From | Event | To |
| --- | --- | --- |
| `pending` | exchange | `exchanged` |
| `pending` | fall_through | `fallen_through` |
| `exchanged` | settle | `settled` |
| `exchanged` | fall_through | `fallen_through` |
| `settled`, `fallen_through` | — | terminal |

`mark_sold` inserts the row as `pending`.

## Lead stage and lead status

**Where:** `lib/state/lead.ts`, pipeline board, lead detail, daily cron, daily queue, dashboard metrics, analytics.

These are two fields that grew separate vocabularies.

### `stage` (the board)

| Id | Stored label on the board | Also recognised |
| --- | --- | --- |
| `new` | New | `new`, `enquiry` |
| `contacted` | Contacted | `contacted` |
| `qualified` | Qualified | `qualified` |
| `pack_sent` | Pack Sent | `pack_sent` |
| `contract_signed` | Contract Signed | `contract`, `contract_signed` |
| `settlement` | Settlement | `settled` |
| `won` | Won (not a column) | `won`, `closed` |
| `lost` | Lost (not a column) | `lost` |

Empty stage displays as New. Won, Lost, and unknown strings are listed above the board with a link to the lead. Dropping a card writes the column label. Dropping it on the column it is already in (including a snake_case alias) does not write and does not notify.

The board allows every column-to-column jump. That is `leadPipelineMachine`.

### `status` (metrics and analytics)

Pipeline statuses, in order: `enquiry → qualified → pack_sent → contract → settled`.

`leadStatusStamps` sets `pack_sent_date`, `contract_signed_date`, or `settlement_date`. Other statuses, including title-case stage labels, update `status` only. That matches the previous route.

Legacy analytics statuses, matched exactly: `new`, `contacted`, `assigned`, `closed`.

Dashboard buckets prefer `status`. If `status` is empty, a recognised `stage` is counted (`New` → enquiry, `Pack Sent` → pack_sent, and so on). `assigned`, Won, and Lost are not forced into a bucket.

## Freshness

**Where:** `lib/state/freshness.ts`, stale-deals route, daily cron, daily queue.

| Age | Freshness |
| --- | --- |
| no timestamp | `unknown` |
| 0–3 days | `fresh` |
| 4–7 days | `warm` |
| 8–14 days | `stale` |
| 15+ days | `critical` |

The cron and the queue still treat a missing timestamp as 999 days, so those jobs keep flagging untouched leads. An unparseable timestamp does not match any threshold.

Queue points: 15+ days → 100, 8+ → 60, 4+ → 30, plus 40 for pack sent and 20 for qualified, in either spelling. Suggested action follows the same stage match.

Reminders: pack sent and 2+ days → follow up; qualified and 1+ day → call; 8+ days → urgent.

## Auth and password

**Where:** `lib/state/auth.ts`, `lib/state/async.ts`, `lib/auth.tsx`, `lib/useSession.ts`, login, forgot-password, set-password.

| Phase | Meaning |
| --- | --- |
| `loading` | session or profile not settled |
| `anonymous` | settled, no user |
| `signed_in` | settled, user present |

`loading` wins over "has a user", so a half-loaded session is not treated as signed in. Profile fields are applied only for the latest session. A token refresh for the same user does not blank the screen. A slower `getSession` is ignored once the auth listener has spoken.

Roles: `hq_admin`, `group_admin`, `agent`. Org types: `hq`, `selling_group`.

Password reset is a mutation: the form, then pending, then the sent confirmation. Set-password is `checking → ready | missing`, and the save button stays disabled until the invite link has a session.

Deleting a selling group uses confirm: armed, then submitting. Cancel is disabled while the delete is in flight.

## Document destination

**Where:** `lib/state/document.ts`, admin documents form.

`general` needs no id. `project` needs a project. `property` needs a property. An id for a destination you did not pick is ignored.

## Deferred

These are real machines. Changing them in this pass was riskier than modelling them.

**SQL status setter.** `set_property_status` is redefined by `under_contract.sql`, `finance_approved.sql`, and `release_cooldown.sql`, and those copies disagree. The finance-approved copy accepts `finance_approved`. The release-cooldown copy rejects it. `mark_sold` only updates `available`, `hold`, and `reserved`, which is why the board now follows a failed match with `set_property_status(sold)`. Recommended next step: one migration that is the only definition of `set_property_status` and `mark_sold`, allowing the edges in `resolveStockMove`, including finance approved and under contract through to sold. Do not ship that until it is applied in Supabase. The repo SQL is not what production is guaranteed to be running.

**`request_reservation`, `approve_request`, `reject_request`.** The client calls these. The repo defines `request_hold`, `approve_hold`, and `reject_hold`, not the names the UI uses. Renaming the calls would break production if the database has the UI names. Recommended: add the missing functions as wrappers, or point the UI at the functions that actually exist, after checking the live database.

**Do not merge `useSession`, `app/providers.tsx`, and `useAuth`.** They read two different Supabase clients. `providers.tsx` starts as `null`, which looks signed out until the first callback. Nothing in the app currently calls that hook. Folding them together can sign people out. Recommended: one provider, listener only, phase from `deriveAuthPhase`.

**Per-row admin mutations.** The group page still has separate booleans for invites, logo upload, email edits, and member removal. Each is a `MutationPhase`, but they are independent and the page is large. Member removal is the same confirm machine as group delete (`confirmDelMemberId` plus `deletingMemberId` can disagree). Recommended: one confirm phase per member id.

**Visibility menu.** Open, busy, and the hidden-set are a popover, not a domain lifecycle.

**Property document form.** Saving, file, and link are a mutation plus optional inputs. The admin destination picker is the part that was ambiguous, and that one is modelled.

**Sale transitions are not enforced in the database.** The check constraint allows any of the four statuses. Wire `saleMachine` when a sale screen is built; until then a direct update can still skip `exchanged`.

**Lead strings are not migrated.** `pack_sent` and `Pack Sent` both read as the same stage. A later backfill can rewrite aliases to the board label once every reader uses `normalizeLeadStage`.
