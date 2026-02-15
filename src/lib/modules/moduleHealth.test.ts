import { describe, expect, it } from "vitest";

import {
  compareModuleHealthPriority,
  formatLastUpdatedLabel,
  toModuleHealthView,
} from "@/lib/modules/moduleHealth";

describe("moduleHealth indicator mapping", () => {
  it("maps seeded states directly for indicators", () => {
    const states = ["green", "amber", "red", "grey"] as const;

    for (const state of states) {
      const view = toModuleHealthView({
        state,
        lastCalculatedAt: { toDate: () => new Date("2026-02-15T12:00:00.000Z") },
      });

      expect(view.state).toBe(state);
      expect(view.lastCalculatedAtLabel.startsWith("Last updated ")).toBe(true);
    }
  });

  it("falls back to grey for invalid or missing state", () => {
    expect(toModuleHealthView({ state: "unknown" }).state).toBe("grey");
    expect(toModuleHealthView(undefined).state).toBe("grey");
  });

  it("returns unavailable freshness text when timestamp is missing", () => {
    expect(formatLastUpdatedLabel(undefined)).toBe("Last updated unavailable");
  });

  it("uses fallback reason codes for non-green states", () => {
    expect(toModuleHealthView({ state: "red" }).reasonCodes).toEqual([
      "missing_required_record",
    ]);
    expect(toModuleHealthView({ state: "amber" }).reasonCodes).toEqual([
      "expiring_soon_required_record",
    ]);
    expect(toModuleHealthView({ state: "grey" }).reasonCodes).toEqual([
      "no_active_staff",
    ]);
  });

  it("prefers explicit reason codes from moduleHealth docs", () => {
    const view = toModuleHealthView({
      state: "red",
      reasonCodes: ["expired_required_record", "missing_required_record"],
      ruleIds: ["CDT-3-NON-COMPLIANT-EXPIRED-OR-MISSING"],
      summary: "Required training has expired.",
    });

    expect(view.reasonCodes).toEqual([
      "expired_required_record",
      "missing_required_record",
    ]);
    expect(view.summary).toBe("Required training has expired.");
    expect(view.ruleIds).toEqual(["CDT-3-NON-COMPLIANT-EXPIRED-OR-MISSING"]);
  });

  it("orders states by risk priority red > amber > green > grey", () => {
    const ordered = ["grey", "green", "red", "amber"].sort((left, right) =>
      compareModuleHealthPriority(
        left as "green" | "amber" | "red" | "grey",
        right as "green" | "amber" | "red" | "grey",
        left,
        right,
      ),
    );

    expect(ordered).toEqual(["red", "amber", "green", "grey"]);
  });
});
