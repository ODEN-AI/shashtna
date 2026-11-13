# The owner's playbook («دليل الحلول»)

Phase 5, the AI customer agent. The playbook is the **only approved source** of what the agent tells customers:
problems and their fixes, FAQ answers, how to pay, policies and rules, devices and apps. The owner writes it in
Admin → Engagement → «دليل الحلول» (`/admin/playbook`).

## Plan this belongs to (owner-approved 2026-11-13)

The owner wants an AI agent that answers customers fully on his behalf, solves their problems from his playbook,
checks transfer proofs and tells him when a subscription is ready to activate. Phases:

| Phase | What | Status |
|---|---|---|
| A | The playbook: table, admin page, `playbook_search` tool for the agent | 🔄 this change |
| B | Site chat (website and My Shashtna): the agent answers from the playbook, follows orders, reads the transfer screenshot, alerts the owner | ⏳ |
| C | WhatsApp (WhatsApp Business API number from Meta) | ⏳ |
| D | Telegram and Instagram | ⏳ |

Rules agreed for all phases:

- Customers pay by **bank or card transfer** and send a **screenshot**. A screenshot can be faked, so the agent
  only *pre-checks* it: the amount matches the order, the receiving account is the owner's, the date is today, and
  the reference has not been used before. Then it alerts the owner: "order #… paid … per the screenshot, check
  your bank and activate". **Activation stays the owner's**, after checking the bank app.
- When the agent can't solve something (an angry customer, a problem not in the playbook, a refund request), it
  tries once and then **hands over** to the owner with the whole conversation.
- Every conversation is stored; the owner can read and take over at any time.

This replaces the earlier phase-4 rule "customers are never messaged automatically; payment confirmation is
never automated" for this agent only: the agent may answer customers itself, and it may pre-check a payment, but
it still never activates, confirms payment by itself, refunds or changes prices.

## Data

Table `playbookEntry` (migration `20261112T2336_playbook`, additive): `kind` (PROBLEM | FAQ | PAYMENT | POLICY |
DEVICE), `service` (ALL | IPTV | VIP | DIGITAL), `title`, `keywords` (comma list of the words customers use),
`content` (the fix or answer, written the way the agent should explain it), `isActive`, `sortOrder`, `updatedBy`,
timestamps. Entries are never deleted: switch them off to hide them from the agent.

## Code

| File | Holds |
|---|---|
| `src/lib/playbook.ts` | Kinds, services, limits, `checkPlaybookEntry` (server validation), `parseKeywords`, Arabic-aware `normalizeForMatch`, `searchPlaybook` (keywords > title > content; service keeps its own and ALL entries; disabled never returned) — `tests/playbook.test.ts` |
| `src/server/playbook.ts` | `listPlaybook`, `findPlaybook`, `savePlaybookEntry` (owner/admin only, audited `PLAYBOOK_CREATED` / `PLAYBOOK_UPDATED`) |
| `app/admin/playbook/*` | The page: support can read it; owner/admin can add and edit |
| `src/server/ai-core.ts` | Tool `playbook_search` (permission `support`, AGGREGATE): the customer agent searches it first; with no match it must not improvise a fix |
| `scripts/integration/playbook.mts` | Local-database check |

## Deploy order

The code reads `playbookEntry`, so **migration `20261112T2336_playbook` must be applied to production before this
code is published** (owner approval needed). Without it the playbook page and the agent's `playbook_search` fail.
