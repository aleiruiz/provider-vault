import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysUntil, mergeById, monthly, rotationIn } from "./logic.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T12:00:00"));
});
afterEach(() => vi.useRealTimers());

describe("monthly", () => {
  it("returns monthly costs as-is and spreads yearly ones", () => {
    expect(monthly({ cost: "20", period: "monthly", status: "active" })).toBe(20);
    expect(monthly({ cost: "120", period: "yearly", status: "active" })).toBe(10);
  });

  it("ignores free, planned, cancelled and missing costs", () => {
    expect(monthly({ cost: "20", period: "free", status: "active" })).toBe(0);
    expect(monthly({ cost: "20", period: "monthly", status: "planned" })).toBe(0);
    expect(monthly({ cost: "20", period: "monthly", status: "cancelled" })).toBe(0);
    expect(monthly({ cost: "", period: "monthly", status: "active" })).toBe(0);
  });
});

describe("daysUntil", () => {
  it("counts days to a future or past date", () => {
    expect(daysUntil("2026-10-16")).toBe(10);
    expect(daysUntil("2026-10-05")).toBe(-1);
    expect(daysUntil("2026-10-06")).toBe(0);
  });

  it("returns null without a date", () => {
    expect(daysUntil("")).toBeNull();
  });
});

describe("rotationIn", () => {
  it("is null when there is no schedule", () => {
    expect(rotationIn({ rotated: "", rotateDays: "90" })).toBeNull();
    expect(rotationIn({ rotated: "2026-09-01", rotateDays: "" })).toBeNull();
  });

  it("counts down to the next rotation and goes negative when overdue", () => {
    expect(rotationIn({ rotated: "2026-10-01", rotateDays: "30" })).toBe(25);
    expect(rotationIn({ rotated: "2026-06-01", rotateDays: "90" })).toBeLessThan(0);
  });
});

describe("mergeById", () => {
  const seed = [
    { id: "a", name: "A", notes: "from seed", projects: ["x"] },
    { id: "b", name: "B", notes: "", projects: [] },
  ];

  it("adds starter entries that are missing", () => {
    const merged = mergeById([{ id: "a", name: "A", notes: "mine", projects: ["y"] }], seed);
    expect(merged.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("never overwrites what the user typed", () => {
    const [a] = mergeById([{ id: "a", name: "Renamed", notes: "mine", projects: ["y"] }], seed);
    expect(a).toMatchObject({ name: "Renamed", notes: "mine", projects: ["y"] });
  });

  it("fills blank fields from the seed", () => {
    const [a] = mergeById([{ id: "a", name: "A", notes: "", projects: [] }], seed);
    expect(a).toMatchObject({ notes: "from seed", projects: ["x"] });
  });

  it("keeps entries that are not in the seed", () => {
    const merged = mergeById([{ id: "custom", name: "Mine" }], seed);
    expect(merged.map((r) => r.id)).toContain("custom");
  });
});
