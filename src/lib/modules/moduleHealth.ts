import type { ModuleState } from "@/lib/modules/catalog";

export type ModuleReasonCode =
  | "missing_required_record"
  | "expired_required_record"
  | "expiring_soon_required_record"
  | "no_active_staff";

export type ModuleHealthView = {
  state: ModuleState;
  lastCalculatedAtLabel: string;
  reasonCodes: ModuleReasonCode[];
  summary: string | null;
  ruleIds: string[];
};

const STATE_PRIORITY: Record<ModuleState, number> = {
  red: 0,
  amber: 1,
  green: 2,
  grey: 3,
};

function isModuleState(value: unknown): value is ModuleState {
  return (
    typeof value === "string" &&
    (value === "green" || value === "amber" || value === "red" || value === "grey")
  );
}

function isReasonCode(value: unknown): value is ModuleReasonCode {
  return (
    value === "missing_required_record" ||
    value === "expired_required_record" ||
    value === "expiring_soon_required_record" ||
    value === "no_active_staff"
  );
}

function fallbackReasonCodes(state: ModuleState): ModuleReasonCode[] {
  switch (state) {
    case "red":
      return ["missing_required_record"];
    case "amber":
      return ["expiring_soon_required_record"];
    case "grey":
      return ["no_active_staff"];
    default:
      return [];
  }
}

export function formatLastUpdatedLabel(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return `Last updated ${date.toLocaleString()}`;
  }

  return "Last updated unavailable";
}

export function toModuleHealthView(
  data: Record<string, unknown> | undefined,
): ModuleHealthView {
  const state = isModuleState(data?.state) ? data.state : "grey";
  const reasonCodesFromData = Array.isArray(data?.reasonCodes)
    ? data.reasonCodes.filter(isReasonCode)
    : [];
  const ruleIds = Array.isArray(data?.ruleIds)
    ? data.ruleIds.filter((value): value is string => typeof value === "string")
    : [];

  return {
    state,
    lastCalculatedAtLabel: formatLastUpdatedLabel(data?.lastCalculatedAt),
    reasonCodes:
      reasonCodesFromData.length > 0 ? reasonCodesFromData : fallbackReasonCodes(state),
    summary: typeof data?.summary === "string" ? data.summary : null,
    ruleIds,
  };
}

export function compareModuleHealthPriority(
  leftState: ModuleState,
  rightState: ModuleState,
  leftLabel: string,
  rightLabel: string,
): number {
  const byState = STATE_PRIORITY[leftState] - STATE_PRIORITY[rightState];
  if (byState !== 0) {
    return byState;
  }

  return leftLabel.localeCompare(rightLabel);
}
