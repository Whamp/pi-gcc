# main

**Purpose:** Main project memory branch

---

## Commit 026b8b73 | 2026-02-25T20:47:32.903Z

### Branch Purpose

Maintain the primary developmental roadmap and memory for the `pi-gcc` extension.

### Previous Progress Summary

Initial commit.

### This Commit's Contribution

- Implemented lazy state initialization in the extension to allow immediate GCC tool usage after mid-session initialization, removing the previous requirement for a session restart.
- Updated GCC skill documentation to clarify initialization paths and distinguish between greenfield and brownfield project workflows based on first-use feedback.
- Refined the post-initialization checklist and removed obsolete sections from the skill to reduce agent confusion during setup.
- Established that systemic friction, like mid-session initialization failure, should be addressed via code changes rather than documentation workarounds.
- Verified the fix with a new test case for lazy loading and confirmed all 99 tests pass.

---

## Commit d11fb7ff | 2026-02-25T22:00:34.521Z

### Branch Purpose

Maintain the primary developmental roadmap and memory for the `pi-gcc` extension, capturing core architectural decisions and evolution of the GCC protocol.

### Previous Progress Summary

Implemented lazy state initialization to support mid-session GCC setup without requiring a session restart. Refined the GCC skill documentation to clarify greenfield vs. brownfield workflows and established the design principle of addressing system friction through code rather than documentation workarounds.

### This Commit's Contribution

- Implemented a 600 KB size threshold (~150k-175k tokens) for `log.md` to prevent unbounded memory growth and subagent context overflow.
- Added proactive warnings to `session_start` notifications and `gcc_context` output when the log exceeds the threshold, nudging the agent toward committing.
- Updated the GCC skill to emphasize that large logs should be distilled into commits, even when the activity feels mundane, to preserve institutional memory.
- Adopted a friction-based design for log curation: committing is the path of least resistance, while truncation is a deliberate, undocumented fallback for noise removal.
- Established the character-to-token ratio for typical GCC log content (~3.7-4 bytes per token) to inform future memory limit tuning.

---

## Commit e0a5a7a9 | 2026-02-28T17:32:00.379Z

### Branch Purpose

Maintain the primary developmental roadmap and memory for the `pi-brain` extension (formerly `pi-gcc`), capturing core architectural decisions and evolution of the memory protocol.

### Previous Progress Summary

Initial development focused on establishing the core `pi-gcc` (now `pi-brain`) extension, implementing lazy state initialization for mid-session setup, and refining documentation for greenfield vs. brownfield workflows. A 600 KB size threshold for `log.md` was introduced with proactive warnings to manage context growth, and the project adopted a "friction-based" design where committing is the primary path for log curation. Automated changelog and release workflows were integrated using `changelogen` to streamline maintenance.

### This Commit's Contribution

- Formally renamed the project to `pi-brain` and migrated all tools to the `memory_*` namespace to resolve naming collisions with the GNU Compiler Collection.
- Replaced the manual 2-step commit process with a fully autonomous subagent-based distillation flow to reduce agent cognitive load.
- Implemented and regression-tested prompt-cache safety invariants, ensuring that memory status injection is deterministic and does not break the agent's cached prefix.
- Simplified initialization by pivoting from manual bash scripts to agent-driven setup via the `brain` skill and `/skill:brain` command.
- Integrated property-based testing (PBT) for core logic (YAML, OTA formatting, status rendering) to ensure robustness against malformed inputs and edge cases.
- Enforced deterministic branch sorting in memory status output to maintain stable tool results across different execution environments.
- Expanded test coverage to 167 passing tests, specifically validating lifecycle hooks and cache-safety contracts.

---

## Commit a86ad81d | 2026-02-28T20:02:17.138Z

### Branch Purpose

Maintain the primary developmental roadmap and memory for the `pi-brain` extension, capturing core architectural decisions and evolution of the memory protocol.

### Previous Progress Summary

