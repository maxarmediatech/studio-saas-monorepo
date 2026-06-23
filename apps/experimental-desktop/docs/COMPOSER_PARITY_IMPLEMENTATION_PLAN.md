# Composer Parity Implementation Plan

Companion to `../COMPOSER_PARITY_REVIEWED.md`. Reference-copy notes live in `../COMPOSER_PARITY_REFERENCE_MAP.md` so this plan stays focused and under the working LOC constraint.

```txt
Current app: /Users/rakesh/Developer/agency/studio-saas-monorepo/apps/experimental-desktop
Reviewed source: ../COMPOSER_PARITY_REVIEWED.md
Reference map: ../COMPOSER_PARITY_REFERENCE_MAP.md
Created: 2026-06-23
Revised: 2026-06-23
```

## Core Position

Do not replace the composer, and do not optimize for the easiest migration. Keep the useful primitives, then move ownership into clean domain seams and make send behavior policy/admission/provider driven.

This composer is not only for coding. It should become the everyday input surface for coding agents, API chat models, local context, files, images, tasks, search, notes, and future app actions. Shared domain stays provider-neutral; provider-native shapes stay inside adapters.

Keep:
- structured `ComposerPayload.parts`
- strict attachment policy
- renderer/main/provider attachment validation
- native Codex file/image handoff
- folder context modes with caps
- pending request dock
- reset/report-loop guards around context and attachments

Current problem:

```txt
App.tsx owns outer composer state and draft debounce.
SessionComposer.tsx owns inner composer behavior and builds payload at send time.
useCodexSession.ts knows composer payload shape and builds provider input before sending.
Composer hooks own local state and report back upward.
Main DB owns durable draft snapshots.
```

This makes send-time behavior fragile and draft ownership ambiguous.

## Target Ownership

Use the best pattern from each reference:

```txt
OpenCode spine: draft -> request parts -> admitted input -> transport.
T3 richness: provider-instance draft state, image staging, inline tokens.
Aion policy: backend capabilities decide modes, uploads, queues, gates.
```

Use seams, not one giant store:

```txt
ComposerDraftStore      live editable renderer draft only
ComposerDraftSync       debounce, hydration, DB snapshot sync
ComposerSendController  request admission and send orchestration
ComposerModePolicy      mode/runtime/permission mapping
ComposerRequestParts    provider-agnostic request parts
ComposerProviderAdapter provider/backend-specific input
RuntimeCapabilityMap    selected provider/backend capabilities
ComposerQueueStore      queued sends only
```

Renderer draft store owns text/prompt parts, composer mode, draft/session runtime mode if scoped, draft/session model override if scoped, context items, attachments, cursor/focus metadata if needed, and local draft version.

Renderer draft store does not own global model preference, DB persistence implementation, queue execution, provider runtime internals, pending permission lifecycle, transcript, or event log.

The DB draft is the durable persisted snapshot. The renderer draft is live editable state. `ComposerDraftSync` is the only bridge between them.

`ComposerDraftSync` owns hydration, debounced persistence, persisted draft clearing after successful admission/send, version migration, and prevention of parent echo/reset loops.

Queue state is separate from draft state:

```txt
Draft = what the user is editing now.
Queue item = admitted future send.
```

`ComposerQueueStore` owns queued snapshots, ordering, edit/remove/reorder/clear, pause/resume, validation state, and retry state if added.

## Target Send Pipeline

Current dangerous path:

```txt
SessionComposer.tsx builds ComposerPayload
-> useCodexSession.ts builds provider input
-> main/provider send path validates/normalizes
```

Move a thin request admission/send controller into P0 before large draft refactors.

Target flow:

```txt
composer snapshot
-> ComposerSendController
-> ComposerModePolicy
-> ComposerRequestParts
-> renderer FileSafetyPolicy for UX
-> renderer ContextBudgetPolicy for UX
-> RuntimeCapabilityMap
-> ComposerProviderAdapter
-> AdmittedComposerRequest
-> useCodexSession transport
-> IPC/main send boundary
-> main provider envelope + file safety enforcement
-> main validation/normalization
-> provider runtime
```

Renderer policy is UX. Main policy is the trust boundary.

File-safety and budget checks must not live only in UI because files can enter through picker, paste, drag/drop, folder context, mentions, restored drafts, queued sends, future programmatic insertion, or IPC/provider payloads.

## Controller / Session Contract

The controller must output an admitted request. The session hook should transport admitted requests and hydrate conversation state; it should not know raw composer payload shape.

Shared contracts stay provider-neutral. Provider-native shapes are discriminated adapter outputs.

