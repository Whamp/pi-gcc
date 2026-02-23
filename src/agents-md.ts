import * as fs from "node:fs";
import * as path from "node:path";

const GCC_SECTION_START = "## GCC — Git Context Controller";

function buildGccSection(branch: string, summary: string): string {
  return [
    GCC_SECTION_START,
    "",
    "This project uses GCC for agent memory management.",
    `Current branch: ${branch} | Latest milestone: ${summary}`,
    "Call `gcc_context` to load full project state.",
    "See `.gcc/AGENTS.md` for the full GCC protocol reference.",
  ].join("\n");
}

/**
 * Update the root AGENTS.md with the current GCC state.
 * Replaces existing GCC section or appends if missing.
 * Creates the file if it doesn't exist.
 */
export function updateRootAgentsMd(
  projectDir: string,
  branch: string,
  summary: string
): void {
  const agentsPath = path.join(projectDir, "AGENTS.md");
  const newSection = buildGccSection(branch, summary);

  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, `${newSection}\n`);
    return;
  }

  const content = fs.readFileSync(agentsPath, "utf8");

  if (!content.includes(GCC_SECTION_START)) {
    const separator = content.endsWith("\n") ? "\n" : "\n\n";
    fs.writeFileSync(agentsPath, `${content}${separator}${newSection}\n`);
    return;
  }

  // Replace existing GCC section: from header to next ## heading or EOF
  const pattern = /## GCC — Git Context Controller\n[\s\S]*?(?=\n## (?!GCC)|$)/;
  const replaced = content.replace(pattern, newSection);
  fs.writeFileSync(agentsPath, replaced);
}
