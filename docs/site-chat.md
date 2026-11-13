# Site chat with the AI customer agent («مساعد شاشتنا»)

Phase 5, customer agent **phase B** (plan and rules: `docs/playbook.md`). A signed-in customer chats with the agent
in My Shashtna → Support → «اسأل المساعد» (`/support/chat`). The agent replies to the customer itself, from the
owner's playbook, the customer's own services and orders, and the public help centre. When it can't help, it hands
the conversation to the team (Admin → Engagement → «المحادثات», `/admin/chats`) and stays silent until the team
hands it back.

## Switch

`ai.chat.enabled` (Admin → Settings → AI assistants), **off by default**, owner only and audited (setting group
`ai`). It also needs `ANTHROPIC_API_KEY`. While off, the page tells customers to open a ticket and stores nothing.
Fill the playbook before switching it on: with an empty playbook the agent hands most chats over.

## What the agent can and can't do

| | |
|---|---|
| Reads | `my_services`: this customer's subscriptions (service, package, state, dates, days left) and latest orders (number, type, status, service, stored price). Whitelisted fields: never usernames, passwords, account e-mail, MAC, device id, payment reference, proofs or notes. `playbook_search` (searched first), `help_articles` |
| Writes | `hand_over` only: sets the chat to HANDOVER with a reason and a one-line note for the team |
| Never | Activates, confirms a payment, refunds, discounts, changes anything, quotes a price other than the customer's own order or the playbook, asks for passwords or card numbers, talks about other customers |
| Hands over when | Not in the playbook (after one clarifying question); the customer asks for a person; is still unhappy; asks for a refund or to cancel; says they paid or asks to activate (PAYMENT, with the waiting order's number); the model fails (OTHER, with an apology); 25 agent replies to this customer today (LIMIT, without a model call) |

Isolation: the tools are bound on the server to the conversation's customer (`customerTools(userId, …)`); nothing
in a message can point them at another customer. Customer text is masked (phones, e-mails) before it reaches the
model; tool results are masked and capped by the AI core (`maskForModel`, `toolResultText`). Staff can't chat as
customers.

## Data

Migration `20261113T1126_site_chat` (additive): `chatConversation` (`userId`, `status` AI | HANDOVER | CLOSED,
`lastSender`, `handoverReason`, `handoverNote`, `handedOverAt`, `closedAt`, timestamps) and `chatMessage`
(`conversationId`, `sender` CUSTOMER | AI | STAFF, `body`, `staffId`, `createdAt`). One open conversation per
customer; «محادثة جديدة» closes it.

## Audit

`CHAT_AI_REPLY` / `CHAT_HANDOVER` (actor: the customer): tool names, outcome, model, turns, message length. Never the
customer's text, the reply, tool inputs (they echo the customer) or tool results. `CHAT_STAFF_REPLY` /
`CHAT_STATUS` (actor: staff): length and status only. A staff reply sends the customer an in-app notification
(`CHAT_REPLY`).

## Code

| File | Holds |
|---|---|
| `src/lib/chat.ts` | Statuses, senders, handover reasons and labels, limits, `cleanChatMessage`, `agentShouldReply`, `chatHistoryForModel` (last 20, masked, starts with the customer, staff marked) — `tests/chat.test.ts` |
| `src/server/chat.ts` | The agent's prompt and tools, `sendCustomerMessage`, `closeCustomerChat`, staff inbox (`listChatsForStaff`, `getChatForStaff`, `staffReply`, `setChatStatus`, `countWaitingChats`) |
| `src/server/ai-core.ts` | `runToolLoop`, the bounded tool loop shared with the staff assistants |
| `app/(site)/(account)/support/chat/*`, `app/components/account/CustomerChat.tsx`, `app/ui/ChatThread.tsx` | Customer page (checks for team replies every 20 s while handed over) |
| `app/admin/chats/*` | Inbox (badge `chats`: handed over and not answered yet) and the chat page: reply, keep / hand back / close, take over |
| `scripts/integration/chat.mts` | Local-database check with a scripted model |

## Not yet (phase B2 and later)

- **Reading transfer screenshots.** Customers pay by bank or card transfer and upload a screenshot with the order.
  Sending that screenshot to the AI conflicts with the project rule "payment proofs never go into AI prompts"
  (`CLAUDE.md`), so it needs the owner's explicit approval and its own change. Today a customer who says they paid
  is handed over (PAYMENT) with the order number.
- WhatsApp, Telegram and Instagram (phases C and D).

## Deploy order

The code reads `chatConversation` and `chatMessage` (also for the admin badge on every console page), so **migration
`20261113T1126_site_chat` must be applied to production before this code is published** (owner approval needed).