Target interface:

```ts
export type ComposerRequestPart =
  | { type: "text"; text: string }
  | { type: "file_ref" | "image_ref"; path: string; name: string; mimeType?: string }
  | { type: "folder_ref"; path: string; label: string; mode?: string }
  | { type: "agent_ref" | "skill_ref"; name: string }
  | { type: "terminal_ref"; id: string; label: string }
  | { type: "app_action"; action: string; input?: unknown };

export type RuntimeModeSelection = { provider: string; mode: string; locked?: boolean };
export type CodexNativeInputPart = { type: "text"; text: string } | { type: "local_image" | "local_file"; path: string; name: string; mimeType: string };

export type ProviderSendInput =
  | { provider: "codex"; prompt: string; nativeInput?: CodexNativeInputPart[]; runtimeMode: CodexRuntimeMode; model: string }
  | { provider: "opencode"; prompt: { text: string; files?: unknown[]; agents?: unknown[] }; delivery: "steer" | "queue" }
  | { provider: "acp"; backend: string; message: string; mode?: string; attachments?: unknown[] }
  | { provider: "api-chat"; model: string; messages: unknown[]; attachments?: unknown[] };

export type AdmittedComposerRequest = {
  id: string;
  draftSnapshot: ComposerDraft;
  requestParts: ComposerRequestPart[];
  providerInput: ProviderSendInput;
  admission: {
    mode: ComposerMode;
    effectiveRuntime?: RuntimeModeSelection;
    capabilityWarnings: string[];
    warnings: string[];
  };
};

export type ComposerSessionTransport = {
  sendAdmittedRequest(request: AdmittedComposerRequest): Promise<boolean>;
};
```

Short-term, a legacy `ComposerPayload` snapshot may exist for compatibility. Long-term, transcript rendering should use `ComposerRequestPart[]`.

## Mode Policy

Modes must stop being prompt-only labels. They must be resolved against selected provider/backend capabilities.

```txt
ask    -> force read-only, no shell, no edits
plan   -> force read-only, no shell, no edits
review -> force read-only, no shell, no edits
build  -> default/suggest workspace-write, never silently full-access
shell  -> explicit shell path only when provider/runtime supports it
```

Rules:
- `ask`, `plan`, and `review` always de-escalate to read-only.
- `build` may move to workspace-write unless the user explicitly locked read-only.
- `build` never silently escalates to full-access.
- full-access requires visible escalation warning.
- shell blocks attachments/context until selected provider/backend explicitly supports them.

Current P0 decision:
- Until the UI has an explicit runtime lock/escalation affordance, `build` keeps the user-selected runtime mode instead of silently moving read-only to workspace-write.
- `ask`, `plan`, and `review` still de-escalate to read-only in admission.
- `shell` is blocked for Codex until a direct shell-capable path exists.

Initial tests:

```txt
ask with workspace-write -> read-only
plan with full-access -> read-only
review with workspace-write -> read-only
build with read-only -> workspace-write only if not locked by user
build never escalates to full-access
shell with attachment -> blocked
shell with context -> blocked
shell without provider shell capability -> blocked or converted to safe prompt with warning
```

## P0 — Stop Regression And Control Send-Time Risk

### 1. Add Composer Primitive Tests

Primitive tests lock the behavior current low-level primitives already provide. They should not assert future admission rules.

Target tests:

```txt
composerPayload.test.ts
composerProviderInput.test.ts
composerAttachmentPolicy.test.ts
composerAttachmentState.test.ts
composerContextState.test.ts
```

Primitive cases:
- deterministic payload order for text/context/attachments
- image attachments produce native/local image provider input when ready
- non-ready attachments are filtered by current provider-input building
- duplicate attachment behavior is stable
- unchanged parent echo does not re-report attachments forever
- unchanged parent echo does not re-report context forever
- reset signal clears exactly once

### 2. Add Thin Request Admission + Send Controller

Path:

```txt
src/renderer/components/composer/core/composerSendController.ts
```

Initial responsibilities:
- accept current composer snapshot
- build `ComposerRequestPart[]`, with `ComposerPayload` only as compatibility output
- run mode policy checks
- reject unsupported or unresolved attachments during admission
- run renderer safety/budget checks once added
- create `AdmittedComposerRequest`
- call `sendAdmittedRequest`
- clear draft only after send admission succeeds
- preserve draft on failure

Admission tests belong here:
- unsupported attachment -> rejected before session transport
- pathless/unresolved attachment -> rejected before session transport
- shell with context/attachments -> rejected before session transport
- blocked mode policy -> rejected before session transport
- valid request -> produces `AdmittedComposerRequest`

