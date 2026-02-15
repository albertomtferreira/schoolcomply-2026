export type TrainingRecordCompliance = {
  status: "valid" | "expiring" | "expired";
  daysToExpiry: number | null;
  expiresAtIso: string | null;
  ruleId: string;
  reasonCode: string;
  rulePath: string;
};

const EXPIRING_SOON_DAYS = 30;

function startOfDayUtc(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function parseDateInput(value: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function deriveExpiryDate(
  issuedAtInput: string,
  defaultValidityDays: number | null,
): string | null {
  if (!issuedAtInput || !defaultValidityDays || defaultValidityDays <= 0) {
    return null;
  }
  const issuedAt = parseDateInput(issuedAtInput);
  if (!issuedAt) {
    return null;
  }

  return addDays(startOfDayUtc(issuedAt), defaultValidityDays).toISOString();
}

export function evaluateTrainingRecordCompliance(
  expires: boolean,
  expiresAtInput: string | null,
  now: Date = new Date(),
): TrainingRecordCompliance {
  if (!expires) {
    return {
      status: "valid",
      daysToExpiry: null,
      expiresAtIso: null,
      ruleId: "CDT-2-NONEXPIRING-PRESENT",
      reasonCode: "non_expiring_record_present",
      rulePath: "Section 2 Notes",
    };
  }

  const expiresAt = parseDateInput(expiresAtInput ?? "");
  if (!expiresAt) {
    return {
      status: "expired",
      daysToExpiry: null,
      expiresAtIso: null,
      ruleId: "CDT-2-MISSING-EXPIRES-AT",
      reasonCode: "expired_required_record",
      rulePath: "Section 2 Record Status Rules",
    };
  }

  const expiresAtDay = startOfDayUtc(expiresAt);
  const nowDay = startOfDayUtc(now);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysToExpiry = Math.floor((expiresAtDay.getTime() - nowDay.getTime()) / msPerDay);

  if (daysToExpiry < 0) {
    return {
      status: "expired",
      daysToExpiry,
      expiresAtIso: expiresAtDay.toISOString(),
      ruleId: "CDT-2-EXPIRED",
      reasonCode: "expired_required_record",
      rulePath: "Section 2 Record Status Rules",
    };
  }

  if (daysToExpiry <= EXPIRING_SOON_DAYS) {
    return {
      status: "expiring",
      daysToExpiry,
      expiresAtIso: expiresAtDay.toISOString(),
      ruleId: "CDT-2-EXPIRING",
      reasonCode: "expiring_soon_required_record",
      rulePath: "Section 2 Record Status Rules",
    };
  }

  return {
    status: "valid",
    daysToExpiry,
    expiresAtIso: expiresAtDay.toISOString(),
    ruleId: "CDT-2-VALID",
    reasonCode: "record_valid",
    rulePath: "Section 2 Record Status Rules",
  };
}
