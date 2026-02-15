import { describe, expect, it } from "vitest";

import {
  deriveExpiryDate,
  evaluateTrainingRecordCompliance,
} from "@/lib/modules/trainingTrack/compliance";

describe("trainingTrack compliance logic", () => {
  it("derives expiry date from issued date + validity days", () => {
    const expiresAt = deriveExpiryDate("2026-01-01", 365);
    expect(expiresAt).toBe("2027-01-01T00:00:00.000Z");
  });

  it("marks non-expiring types as valid", () => {
    const result = evaluateTrainingRecordCompliance(
      false,
      null,
      new Date("2026-02-15T00:00:00.000Z"),
    );
    expect(result.status).toBe("valid");
    expect(result.daysToExpiry).toBeNull();
    expect(result.ruleId).toBe("CDT-2-NONEXPIRING-PRESENT");
  });

  it("marks missing expiry for expiring type as expired", () => {
    const result = evaluateTrainingRecordCompliance(
      true,
      null,
      new Date("2026-02-15T00:00:00.000Z"),
    );
    expect(result.status).toBe("expired");
    expect(result.reasonCode).toBe("expired_required_record");
  });

  it("marks record as expiring within 30-day window", () => {
    const result = evaluateTrainingRecordCompliance(
      true,
      "2026-03-01",
      new Date("2026-02-15T00:00:00.000Z"),
    );
    expect(result.status).toBe("expiring");
    expect(result.daysToExpiry).toBe(14);
    expect(result.ruleId).toBe("CDT-2-EXPIRING");
  });

  it("marks record as expired when expiry is in the past", () => {
    const result = evaluateTrainingRecordCompliance(
      true,
      "2026-02-10",
      new Date("2026-02-15T00:00:00.000Z"),
    );
    expect(result.status).toBe("expired");
    expect(result.daysToExpiry).toBe(-5);
    expect(result.ruleId).toBe("CDT-2-EXPIRED");
  });

  it("marks record as valid when expiry is outside warning window", () => {
    const result = evaluateTrainingRecordCompliance(
      true,
      "2026-05-01",
      new Date("2026-02-15T00:00:00.000Z"),
    );
    expect(result.status).toBe("valid");
    expect(result.daysToExpiry).toBeGreaterThan(30);
    expect(result.ruleId).toBe("CDT-2-VALID");
  });
});
