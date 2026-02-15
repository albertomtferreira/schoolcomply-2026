import { serverTimestamp } from "firebase/firestore";

type AuditAction = "create" | "update" | "delete";
type AuditEntityType = "staff" | "trainingRecord" | "trainingType";

type BuildAuditLogInput = {
  actorUserId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export function buildTrainingTrackAuditLog(input: BuildAuditLogInput): Record<string, unknown> {
  return {
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    moduleId: "trainingTrack",
    createdAt: serverTimestamp(),
    before: input.before ?? null,
    after: input.after ?? null,
  };
}
