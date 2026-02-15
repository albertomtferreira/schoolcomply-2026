import { notFound } from "next/navigation";

import { ModuleHealthDrilldown } from "@/components/platform/module-health-drilldown";
import { TrainingComplianceDashboard } from "@/components/training-track/training-compliance-dashboard";
import { TrainingRecordsManager } from "@/components/training-track/training-records-manager";
import { TrainingTypesManager } from "@/components/training-track/training-types-manager";
import { MODULE_CATALOG } from "@/lib/modules/catalog";

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ schoolId?: string }>;
}) {
  const { moduleId } = await params;
  const { schoolId } = await searchParams;
  const moduleItem = MODULE_CATALOG.find((item) => item.id === moduleId);

  if (!moduleItem) {
    notFound();
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Module Workspace
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">
        {moduleItem.label}
      </h1>
      <p className="mt-3 max-w-2xl text-slate-300">{moduleItem.description}</p>

      <div className="mt-8 rounded-lg border border-slate-800 bg-slate-950 p-5">
        <p className="text-sm text-slate-300">
          This route is mounted at <code className="text-slate-100">/app/{moduleId}</code>.
          Module-specific content will be delivered here as each story in Phase 1
          is implemented.
        </p>
        <p className="mt-3 text-sm text-slate-300">
          Active school scope:{" "}
          <code className="text-slate-100">{schoolId ?? "not selected"}</code>
        </p>
      </div>

      <ModuleHealthDrilldown moduleId={moduleId} />

      {moduleId === "trainingTrack" ? <TrainingTypesManager /> : null}
      {moduleId === "trainingTrack" ? (
        <TrainingComplianceDashboard selectedSchoolId={schoolId ?? null} />
      ) : null}
      {moduleId === "trainingTrack" ? (
        <TrainingRecordsManager schoolId={schoolId ?? null} />
      ) : null}
    </section>
  );
}
