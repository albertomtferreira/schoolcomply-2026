export const TRAINING_TRACK_MODULE_ID = "trainingTrack" as const;

export type TrainingTrackCollection = "trainingTypes" | "trainingRecords" | "auditLogs";

export type TrainingTrackReadMode = "module";

export type TrainingTrackPathTargets = {
  readMode: TrainingTrackReadMode;
  writeTargets: Array<TrainingTrackReadMode>;
};

function orgBasePath(orgId: string): string {
  return `organisations/${orgId}`;
}

function moduleCollectionPath(orgId: string, collection: TrainingTrackCollection): string {
  return `${orgBasePath(orgId)}/modules/${TRAINING_TRACK_MODULE_ID}/${collection}`;
}

export function getTrainingTrackCollectionPath(
  orgId: string,
  collection: TrainingTrackCollection,
  mode: TrainingTrackReadMode,
): string {
  void mode;
  return moduleCollectionPath(orgId, collection);
}

export function getTrainingTrackPathTargets(): TrainingTrackPathTargets {
  return { readMode: "module", writeTargets: ["module"] };
}

export function getTrainingTrackDocumentPath(
  orgId: string,
  collection: TrainingTrackCollection,
  docId: string,
  mode: TrainingTrackReadMode,
): string {
  return `${getTrainingTrackCollectionPath(orgId, collection, mode)}/${docId}`;
}
