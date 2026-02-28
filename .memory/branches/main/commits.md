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
