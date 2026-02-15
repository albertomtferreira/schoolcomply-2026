export type ModuleState = "green" | "amber" | "red" | "grey";

export type ModuleDefinition = {
  id: string;
  label: string;
  description: string;
};

export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    id: "trainingTrack",
    label: "TrainingTrack",
    description: "Mandatory training records and expiry risk.",
  },
  {
    id: "statutoryTrack",
    label: "StatutoryTrack",
    description: "Statutory duties and legal action windows.",
  },
  {
    id: "clubTrack",
    label: "ClubTrack",
    description: "Extended provision and club compliance.",
  },
  {
    id: "coshhTrack",
    label: "COSHHTrack",
    description: "Hazardous substance register and controls.",
  },
];

export const MODULE_HEALTH_LABELS: Record<ModuleState, string> = {
  green: "Healthy",
  amber: "Needs attention",
  red: "High risk",
  grey: "No data",
};

export function isModuleId(value: string): boolean {
  return MODULE_CATALOG.some((moduleItem) => moduleItem.id === value);
}
