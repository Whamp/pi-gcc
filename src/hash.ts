import { randomBytes } from "node:crypto";

/**
 * Generate an 8-character lowercase hex hash for memory commits.
 */
export function generateHash(): string {
  return randomBytes(4).toString("hex");
}
