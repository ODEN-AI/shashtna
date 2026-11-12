# SHASHTNA AI CORE (phase 5)

The shared base for Shashtna's AI assistants. Step 1 builds the core and the first read-only tools. Each agent
(Operations, Finance, Customers, Marketing) is added in its own step, on top of this core.

## Rules

- **Read-only (step 1).** Agents answer questions. They never change data, confirm payments, activate
  subscriptions, change prices, message customers or change settings. Proposals that need the owner's approval
  come in a later step, with their own storage and approval flow.
- **Off by default.** Setting `ai.agents.enabled` (Admin → Settings → مساعدي الذكاء الاصطناعي) is `off`. Only
  `OWNER`/`ADMIN` can change it, and every change is logged (`AI_SETTINGS_CHANGED`).
- **Staff only, by role.** Each tool has a permission (`src/lib/roles.ts`). The model is shown only the tools the
  asking role holds, and every call is checked again on the server. `OPERATOR` never gets `finance_facts`.
- **Data classes.** `AGGREGATE` (counts, sums) and `OPERATIONAL` (order ids, statuses, package names) are allowed.
  `CUSTOMER` (one customer's details) is refused in step 1 for every role, the owner included.
- **Nothing personal reaches Anthropic.** Tools return no names, phones, e-mails, credentials, payment proofs or
  receipts. On top of that, `maskForModel` drops sensitive keys and masks phones, e-mails and long digit runs in
  every result, and results are capped at `MAX_RESULT_CHARS`. Tool results are data, not instructions.
- **Strict input.** Tool inputs are validated on the server (`checkToolInput`): declared keys only, enums exact,
  integers whole and in range. A bad call gets an error result; the tool never runs.
- **Bounded runs.** At most `MAX_TURNS` (6) model turns, `MAX_TOOL_CALLS` (12) tool calls and about 22 seconds
  per question. Past the limit the run stops with a short answer.
- **Audited.** Each run logs `AI_AGENT_RUN` / `AI_AGENT_FAILED`: agent, model, question length, tool names and
  inputs, timing. Never the question text or any tool result.
- **Model.** `claude-opus-5-5`, adaptive thinking at low effort, server-side refusal fallback (`fallbacks:
  "default"`). Without `ANTHROPIC_API_KEY` the assistants report «غير مُعدّ» and nothing else changes.

## Code

| File | Holds |
|---|---|
| `src/lib/ai-core.ts` | Pure rules: limits, data classes, `canUseTool`, `checkToolInput`, `maskForModel`, `toolResultText`, budget, audit summary (`tests/ai-core.test.ts`) |
| `src/server/ai-core.ts` | Tools, agent definitions and `runAgent(actor, agent, question)`: the bounded tool loop; the model call is injectable for tests |
| `scripts/integration/ai-core.mts` | Local-database check with a scripted model (no API key, no network) |

## Tools (step 1)

| Tool | Permission | Data | Returns |
|---|---|---|---|
| `operations_today` | `orders` | OPERATIONAL | Subscriptions to contact by type and service, open orders (waiting payment, proofs to review, paid not activated) with order ids and waiting time, data-health counters |
| `automation_status` | `insights` | AGGREGATE | Automation switches, today's runs and attempts, masked last error, outbox rows needing attention |
| `finance_facts` | `finance` | AGGREGATE | The analyst's fact pack for a period (`today` … `prevMonth`) |

## Agents

| Agent | Step | Tools |
|---|---|---|
| `operations` («مساعد العمليات») | 1 (core), page in step 2: Admin → `/admin/assistant` (permission `insights`) | `operations_today`, `automation_status`, `finance_facts` (owner/admin) |

## The page (step 2)

`/admin/assistant` («مساعد العمليات», nav: Intelligence) — one question, one answer, with the tools it read shown
under the answer. The question box is disabled, with a clear notice, while the switch is off or
`ANTHROPIC_API_KEY` is missing. Suggested questions match the role's tools (the finance one only for owner/admin).
Server action `askAssistantAction` (`app/admin/assistant/actions.ts`) checks the session and `insights`, then calls
`runAgent`, which re-checks everything.

## Not yet

- No writes, no proposals, no customer-level data, no memory between questions.
- No new database tables or migrations.