Initial development established the `pi-brain` extension (formerly `pi-gcc`) with lazy state initialization and a 600 KB log size threshold to prevent context overflow. Architectural milestones include migrating to the `memory_*` tool namespace, implementing autonomous subagent-based distillation, and enforcing prompt-cache safety invariants. The protocol was refined into a 2-tool model (`memory_commit`, `memory_branch`) with agent-driven initialization via the `brain` skill, supported by property-based testing and deterministic output sorting to ensure robustness across diverse execution environments.

### This Commit's Contribution

- Added an explicit "When to Commit" checklist to the `.memory/AGENTS.md` template and protocol reference to standardize checkpoint triggers.
- Updated root `.memory/AGENTS.md` to the current 2-tool model, ensuring agent orientation matches the actual toolset.
- Implemented regression test coverage in `src/init-script.test.ts` to ensure the commit checklist is present in generated memory directories.
- Rejected "auto-commit on shutdown" as a strategy to avoid noisy/low-value memory entries, favoring proactive nudges instead.
- Confirmed that UI-only footer status changes do not influence model context, reinforcing the necessity of explicit documentation-based guidance.
- Triaged future UX improvements (session-shutdown reminders and milestone-based nudges) into project TODOs for deeper design.

---

## Commit 587516a0 | 2026-02-28T22:48:28.696Z

### Branch Purpose

Maintain the primary developmental roadmap and memory for the `pi-brain` extension, capturing core architectural decisions and evolution of the memory protocol.

### Previous Progress Summary

Initial development established the `pi-brain` extension (formerly `pi-gcc`) with lazy state initialization and a 600 KB log size threshold to manage context growth. Architectural milestones include migrating to the `memory_*` tool namespace, implementing autonomous subagent-based distillation, and enforcing prompt-cache safety invariants. The protocol was refined into a 2-tool model (`memory_commit`, `memory_branch`) with agent-driven initialization via the `brain` skill, supported by property-based testing and deterministic output sorting. Recently, the protocol was reinforced with an explicit 'When to Commit' checklist and regression tests to ensure consistent project orientation and checkpoint triggers.

### This Commit's Contribution

- Implemented a roadmap update reminder in `memory_commit` to address the issue of silent roadmap drift during development.
- Chose an "always-on" default for the reminder, requiring an explicit opt-out via `update_roadmap: false` to ensure agents prioritize roadmap maintenance.
- Formalized roadmap maintenance as a core project convention in `SKILL.md` and `.memory/AGENTS.md` templates.
- Resolved discrepancies between documentation and implementation by correcting the project roadmap to reflect the 2-tool model.
- Established regression coverage for the reminder's opt-out behavior and presence in the tool output.
- Published v0.1.5 to baseline these protocol-enforcement improvements and documentation baselines.

---

## Commit 554da5f3 | 2026-03-01T18:08:49.998Z

### Branch Purpose

Maintain the primary developmental roadmap and memory for the `pi-brain` extension, capturing core architectural decisions and evolution of the memory protocol.

### Previous Progress Summary

Initial development established the `pi-brain` extension (formerly `pi-gcc`) with lazy state initialization and a 600 KB log size threshold to manage context growth. Architectural milestones include migrating to the `memory_*` tool namespace, implementing autonomous subagent-based distillation, and enforcing prompt-cache safety invariants. The protocol uses a 2-tool model (`memory_commit`, `memory_branch`) with agent-driven initialization and roadmap maintenance reminders to prevent context drift. Recently, the extension was published as v0.1.5, baselining core protocol-enforcement and documentation improvements.

### This Commit's Contribution

- Switched memory status injection from a visible custom message to a `systemPrompt` update in the `before_agent_start` hook to improve model focus.
- Implemented "Frozen Snapshot" logic for the roadmap (`main.md`), ensuring cache stability by providing a fixed view of the memory state for the duration of a session.
- Rewrote cache-safety property-based tests to assert per-call `systemPrompt` invariants and one-time injection per epoch.
- Added lifecycle-gated snapshot refresh logic: session start, switch, and compaction now trigger a fresh snapshot to maintain accuracy without mid-session drift.
- Strengthened test coverage with lazy-initialization freeze tests to ensure snapshots are correctly captured even during first-use setup.
- Formalized the "Base Prompt + Epoch Freeze" pattern to prevent unpredictable prefix changes that would invalidate LLM prompt caches.
