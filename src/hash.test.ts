import fc from "fast-check";

import { generateHash } from "./hash.js";

describe("generateHash", () => {
  it("should return exactly 8 lowercase hex characters", () => {
    // Act
    const hash = generateHash();

    // Assert
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("should return different values on successive calls", () => {
    // Act
    const hashes = new Set(Array.from({ length: 10 }, () => generateHash()));

    // Assert
    // With 32-bit random hashes, 10 calls should produce at least 2 unique values
    expect(hashes.size).toBeGreaterThan(1);
  });

  it("should return a string of length 8", () => {
    // Act
    const hash = generateHash();

    // Assert
    expect(hash).toHaveLength(8);
  });
});

describe("generateHash property-based tests", () => {
  it("should always return exactly 8 lowercase hex characters", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Act
        const hash = generateHash();

        // Assert
        expect(hash).toMatch(/^[0-9a-f]{8}$/);
      })
    );
  });

  it("should produce highly unique values across many calls", () => {
    // Act
    const hashes = new Set(Array.from({ length: 100 }, () => generateHash()));

    // Assert
    expect(hashes.size).toBeGreaterThan(90);
  });
});
