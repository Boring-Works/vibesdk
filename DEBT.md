# Technical Debt Log

## Active Debt

### D1: `openai/streaming` import path deprecated in v6
**File:** `worker/agents/inferutils/core.ts:2`
**Why carrying:** openai v6 ships a backwards-compat shim at `openai/streaming` so it works. Upstream vibesdk uses the same path. Fixing it would diverge from upstream unnecessarily.
**Resolve when:** Next upstream sync that updates the import path.

### D2: `x-session-affinity` header may not pass through AI Gateway
**File:** `worker/agents/inferutils/core.ts:558`
**Why carrying:** CF docs only show this header for direct Workers AI API calls, not through AI Gateway. The header is harmless if ignored (no error, no side effect). If it works, we get prompt caching. If not, it's a no-op.
**Resolve when:** Cloudflare documents AI Gateway support for session affinity, or we verify via observability.

### D3: `addConversationMessage` full read-modify-write per message
**File:** `worker/agents/core/codingAgent.ts:455-483`
**Why carrying:** Requires DO SQLite schema migration. High effort, medium risk. Performance impact is real but not user-facing (SQLite is fast for single-tenant DO).
**Resolve when:** Conversation history exceeds 500 messages in typical sessions.

### D4: `handleWebSocketMessage` recreated on every state update
**File:** `src/routes/chat/hooks/use-chat.ts:248-269`
**Why carrying:** Fixing requires converting 17 state deps to refs. High risk of introducing stale closure bugs. The current approach works, just burns more GC cycles.
**Resolve when:** Profiling shows this as a measurable bottleneck in Chrome DevTools.

### D5: `appViews` table has no unique index on (userId, appId)
**File:** `worker/database/schema.ts`
**Why carrying:** Requires D1 migration + data deduplication of existing rows. View counts are currently inflated for repeat visitors.
**Resolve when:** View counts are used for monetization or public ranking.

### D6: Vault WebSocket has no reconnection logic
**File:** `src/contexts/vault-context.tsx:106-156`
**Why carrying:** Vault operations fail silently if WS drops. Low frequency feature.
**Resolve when:** Vault is used in production for BYOK key management.

### D7: `void this.sql` in DO constructor swallows table creation errors
**File:** `worker/agents/core/codingAgent.ts:94-95`
**Why carrying:** Constructor cannot be async. Moving to onStart requires restructuring initialization order. Risk of breaking existing DO instances.
**Resolve when:** DO storage errors are observed in production logs.

### D8: `AgentContext` import deprecated in agents SDK 0.8
**File:** `worker/agents/core/codingAgent.ts:1`
**Why carrying:** The `AgentContext` type is still exported by the agents package (backwards compat) but the docs now use `getCurrentAgent()` pattern. This is upstream vibesdk code.
**Resolve when:** Upstream updates their agents SDK usage pattern.

### D9: DeepSeek R1 Distill as debugger fallback may degrade with system prompt
**File:** `worker/agents/inferutils/config.ts` (deepDebugger fallback)
**Why carrying:** DeepSeek R1 docs say "avoid system prompts, put all instructions in user prompt." Our debugger uses a system prompt. As a fallback it only fires if Sonnet 4.6 fails.
**Resolve when:** DeepSeek R1 is promoted to primary for any agent.

### D10: `compatibility_date` is `2025-08-10` (7 months stale)
**File:** `wrangler.jsonc:9`
**Why carrying:** Upstream vibesdk sets this deliberately. Bumping could change runtime behavior for nodejs_compat polyfills and DO deleteAll semantics.
**Resolve when:** Upstream bumps their compat date, or we need a specific newer feature.

## Resolved This Phase
- Workers AI provider slug `workersai/` -> `workers-ai/` (was breaking)
- ALLOWED_EMAILS singular/plural mismatch (was bypassing whitelist)
- AI proxy origin check commented out (was open to any origin)
- Sandbox health-check lost on DO eviction (was causing "No sandbox instance available")
- COMMON_AGENT_CONFIGS using Workers AI models (was breaking DEFAULT fallback)
- Truncation detection added (finish_reason: 'length' logged as warning)
- Abort signal check added before retry iterations and after backoff delay
- D1 batch delete now uses .returning() for proper typed results
- Cross-phase config isolation: COMMON uses Gemini, PLATFORM overrides with Workers AI
