import { generateHash } from "./hash.js";

describe("generateHash", () => {
  it("returns exactly 8 lowercase hex characters", () => {
    const hash = generateHash();
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns different values on successive calls", () => {
    const hashes = new Set(Array.from({ length: 10 }, () => generateHash()));
    // With 32-bit random hashes, 10 calls should produce at least 2 unique values
    expect(hashes.size).toBeGreaterThan(1);
  });

  it("returns a string of length 8", () => {
    const hash = generateHash();
    expect(hash).toHaveLength(8);
  });
});
