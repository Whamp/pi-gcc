import * as fs from "node:fs";
import * as path from "node:path";

import { parseYaml, serializeYaml } from "./yaml.js";

interface LastCommit {
  branch: string;
  hash: string;
  timestamp: string;
  summary: string;
}

interface SessionRecord {
  file: string;
  branch: string;
  started: string;
}

type PersistedValue =
  | string
  | Record<string, string>
  | Array<Record<string, string>>;

export class GccState {
  private readonly statePath: string;
  private readonly gccDir: string;
  activeBranch = "main";
  initialized = "";
  lastCommit: LastCommit | null = null;
  sessions: SessionRecord[] = [];

  constructor(projectDir: string) {
    this.gccDir = path.join(projectDir, ".gcc");
    this.statePath = path.join(this.gccDir, "state.yaml");
  }

  get isInitialized(): boolean {
    return this.initialized !== "";
  }

  load(): void {
    if (!fs.existsSync(this.statePath)) {
      return;
    }

    const content = fs.readFileSync(this.statePath, "utf8");
    if (content.trim() === "") {
      return;
    }

    const data = parseYaml(content);

    if (typeof data.active_branch === "string") {
      this.activeBranch = data.active_branch;
    }

    if (typeof data.initialized === "string") {
      this.initialized = data.initialized;
    }

    if (typeof data.last_commit === "object" && data.last_commit !== null) {
      const lastCommit = data.last_commit;
      if (!Array.isArray(lastCommit)) {
        this.lastCommit = {
          branch: lastCommit.branch ?? "",
          hash: lastCommit.hash ?? "",
          timestamp: lastCommit.timestamp ?? "",
          summary: lastCommit.summary ?? "",
        };
      }
    }

    if (Array.isArray(data.sessions)) {
      this.sessions = data.sessions
        .map((item) => {
          const file = item.file ?? "";
          const branch = item.branch ?? "";
          const started = item.started ?? "";
          if (file === "" || branch === "" || started === "") {
            return null;
          }

          return { file, branch, started };
        })
        .filter((item): item is SessionRecord => item !== null);
    }
  }

  setActiveBranch(branch: string): void {
    this.activeBranch = branch;
  }

  setLastCommit(
    branch: string,
    hash: string,
    timestamp: string,
    summary: string
  ): void {
    this.lastCommit = { branch, hash, timestamp, summary };
  }

  upsertSession(file: string, branch: string, started: string): void {
    const existing = this.sessions.find((session) => session.file === file);
    if (existing) {
      existing.branch = branch;
      if (existing.started === "") {
        existing.started = started;
      }
      return;
    }

    this.sessions.push({ file, branch, started });
  }

  save(): void {
    const data: Record<string, PersistedValue> = {
      active_branch: this.activeBranch,
    };

    if (this.initialized) {
      data.initialized = this.initialized;
    }

    if (this.lastCommit) {
      data.last_commit = {
        branch: this.lastCommit.branch,
        hash: this.lastCommit.hash,
        timestamp: this.lastCommit.timestamp,
        summary: this.lastCommit.summary,
      };
    }

    if (this.sessions.length > 0) {
      data.sessions = this.sessions.map((session) => ({
        file: session.file,
        branch: session.branch,
        started: session.started,
      }));
    }

    fs.writeFileSync(this.statePath, serializeYaml(data));
  }
}
