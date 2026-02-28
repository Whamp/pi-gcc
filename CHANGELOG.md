# Changelog

All notable changes to this project will be documented in this file.

## v0.1.5

[compare changes](https://github.com/Whamp/pi-brain/compare/v0.1.3...v0.1.5)

### 🚀 Enhancements

- Consolidate branch/switch/merge into single memory_branch tool ([9e8e3a5](https://github.com/Whamp/pi-brain/commit/9e8e3a5))
- Append status view to memory_branch and memory_commit results ([39ebed7](https://github.com/Whamp/pi-brain/commit/39ebed7))
- Inject status via before_agent_start hook, remove memory_status tool ([812e644](https://github.com/Whamp/pi-brain/commit/812e644))
- Roadmap update reminder after every memory commit ([127acfc](https://github.com/Whamp/pi-brain/commit/127acfc))

### 🩹 Fixes

- Use setStatus for persistent Brain footer status ([1d49a5f](https://github.com/Whamp/pi-brain/commit/1d49a5f))
- Bound status injection and keep footer state fresh ([c350923](https://github.com/Whamp/pi-brain/commit/c350923))
- Sort branch listing for deterministic memory status ([8ffb390](https://github.com/Whamp/pi-brain/commit/8ffb390))

### 💅 Refactors

- Export buildStatusView, remove executeMemoryStatus ([629e5d2](https://github.com/Whamp/pi-brain/commit/629e5d2))
- Remove old switch/merge/status modules and types ([a37ad0d](https://github.com/Whamp/pi-brain/commit/a37ad0d))

### 📖 Documentation

- Add tool consolidation implementation plan ([cec355c](https://github.com/Whamp/pi-brain/commit/cec355c))
- Update plan — keep skill global, remove init script task ([0ec89cb](https://github.com/Whamp/pi-brain/commit/0ec89cb))
- Update plan — robust statusInjected flag with lifecycle resets ([13e3185](https://github.com/Whamp/pi-brain/commit/13e3185))
- Update templates, skill, and init tests for 2-tool surface ([8f81599](https://github.com/Whamp/pi-brain/commit/8f81599))
- Note prompt cache safety regression tests ([4c0bc08](https://github.com/Whamp/pi-brain/commit/4c0bc08))

### 🏡 Chore

- Commit plan and state updates ([1e413a8](https://github.com/Whamp/pi-brain/commit/1e413a8))
- Update brain memory state ([85592cd](https://github.com/Whamp/pi-brain/commit/85592cd))
- **release:** V0.1.4 ([ffc21a5](https://github.com/Whamp/pi-brain/commit/ffc21a5))

### ✅ Tests

- Add property-based invariants for compact status view ([81d7a49](https://github.com/Whamp/pi-brain/commit/81d7a49))
- Add cache-safety property test harness ([0d9ac88](https://github.com/Whamp/pi-brain/commit/0d9ac88))
- Enforce append-only before_agent_start cache contract ([19f915d](https://github.com/Whamp/pi-brain/commit/19f915d))
- Add lifecycle state-machine property for brain status injection ([bb35d61](https://github.com/Whamp/pi-brain/commit/bb35d61))
- Add deterministic status rendering property tests ([625226f](https://github.com/Whamp/pi-brain/commit/625226f))
- Add cache-safety property suite and deterministic branch ordering ([b13537d](https://github.com/Whamp/pi-brain/commit/b13537d))

### ❤️ Contributors

- Will Hampson <will@ggl.slmail.me>

## v0.1.4

[compare changes](https://github.com/Whamp/pi-brain/compare/v0.1.3...v0.1.4)

### 🚀 Enhancements

- Consolidate branch/switch/merge into single memory_branch tool ([bf27757](https://github.com/Whamp/pi-brain/commit/bf27757))
- Append status view to memory_branch and memory_commit results ([d2cc225](https://github.com/Whamp/pi-brain/commit/d2cc225))
- Inject status via before_agent_start hook, remove memory_status tool ([34c8479](https://github.com/Whamp/pi-brain/commit/34c8479))

### 🩹 Fixes

- Use setStatus for persistent Brain footer status ([47f0de1](https://github.com/Whamp/pi-brain/commit/47f0de1))
- Bound status injection and keep footer state fresh ([1222782](https://github.com/Whamp/pi-brain/commit/1222782))
- Sort branch listing for deterministic memory status ([19dc37e](https://github.com/Whamp/pi-brain/commit/19dc37e))

### 💅 Refactors

- Export buildStatusView, remove executeMemoryStatus ([f86725f](https://github.com/Whamp/pi-brain/commit/f86725f))
- Remove old switch/merge/status modules and types ([12917af](https://github.com/Whamp/pi-brain/commit/12917af))

### 📖 Documentation

- Add tool consolidation implementation plan ([960b146](https://github.com/Whamp/pi-brain/commit/960b146))
- Update plan — keep skill global, remove init script task ([c58f489](https://github.com/Whamp/pi-brain/commit/c58f489))
- Update plan — robust statusInjected flag with lifecycle resets ([5746033](https://github.com/Whamp/pi-brain/commit/5746033))
- Update templates, skill, and init tests for 2-tool surface ([49fda79](https://github.com/Whamp/pi-brain/commit/49fda79))
- Note prompt cache safety regression tests ([05cd6b1](https://github.com/Whamp/pi-brain/commit/05cd6b1))

### 🏡 Chore

- Commit plan and state updates ([3bb3781](https://github.com/Whamp/pi-brain/commit/3bb3781))
- Update brain memory state ([72db685](https://github.com/Whamp/pi-brain/commit/72db685))

### ✅ Tests

- Add property-based invariants for compact status view ([921b5b4](https://github.com/Whamp/pi-brain/commit/921b5b4))
- Add cache-safety property test harness ([bda0eb5](https://github.com/Whamp/pi-brain/commit/bda0eb5))
- Enforce append-only before_agent_start cache contract ([d920020](https://github.com/Whamp/pi-brain/commit/d920020))
- Add lifecycle state-machine property for brain status injection ([04838ce](https://github.com/Whamp/pi-brain/commit/04838ce))
- Add deterministic status rendering property tests ([151a5f8](https://github.com/Whamp/pi-brain/commit/151a5f8))
- Add cache-safety property suite and deterministic branch ordering ([3de4deb](https://github.com/Whamp/pi-brain/commit/3de4deb))

### ❤️ Contributors

- Will Hampson <will@ggl.slmail.me>

## v0.1.3

[compare changes](https://github.com/Whamp/pi-brain/compare/v0.1.2...v0.1.3)

### 📖 Documentation

- Add hero banner and fix Chromium screenshot height in skill ([0e72b62](https://github.com/Whamp/pi-brain/commit/0e72b62))

### ❤️ Contributors

- Will Hampson <will@ggl.slmail.me>

## v0.1.1

[compare changes](https://github.com/Whamp/pi-brain/compare/v0.1.0...v0.1.1)

### 🚀 Enhancements

- Wire gcc_commit to subagent-based commit distillation ([25471f5](https://github.com/Whamp/pi-brain/commit/25471f5))
- Lazy state init and log size warning at 600 KB ([55aed0f](https://github.com/Whamp/pi-brain/commit/55aed0f))

### 💅 Refactors

- Rename files from gcc to memory/brain ([9f0f4a7](https://github.com/Whamp/pi-brain/commit/9f0f4a7))
- Rename GccState to MemoryState, GccContextParams to MemoryStatusParams ([2fe7e98](https://github.com/Whamp/pi-brain/commit/2fe7e98))
- Update index.ts tool names, imports, and messages ([072a498](https://github.com/Whamp/pi-brain/commit/072a498))
- Update function names, types, and path references in tool files ([b3cbdd1](https://github.com/Whamp/pi-brain/commit/b3cbdd1))
- Update all source, test, skill, and template files for brain/memory naming ([c553e7e](https://github.com/Whamp/pi-brain/commit/c553e7e))
- Complete rename to pi-brain with memory\_ tools and .memory/ directory ([0049e67](https://github.com/Whamp/pi-brain/commit/0049e67))
- Rename pi-gcc to pi-brain ([09eb0f8](https://github.com/Whamp/pi-brain/commit/09eb0f8))

### 📖 Documentation

- Refine SKILL.md for brownfield usage and post-init guidance ([000f7fd](https://github.com/Whamp/pi-brain/commit/000f7fd))
- Direct agents to .gcc/main.md for project orientation ([1f78bc4](https://github.com/Whamp/pi-brain/commit/1f78bc4))
- Update AGENTS.md and README.md for current runtime design ([c910f71](https://github.com/Whamp/pi-brain/commit/c910f71))
- Simplify initialization instructions in README ([d559ea2](https://github.com/Whamp/pi-brain/commit/d559ea2))
- Require /reload after gcc-init to activate tools ([2a87338](https://github.com/Whamp/pi-brain/commit/2a87338))
- Rewrite README focused on simplicity and prompt cache safety ([81e2afa](https://github.com/Whamp/pi-brain/commit/81e2afa))
- Add npm install instructions to README ([2446d31](https://github.com/Whamp/pi-brain/commit/2446d31))

### 🏡 Chore

- Add .gcc/ project memory and gitignore log.md ([307ac9e](https://github.com/Whamp/pi-brain/commit/307ac9e))
- Add changelogen for automated changelog and release workflow ([943c189](https://github.com/Whamp/pi-brain/commit/943c189))

### ❤️ Contributors

- Will Hampson <will@ggl.slmail.me>

## v0.1.0

### 🚀 Enhancements

- Add minimal YAML parser/serializer ([b6e4bfc](https://github.com/Whamp/pi-gcc/commit/b6e4bfc))
- Add GCC state manager ([2047857](https://github.com/Whamp/pi-gcc/commit/2047857))
- Add commit hash generator ([f09a7df](https://github.com/Whamp/pi-gcc/commit/f09a7df))
- Add branch manager ([b67ae00](https://github.com/Whamp/pi-gcc/commit/b67ae00))
- Add OTA log entry formatter ([ddf87d2](https://github.com/Whamp/pi-gcc/commit/ddf87d2))
- Add gcc-init script and automated verification test ([45ca996](https://github.com/Whamp/pi-gcc/commit/45ca996))
- Add AGENTS.md updater utility ([8c88bb3](https://github.com/Whamp/pi-gcc/commit/8c88bb3))
- Add gcc_context tool with multi-resolution retrieval ([0f0441b](https://github.com/Whamp/pi-gcc/commit/0f0441b))
- Add gcc_branch tool ([7dde42a](https://github.com/Whamp/pi-gcc/commit/7dde42a))
- Add gcc_switch tool ([d5509d1](https://github.com/Whamp/pi-gcc/commit/d5509d1))
- Add gcc_commit tool with 2-step commit flow ([b8c7d91](https://github.com/Whamp/pi-gcc/commit/b8c7d91))
- Add gcc_merge tool ([d9299e5](https://github.com/Whamp/pi-gcc/commit/d9299e5))
- Add OTA logger hook extractor ([3b88f7c](https://github.com/Whamp/pi-gcc/commit/3b88f7c))
- Add context injector hook logic ([02e1dd1](https://github.com/Whamp/pi-gcc/commit/02e1dd1))
- Add commit flow manager hook logic ([1597fec](https://github.com/Whamp/pi-gcc/commit/1597fec))
- Wire GCC tools and lifecycle hooks in extension entry ([f53f452](https://github.com/Whamp/pi-gcc/commit/f53f452))
- Make GCC init output cache-safe static AGENTS section ([cbe2961](https://github.com/Whamp/pi-gcc/commit/cbe2961))
- Add state.yaml sessions tracking support ([56c71cc](https://github.com/Whamp/pi-gcc/commit/56c71cc))
- Add subagent spawn module with task builder and output extractor ([acddc98](https://github.com/Whamp/pi-gcc/commit/acddc98))
- Rewire gcc_commit to use subagent instead of 2-step flow ([00c2c67](https://github.com/Whamp/pi-gcc/commit/00c2c67))
- Replace 2-step gcc_commit with subagent-based commit distillation ([578758f](https://github.com/Whamp/pi-gcc/commit/578758f))

### 🩹 Fixes

- Resolve lint, typecheck, and format issues in scaffold ([3a666db](https://github.com/Whamp/pi-gcc/commit/3a666db))
- Sync session branch mapping on gcc_branch/gcc_switch and handle empty roadmap ([cf46a91](https://github.com/Whamp/pi-gcc/commit/cf46a91))
- Add required YAML frontmatter to GCC skill ([01c5fce](https://github.com/Whamp/pi-gcc/commit/01c5fce))
- Wire subagent to gcc-committer agent definition, clean up dead code and listener leak ([a4ac546](https://github.com/Whamp/pi-gcc/commit/a4ac546))

### 💅 Refactors

- Remove before_agent_start GCC context injection ([824758e](https://github.com/Whamp/pi-gcc/commit/824758e))
- Stop dynamic root AGENTS updates from GCC runtime ([5feb5b0](https://github.com/Whamp/pi-gcc/commit/5feb5b0))
- Reduce gcc_context to status overview contract ([cbc71a4](https://github.com/Whamp/pi-gcc/commit/cbc71a4))
- Align GCC lifecycle hooks with canonical spec ([baef0a0](https://github.com/Whamp/pi-gcc/commit/baef0a0))
- ExecuteGccCommit returns subagent task instead of agent prompt ([aa30304](https://github.com/Whamp/pi-gcc/commit/aa30304))
- Move extractCommitBlocks to subagent module ([c0360bf](https://github.com/Whamp/pi-gcc/commit/c0360bf))

### 📖 Documentation

- Prepare for npm publish: add metadata, peer deps, LICENSE, exclude tests ([87cd48e](https://github.com/Whamp/pi-gcc/commit/87cd48e))
- Add agent guide and novice README quick start ([fd2b18a](https://github.com/Whamp/pi-gcc/commit/fd2b18a))
- Align GCC guidance with canonical cache-safe spec ([207ee93](https://github.com/Whamp/pi-gcc/commit/207ee93))
- Add gcc-committer subagent spec, agent definition, and implementation plan ([068513b](https://github.com/Whamp/pi-gcc/commit/068513b))
- Add manual E2E test plan with first run results ([5a29e19](https://github.com/Whamp/pi-gcc/commit/5a29e19))

### 🏡 Chore

- Add .worktrees to gitignore ([997f8e8](https://github.com/Whamp/pi-gcc/commit/997f8e8))
- Delete commit-flow module (replaced by subagent) ([68e3f1c](https://github.com/Whamp/pi-gcc/commit/68e3f1c))

### ✅ Tests

- Add GCC module integration test ([8f5514e](https://github.com/Whamp/pi-gcc/commit/8f5514e))
- Add extractFinalText coverage for pi JSON output parsing ([fcf0d4f](https://github.com/Whamp/pi-gcc/commit/fcf0d4f))
- Update index tests for subagent commit flow, remove agent_end commit test ([ffd84c9](https://github.com/Whamp/pi-gcc/commit/ffd84c9))
- Update integration test for new executeGccCommit return type ([404d344](https://github.com/Whamp/pi-gcc/commit/404d344))
