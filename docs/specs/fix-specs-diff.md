# GCC Spec Sync Diff (canonical vs archived)

**Canonical spec to implement against:**

- `/home/will/projects/pi-gcc/docs/specs/GCC-SPEC-USE-THIS-ONE.md`
- (copied from `/home/will/projects/pi-ctx/docs/specs/GCC-SPEC.md`)

**Archived outdated spec (for historical reference only):**

- `/home/will/projects/pi-gcc/docs/specs/GCC-SPEC-WRONG-ONE.md`

**Removed to avoid confusion (do not recreate):**

- `/home/will/projects/pi-gcc/docs/specs/GCC-SPEC.md`

**Raw unified diff (archived vs canonical):**

```bash
diff -u \
  /home/will/projects/pi-gcc/docs/specs/GCC-SPEC-WRONG-ONE.md \
  /home/will/projects/pi-gcc/docs/specs/GCC-SPEC-USE-THIS-ONE.md
```

---

## 1) Cache-critical mismatches (highest priority)

| Area                     | Canonical (desired)             | Archived (wrong)                                              | Required change                                           |
| ------------------------ | ------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Root `AGENTS.md` section | Static, written once at init    | Dynamic branch/milestone state, updated after commits/merges  | Make root `AGENTS.md` static and stop state updates there |
| `before_agent_start`     | No per-turn context injection   | Explicit per-turn context injection (`gcc_context_injection`) | Remove hook behavior from runtime/docs                    |
| Prompt-cache guidance    | Explicit cache-safe constraints | Claims context injection has negligible cost                  | Restore cache-safe language and constraints               |

---

## 2) Major behavior divergences

### 2.1 `gcc_commit`

- **Canonical:** Subagent distillation flow.
- **Current runtime:** Two-step flow (`gcc_commit` returns log, `agent_end` finalizes).
- **Action:** Revert runtime/docs to canonical flow, or explicitly approve divergence.

### 2.2 `gcc_context`

- **Canonical:** Status overview tool; detailed retrieval via `read` tool.
- **Current runtime:** Multi-level API (`status|branch|commit|log|metadata`) with extra params.
- **Action:** Revert to status-only tool contract if strictly syncing.

### 2.3 `gcc_merge`

- **Canonical:** Extension reads source branch latest commit; agent updates `main.md`.
- **Current runtime/docs:** Extra behavior around root `AGENTS.md` updates.
- **Action:** Remove root `AGENTS.md` update requirement and align merge flow wording.

---

## 3) Event hook/lifecycle drift

Archived spec added sections absent in canonical:

- `6.2 before_agent_start`
- `6.4 session_shutdown`
- `6.6 resources_discover`
- `6.7 state lifecycle`
- `6.8 commit flow integration`
- `6.9 tool execute wrapper pattern`
- `6.10 ESM path resolution`

Canonical lifecycle scope is narrower:

- `turn_end`
- `session_start` (registration, no injection)
- `session_before_compact` (optional note)

**Action:** Remove or rewrite added lifecycle sections to match canonical scope and cache model.

---

## 4) State and initialization differences

### 4.1 `state.yaml`

- **Canonical:** includes `sessions:` list.
- **Current runtime/docs:** sessions deferred for v1.
- **Action:** Reintroduce sessions list or document approved divergence.

### 4.2 Init flow

- **Canonical:** creates empty `.gcc/main.md`; adds `.gcc/branches/*/log.md` to `.gitignore`; root AGENTS section is static tool-awareness text.
- **Current runtime/docs:** root AGENTS section includes dynamic state; `.gitignore` guidance changed.
- **Action:** restore canonical init behavior.

---

## 5) Structural section-level differences

### Present in canonical but replaced/removed in archived

- `## 14. Resolved Design Decisions`
- `## 15. Prompt Cache Considerations`

### Added in archived but absent in canonical

- `## 14. Open Questions`
- `## Appendix A: Reference Prompts for Commit Writing` (+ A.1–A.6)

**Action:** restore sections 14/15 from canonical spec if strict sync is required.

---

## 6) Concrete edit checklist for runtime/docs

1. Revert extension behavior/docs that depend on `before_agent_start` injection.
2. Make root `AGENTS.md` static and stop dynamic milestone updates.
3. Resolve `gcc_commit` model divergence (canonical subagent flow vs current 2-step flow).
4. Align `gcc_context` scope (status-only + `read` for deep retrieval).
5. Align `gcc_merge` behavior and remove root `AGENTS.md` update requirement.
6. Reconcile state schema (`sessions` list).
7. Reconcile init script/template outputs (`main.md`, `.gitignore`, static root section).
8. Update README/AGENTS/SKILL docs to match canonical model.

---

## 7) Recommended remediation order

1. Fix cache-critical behavior first (`before_agent_start`, dynamic root AGENTS state).
2. Align tool contracts (`gcc_commit`, `gcc_context`, `gcc_merge`).
3. Align lifecycle/state/init details.
4. Update user/agent docs and run full verification.

---

## 8) Naming rule (important)

Use these exact filenames going forward:

- Canonical: `docs/specs/GCC-SPEC-USE-THIS-ONE.md`
- Archived old copy: `docs/specs/GCC-SPEC-WRONG-ONE.md`

Do **not** recreate `docs/specs/GCC-SPEC.md`.

---

## 9) Current implementation status (2026-02-23)

### Completed

- Removed `before_agent_start` context injection from runtime.
- Removed dynamic root `AGENTS.md` milestone updates from commit/merge flows.
- Made init output cache-safe:
  - static root `AGENTS.md` GCC section,
  - creates `.gcc/main.md`,
  - idempotently adds `.gcc/branches/*/log.md` to `.gitignore`.
- Simplified `gcc_context` to status overview + `read`-first deep retrieval guidance.
- Added `sessions` list support in `.gcc/state.yaml` + `session_start` registration.
- Aligned lifecycle wiring by removing `session_shutdown` hook.

### Approved divergence (Option 3)

- **Canonical spec:** `gcc_commit` subagent distillation.
- **Implemented runtime (approved):** keep existing 2-step flow:
  1. `gcc_commit` returns log preparation context,
  2. `agent_end` finalizes commit from assistant commit blocks.

This divergence is intentional for v1 to avoid high-risk runtime orchestration complexity. It should remain documented here unless a future version adds a robust subagent execution path inside extension runtime.
