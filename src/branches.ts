import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Manages `.gcc/branches/` directory operations.
 * Each branch has: log.md, commits.md, metadata.yaml.
 */
export class BranchManager {
  private readonly branchesDir: string;

  constructor(projectDir: string) {
    this.branchesDir = path.join(projectDir, ".gcc", "branches");
  }

  createBranch(name: string, purpose: string): void {
    const branchDir = path.join(this.branchesDir, name);
    fs.mkdirSync(branchDir, { recursive: true });
    fs.writeFileSync(path.join(branchDir, "log.md"), "");
    fs.writeFileSync(
      path.join(branchDir, "commits.md"),
      `# ${name}\n\n**Purpose:** ${purpose}\n`
    );
    fs.writeFileSync(path.join(branchDir, "metadata.yaml"), "");
  }

  appendLog(branch: string, content: string): void {
    const logPath = this.logPath(branch);
    fs.appendFileSync(logPath, content);
  }

  readLog(branch: string): string {
    const logPath = this.logPath(branch);
    if (!fs.existsSync(logPath)) {
      return "";
    }
    return fs.readFileSync(logPath, "utf8");
  }

  clearLog(branch: string): void {
    const logPath = this.logPath(branch);
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, "");
    }
  }

  appendCommit(branch: string, entry: string): void {
    const commitsPath = this.commitsPath(branch);
    fs.appendFileSync(commitsPath, entry);
  }

  readCommits(branch: string): string {
    const commitsPath = this.commitsPath(branch);
    if (!fs.existsSync(commitsPath)) {
      return "";
    }
    return fs.readFileSync(commitsPath, "utf8");
  }

  readMetadata(branch: string): string {
    const metaPath = path.join(this.branchesDir, branch, "metadata.yaml");
    if (!fs.existsSync(metaPath)) {
      return "";
    }
    return fs.readFileSync(metaPath, "utf8");
  }

  listBranches(): string[] {
    if (!fs.existsSync(this.branchesDir)) {
      return [];
    }

    return fs.readdirSync(this.branchesDir).filter((entry) => {
      const fullPath = path.join(this.branchesDir, entry);
      return fs.statSync(fullPath).isDirectory();
    });
  }

  branchExists(name: string): boolean {
    const branchDir = path.join(this.branchesDir, name);
    return fs.existsSync(branchDir) && fs.statSync(branchDir).isDirectory();
  }

  getLogTurnCount(branch: string): number {
    const log = this.readLog(branch);
    if (log === "") {
      return 0;
    }
    const matches = log.match(/^## Turn /gm);
    return matches ? matches.length : 0;
  }

  getLatestCommit(branch: string): string | null {
    const commits = this.readCommits(branch);
    if (commits === "") {
      return null;
    }

    // Split on commit separator (--- followed by ## Commit)
    const parts = commits.split(/\n---\n/);
    // Find the last part that contains a commit header
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].includes("## Commit ")) {
        return parts[i].trim();
      }
    }

    return null;
  }

  private logPath(branch: string): string {
    return path.join(this.branchesDir, branch, "log.md");
  }

  private commitsPath(branch: string): string {
    return path.join(this.branchesDir, branch, "commits.md");
  }
}
