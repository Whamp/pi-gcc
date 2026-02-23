describe("extension", () => {
  it("exports a default function", async () => {
    const mod = await import("./index.js");
    expectTypeOf(mod.default).toBeFunction();
  });
});
