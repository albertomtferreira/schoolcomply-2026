"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { auth, connectClientEmulators, db } from "@/lib/firebase/client";
import { MODULE_HEALTH_LABELS, type ModuleState } from "@/lib/modules/catalog";
import {
  toModuleHealthView,
  type ModuleHealthView,
  type ModuleReasonCode,
} from "@/lib/modules/moduleHealth";

const ORG_ID_STORAGE_KEY = "schooltrack.orgId";

const REASON_CODE_LABELS: Record<ModuleReasonCode, string> = {
  missing_required_record: "Missing required record",
  expired_required_record: "Expired required record",
  expiring_soon_required_record: "Expiring soon required record",
  no_active_staff: "No active staff",
};

type DrilldownState = {
  loading: boolean;
  error: string | null;
  health: ModuleHealthView;
};

const DEFAULT_HEALTH: ModuleHealthView = {
  state: "grey",
  lastCalculatedAtLabel: "Last updated unavailable",
  reasonCodes: ["no_active_staff"],
  summary: "Data unavailable",
  ruleIds: [],
};

export function ModuleHealthDrilldown({ moduleId }: { moduleId: string }) {
  const [state, setState] = useState<DrilldownState>({
    loading: true,
    error: null,
    health: DEFAULT_HEALTH,
  });

  useEffect(() => {
    let cancelled = false;
    connectClientEmulators();

    const resolveOrgId = async (uid: string): Promise<string | null> => {
      const storedOrgId = window.localStorage.getItem(ORG_ID_STORAGE_KEY);
      if (storedOrgId) {
        return storedOrgId;
      }

      const usersQuery = query(
        collectionGroup(db, "users"),
        where("uid", "==", uid),
        limit(1),
      );
      const usersSnap = await getDocs(usersQuery);
      const profileDoc = usersSnap.docs[0];
      if (!profileDoc) {
        return null;
      }

      const profileData = profileDoc.data();
      return typeof profileData.orgId === "string" ? profileData.orgId : null;
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setState({
            loading: false,
            error: "You must be signed in to view module health details.",
            health: DEFAULT_HEALTH,
          });
        }
        return;
      }

      try {
        const orgId = await resolveOrgId(user.uid);
        if (!orgId) {
          throw new Error("Organisation scope is unavailable.");
        }

        const healthRef = doc(db, `organisations/${orgId}/moduleHealth/${moduleId}`);
        const healthSnap = await getDoc(healthRef);
        const mapped = toModuleHealthView(
          healthSnap.exists() ? (healthSnap.data() as Record<string, unknown>) : undefined,
        );

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            health: mapped,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            loading: false,
            error: "Unable to load module health details.",
            health: DEFAULT_HEALTH,
          });
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [moduleId]);

  const reasonCodes = useMemo(() => state.health.reasonCodes, [state.health.reasonCodes]);
  const isNonGreen = state.health.state !== "green";

  return (
    <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Health Drill-Down
      </p>
      <p className="mt-2 text-sm text-slate-200">
        State: {MODULE_HEALTH_LABELS[state.health.state as ModuleState]}
      </p>
      <p className="mt-1 text-xs text-slate-400">{state.health.lastCalculatedAtLabel}</p>

      {state.loading ? (
        <p className="mt-3 text-sm text-slate-300">Loading module health details...</p>
      ) : null}

      {state.error ? <p className="mt-3 text-sm text-rose-300">{state.error}</p> : null}

      {!state.loading && !state.error && isNonGreen ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-200">Reason codes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {reasonCodes.map((reasonCode) => (
              <li key={reasonCode}>
                <span className="font-medium text-slate-100">{reasonCode}</span>
                <span className="ml-2 text-slate-400">
                  ({REASON_CODE_LABELS[reasonCode]})
                </span>
              </li>
            ))}
          </ul>
          {state.health.summary ? (
            <p className="mt-3 text-sm text-slate-300">Summary: {state.health.summary}</p>
          ) : null}
          {state.health.ruleIds.length > 0 ? (
            <p className="mt-2 text-xs text-slate-400">
              Rule IDs: {state.health.ruleIds.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {!state.loading && !state.error && !isNonGreen ? (
        <p className="mt-3 text-sm text-emerald-300">No active reasons for this module.</p>
      ) : null}
    </div>
  );
}