Short-term it may wrap current primitives:

```txt
buildComposerPayload compatibility wrapper
codexComposerAdapter
sendAdmittedRequest
```

Long-term it owns request admission, optimistic message, rollback, queue admission, and shell branching.

### 3. Add Mode Policy

Path:

```txt
src/renderer/components/composer/core/composerModePolicy.ts
```

Responsibilities:
- derive effective runtime mode from composer mode
- detect escalation/de-escalation
- decide whether shell/context/attachments are allowed
- return structured warning/block reasons
- stay pure and testable

### 4. Add Draft Ownership Contract, Then Move Persistence

Paths:

```txt
src/renderer/components/composer/core/composerDraftTypes.ts
src/renderer/components/composer/core/composerDraftSync.ts
```

Initial draft shape:

```ts
export type ComposerDraft = {
  version: number;
  text: string;
  mode: ComposerMode;
  runtimeMode?: RuntimeModeSelection;
  model?: string;
  contextItems: ComposerContextItem[];
  attachments: ComposerAttachment[];
  updatedAt: number;
};
```

Contract:

```txt
Renderer draft = live editable state.
DB draft = durable persisted snapshot.
ComposerDraftSync = only owner of debounce/hydration/clear.
```

Then move `App.tsx` draft persistence into `ComposerDraftSync`.

### 5. Add Provider Adapter Boundary

Paths:

```txt
src/renderer/components/composer/adapters/codexComposerAdapter.ts
src/renderer/components/composer/core/composerProviderTypes.ts
src/renderer/components/composer/core/runtimeCapabilityMap.ts
```

Adapters hide provider-specific input shape from `useCodexSession.ts` and composer UI. Start with Codex, but design the union for OpenCode, ACP backends, and API chat providers.

P0 done when primitive tests lock current payload/attachment behavior, admission tests own rejection behavior, send path enters one controller before provider/session call, mode policy exists and is tested, draft sync contract exists, and `App.tsx` no longer owns draft persistence debounce directly.

P0 progress:
- Added `composerSendController.ts`, `composerModePolicy.ts`, `composerProviderTypes.ts`, `runtimeCapabilityMap.ts`, and `adapters/codexComposerAdapter.ts`.
- Current send path now admits a composer payload into an `AdmittedComposerRequest` before transport.
- `useCodexSession.ts` exposes `sendAdmittedRequest` and carries admitted request metadata through the legacy IPC payload for compatibility.
- No new dependency was added for this slice; validation is currently `type-check` and `build` until the focused test runner decision is made.

P0 slice 2 progress:
- Added app-local Vitest config and scripts, using the repo's existing Vitest 2.x line.
- Added focused tests for mode policy, send admission, and Codex adapter behavior.
- Marked `useCodexSession.sendMessage(payload)` as legacy compatibility until `ComposerRegion` owns admission.
- Added a small Codex admitted transport mapper so `useCodexSession.ts` no longer hand-builds the Codex IPC payload.
- Admission warnings are now surfaced in the event log as `admission.warning` entries until a dedicated composer warning UI exists.

P0 slice 3 progress:
- Added `composerDraftTypes.ts` and `composerDraftSync.ts`.
- `App.tsx` still owns live composer state for compatibility, but no longer owns draft persistence debounce.
- `ComposerDraftSync` owns the persist/no-persist decision and converts live draft state into the legacy DB payload.
- `useCodexSession.persistDraft` now accepts a draft-sync persistence input instead of raw `ComposerPayload`.
- Added focused draft-sync tests for persist gating and payload conversion.

## P1 — Request Parts, Safety, Budget

### 1. Add Request Parts

Path:

```txt
src/renderer/components/composer/core/composerRequestParts.ts
```

Responsibilities: normalize draft text/context/attachments into deterministic provider-agnostic parts, dedupe file/context references, and preserve source metadata where possible.

### 2. Add Escaped/Quoted Mention Parser

Path:

```txt
src/renderer/components/composer/core/composerMentionParser.ts
```

Requirements: support simple paths, paths with spaces, punctuation at token boundaries, escaped or quoted insertion, stable display labels, canonical paths, and tests for spaces/punctuation/quotes/duplicate basenames/cursor positions.

### 3. Add Renderer File-Safety Policy

Path:

```txt
src/renderer/components/composer/core/composerFileSafetyPolicy.ts
```

Responsibilities: classify risky local project files, warn before sending risky files, block files that require explicit override, and return structured warning/block results.

### 4. Add Main-Side Provider Envelope + File-Safety Enforcement

Path:

```txt
src/main/composer-file-safety.ts
```

Responsibilities:
- enforce safety at IPC/main boundary
- validate provider payloads, not only renderer request parts
- ensure native/local file paths match admitted request parts
- reject injected provider file paths that do not correspond to admitted parts
- verify paths exist and normalize safely before provider input normalization/send
- treat renderer results as advisory only

### 5. Add Context Budget

Paths:

```txt
src/renderer/components/composer/core/composerBudget.ts
src/renderer/components/composer/ComposerContextBudget.tsx
```

Behavior: estimate budget from text/context/attachments/folder context, show normal/warning/danger levels, warn at high usage, and require confirmation at hard-limit boundary.

P1 done when request parts are provider-agnostic, renderer and main both enforce file-safety roles, main validates provider payloads against admitted request parts, context budget is visible before send, and `useCodexSession.ts` no longer knows raw composer payload shape.

## P2 — Send Orchestration Features

### 1. Optimistic Message + Rollback

Insert optimistic user message after send admission, remove it on provider/session failure, restore draft on failure, and preserve attachments/context if send failed before admission. This belongs in `ComposerSendController`, not `SessionComposer.tsx`.

### 2. Separate Shell Branch

Shell should not remain a normal prompt prefix.

```txt
if provider supports direct shell:
  use explicit shell action path
else:
  block or send as normal prompt only with clear warning
```

Shell send must be permission-gated.

### 3. Typed Pending Requests

Current generic dock can stay initially, but domain state should distinguish permission approval, user input/question, command/tool request, todo/progress, and future file/change request.

### 4. Queue Store

Paths:

```txt
src/renderer/components/composer/core/composerQueueStore.ts
src/renderer/components/composer/ComposerQueuePanel.tsx
```

Behavior: queue when turn is active/busy, validate before admission, allow edit/remove/reorder/clear, pause/resume, and execute only when runtime/session gate is ready.

Initial limits:

```txt
max queued sends: 20
max input length: 20,000
max serialized queue state: 256 KB
```

P2 done when optimistic send/rollback, separate shell handling, typed pending state, and separate queue state are tested.

## P3 — Editor UX

Do this after P0-P2.

Short-term: keep textarea and add `ComposerHighlightLayer.tsx` for file mentions, slash command token, skill token, terminal token, and scroll/typography sync.

Long-term: choose one rich editor model only after domain seams are stable.

```txt
Lexical: best if file + skill + terminal + preview/review tokens become central.
contenteditable: simpler if we mainly need file/agent pills.
```

## Near-Term File Targets

```txt
src/renderer/components/composer/
  ComposerContextBudget.tsx
  core/
    composerModePolicy.ts
    composerDraftTypes.ts
    composerDraftSync.ts
    composerProviderTypes.ts
    runtimeCapabilityMap.ts
    composerRequestParts.ts
    composerMentionParser.ts
    composerFileSafetyPolicy.ts
    composerBudget.ts
    composerSendController.ts
    composerQueueStore.ts
    __tests__/
      composerModePolicy.test.ts
      composerSendController.test.ts
      composerDraftSync.test.ts
      composerRequestParts.test.ts
      composerMentionParser.test.ts
      composerFileSafetyPolicy.test.ts
      composerBudget.test.ts
      composerProviderInput.test.ts
      composerPayload.test.ts
  adapters/
    codexComposerAdapter.ts

src/main/
  composer-file-safety.ts
```

Later files:

```txt
src/renderer/components/composer/
  ComposerHighlightLayer.tsx
  ComposerRichEditor.tsx
  ComposerQueuePanel.tsx
  adapters/
    opencodeComposerAdapter.ts
    claudeComposerAdapter.ts
    cursorComposerAdapter.ts
```

## Done Criteria

The refactor is working when:
- `App.tsx` no longer persists composer draft directly.
- `SessionComposer.tsx` only emits draft/send intent and does not orchestrate request admission.
- `useCodexSession.ts` exposes `sendAdmittedRequest` and does not know raw composer payload shape.
- controller/session contract uses `AdmittedComposerRequest` or equivalent explicit admitted input.
- mode changes always pass through `composerModePolicy.ts`.
- send always passes through request admission checks.
- renderer file-safety gives UX warnings.
- main-side file-safety enforces the IPC trust boundary and validates provider payloads.
- context budget is visible before send.
- image/file attachments have focused regression tests.
- queue state is separate from editable draft state.
- shell send is no longer hidden as a normal prompt prefix.

Final call: do not start by polishing UI. Make composer state, policy, request admission, and provider adaptation boring and testable first.
