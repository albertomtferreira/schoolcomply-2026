"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { auth, connectClientEmulators, db } from "@/lib/firebase/client";

const ORG_ID_STORAGE_KEY = "schooltrack.orgId";

type StaffRow = {
  id: string;
  fullName: string;
  employmentRole: string;
  schoolIds: string[];
};

type SchoolRow = {
  id: string;
  name: string;
};

type TrainingTypeRow = {
  id: string;
  name: string;
};

type RecordRow = {
  id: string;
  staffId: string;
  schoolId: string;
  trainingTypeId: string;
  status: "valid" | "expiring" | "expired";
  complianceRuleId: string | null;
  complianceReasonCode: string | null;
};

type Summary = {
  compliantCount: number;
  expiringSoonCount: number;
  nonCompliantCount: number;
};

type FreshnessInfo = {
  label: string;
  stale: boolean;
};

async function resolveOrgId(user: User): Promise<string | null> {
  const token = await user.getIdTokenResult();
  const tokenOrgId =
    typeof token.claims.orgId === "string" ? token.claims.orgId : null;
  if (tokenOrgId) {
    window.localStorage.setItem(ORG_ID_STORAGE_KEY, tokenOrgId);
    return tokenOrgId;
  }

  const storedOrgId = window.localStorage.getItem(ORG_ID_STORAGE_KEY);
  if (storedOrgId) {
    return storedOrgId;
  }

  const usersQuery = query(
    collectionGroup(db, "users"),
    where("uid", "==", user.uid),
    limit(1),
  );
  const usersSnap = await getDocs(usersQuery);
  const profileDoc = usersSnap.docs[0];
  if (!profileDoc) {
    return null;
  }

  const profileData = profileDoc.data();
  const orgId =
    typeof profileData.orgId === "string" && profileData.orgId.length > 0
      ? profileData.orgId
      : null;
  if (orgId) {
    window.localStorage.setItem(ORG_ID_STORAGE_KEY, orgId);
  }
  return orgId;
}

function toSummary(rows: RecordRow[]): Summary {
  return rows.reduce<Summary>(
    (acc, row) => {
      if (row.status === "valid") {
        acc.compliantCount += 1;
      } else if (row.status === "expiring") {
        acc.expiringSoonCount += 1;
      } else {
        acc.nonCompliantCount += 1;
      }
      return acc;
    },
    {
      compliantCount: 0,
      expiringSoonCount: 0,
      nonCompliantCount: 0,
    },
  );
}

function toFreshnessInfo(value: unknown): FreshnessInfo {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    const ageMs = Date.now() - date.getTime();
    const stale = ageMs > 24 * 60 * 60 * 1000;
    return {
      label: `Last updated ${date.toLocaleString()}`,
      stale,
    };
  }

  return {
    label: "Last updated unavailable",
    stale: true,
  };
}

export function TrainingComplianceDashboard({
  selectedSchoolId,
}: {
  selectedSchoolId: string | null;
}) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [types, setTypes] = useState<TrainingTypeRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [orgFreshness, setOrgFreshness] = useState<FreshnessInfo>({
    label: "Last updated unavailable",
    stale: true,
  });
  const [schoolFreshness, setSchoolFreshness] = useState<FreshnessInfo>({
    label: "Last updated unavailable",
    stale: true,
  });
  const [moduleFreshness, setModuleFreshness] = useState<FreshnessInfo>({
    label: "Last updated unavailable",
    stale: true,
  });

  const [schoolFilter, setSchoolFilter] = useState<string>("scope");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [trainingTypeFilter, setTrainingTypeFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    connectClientEmulators();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setLoading(false);
          setError("Sign in to view compliance dashboard.");
        }
        return;
      }

      try {
        const resolvedOrgId = await resolveOrgId(user);
        if (!resolvedOrgId) {
          throw new Error("No organisation scope found.");
        }
        if (!cancelled) {
          setOrgId(resolvedOrgId);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError("Unable to resolve organisation scope.");
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    const unsubscribeSchools = onSnapshot(
      collection(db, `organisations/${orgId}/schools`),
      (snapshot) => {
        setSchools(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: typeof data.name === "string" ? data.name : docSnap.id,
            };
          }),
        );
      },
      () => setError("Failed to load schools."),
    );

    const unsubscribeStaff = onSnapshot(
      collection(db, `organisations/${orgId}/staff`),
      (snapshot) => {
        setStaff(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              fullName:
                typeof data.fullName === "string" ? data.fullName : docSnap.id,
              employmentRole:
                typeof data.employmentRole === "string"
                  ? data.employmentRole
                  : "unknown",
              schoolIds: Array.isArray(data.schoolIds)
                ? data.schoolIds.filter(
                    (value): value is string => typeof value === "string",
                  )
                : [],
            };
          }),
        );
      },
      () => setError("Failed to load staff."),
    );

    const unsubscribeTypes = onSnapshot(
      collection(db, `organisations/${orgId}/modules/trainingTrack/trainingTypes`),
      (snapshot) => {
        setTypes(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: typeof data.name === "string" ? data.name : docSnap.id,
            };
          }),
        );
      },
      () => setError("Failed to load training types."),
    );

    const unsubscribeRecords = onSnapshot(
      collection(db, `organisations/${orgId}/modules/trainingTrack/trainingRecords`),
      (snapshot) => {
        setRecords(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              staffId: typeof data.staffId === "string" ? data.staffId : "",
              schoolId: typeof data.schoolId === "string" ? data.schoolId : "",
              trainingTypeId:
                typeof data.trainingTypeId === "string" ? data.trainingTypeId : "",
              status:
                data.status === "valid" ||
                data.status === "expiring" ||
                data.status === "expired"
                  ? data.status
                  : "expired",
              complianceRuleId:
                typeof data.complianceRuleId === "string"
                  ? data.complianceRuleId
                  : null,
              complianceReasonCode:
                typeof data.complianceReasonCode === "string"
                  ? data.complianceReasonCode
                  : null,
            } satisfies RecordRow;
          }),
        );
      },
      () => setError("Failed to load training records."),
    );

    return () => {
      unsubscribeSchools();
      unsubscribeStaff();
      unsubscribeTypes();
      unsubscribeRecords();
    };
  }, [orgId]);

  const byStaffId = useMemo(() => new Map(staff.map((item) => [item.id, item])), [staff]);
  const byTypeId = useMemo(() => new Map(types.map((item) => [item.id, item])), [types]);
  const bySchoolId = useMemo(
    () => new Map(schools.map((item) => [item.id, item])),
    [schools],
  );

  const effectiveSchoolFilter =
    schoolFilter === "scope" ? selectedSchoolId ?? "all" : schoolFilter;

  useEffect(() => {
    if (!orgId) {
      return;
    }

    const unsubscribeOrgAgg = onSnapshot(
      doc(db, `organisations/${orgId}/aggregates/orgCompliance`),
      (snap) => {
        setOrgFreshness(toFreshnessInfo(snap.data()?.lastCalculatedAt));
      },
      () =>
        setOrgFreshness({
          label: "Last updated unavailable",
          stale: true,
        }),
    );

    const unsubscribeModuleHealth = onSnapshot(
      doc(db, `organisations/${orgId}/moduleHealth/trainingTrack`),
      (snap) => {
        setModuleFreshness(toFreshnessInfo(snap.data()?.lastCalculatedAt));
      },
      () =>
        setModuleFreshness({
          label: "Last updated unavailable",
          stale: true,
        }),
    );

    return () => {
      unsubscribeOrgAgg();
      unsubscribeModuleHealth();
    };
  }, [orgId]);

  useEffect(() => {
    if (!orgId || effectiveSchoolFilter === "all") {
      setSchoolFreshness({
        label: "Last updated unavailable",
        stale: true,
      });
      return;
    }

    const unsubscribeSchoolAgg = onSnapshot(
      doc(db, `organisations/${orgId}/aggregates/school_${effectiveSchoolFilter}`),
      (snap) => {
        setSchoolFreshness(toFreshnessInfo(snap.data()?.lastCalculatedAt));
      },
      () =>
        setSchoolFreshness({
          label: "Last updated unavailable",
          stale: true,
        }),
    );

    return unsubscribeSchoolAgg;
  }, [effectiveSchoolFilter, orgId]);

  const recordsByRoleAndType = useMemo(
    () =>
      records.filter((record) => {
        if (roleFilter !== "all") {
          const staffItem = byStaffId.get(record.staffId);
          if (!staffItem || staffItem.employmentRole !== roleFilter) {
            return false;
          }
        }
        if (trainingTypeFilter !== "all" && record.trainingTypeId !== trainingTypeFilter) {
          return false;
        }
        return true;
      }),
    [byStaffId, records, roleFilter, trainingTypeFilter],
  );

  const recordsForSchoolSummary = useMemo(
    () =>
      recordsByRoleAndType.filter((record) =>
        effectiveSchoolFilter === "all"
          ? true
          : record.schoolId === effectiveSchoolFilter,
      ),
    [effectiveSchoolFilter, recordsByRoleAndType],
  );

  const orgSummary = useMemo(() => toSummary(recordsByRoleAndType), [recordsByRoleAndType]);
  const schoolSummary = useMemo(
    () => toSummary(recordsForSchoolSummary),
    [recordsForSchoolSummary],
  );

  const roleOptions = useMemo(
    () => Array.from(new Set(staff.map((item) => item.employmentRole))).sort(),
    [staff],
  );

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Compliance Dashboard
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-100">
        Org and school training compliance
      </h2>

      {orgFreshness.stale || moduleFreshness.stale || (effectiveSchoolFilter !== "all" && schoolFreshness.stale) ? (
        <p className="mt-2 rounded-md border border-amber-600 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          Freshness warning: one or more aggregates are older than 24h or unavailable.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-300">
          School filter
          <select
            value={schoolFilter}
            onChange={(event) => setSchoolFilter(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="scope">Scope school</option>
            <option value="all">All schools</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Staff role filter
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">All roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Training type filter
          <select
            value={trainingTypeFilter}
            onChange={(event) => setTrainingTypeFilter(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">All training types</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
          <p className="text-sm font-medium text-slate-200">Org summary</p>
          <p className="mt-1 text-xs text-slate-400">{orgFreshness.label}</p>
          <p className="mt-2 text-sm text-emerald-300">Compliant: {orgSummary.compliantCount}</p>
          <p className="text-sm text-amber-300">
            Expiring soon: {orgSummary.expiringSoonCount}
          </p>
          <p className="text-sm text-rose-300">
            Non-compliant: {orgSummary.nonCompliantCount}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
          <p className="text-sm font-medium text-slate-200">
            School summary{" "}
            {effectiveSchoolFilter !== "all"
              ? `(${bySchoolId.get(effectiveSchoolFilter)?.name ?? effectiveSchoolFilter})`
              : "(All schools)"}
          </p>
          <p className="mt-2 text-sm text-emerald-300">
            Compliant: {schoolSummary.compliantCount}
          </p>
          <p className="text-sm text-amber-300">
            Expiring soon: {schoolSummary.expiringSoonCount}
          </p>
          <p className="text-sm text-rose-300">
            Non-compliant: {schoolSummary.nonCompliantCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {effectiveSchoolFilter === "all"
              ? "Last updated unavailable"
              : schoolFreshness.label}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 md:col-span-2">
          <p className="text-sm font-medium text-slate-200">Module health freshness</p>
          <p className="mt-1 text-xs text-slate-400">{moduleFreshness.label}</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-300">
            <tr>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Training type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reason code</th>
              <th className="px-3 py-2">Rule ID</th>
            </tr>
          </thead>
          <tbody>
            {recordsForSchoolSummary.map((record) => (
              <tr key={record.id} className="border-t border-slate-800 text-slate-100">
                <td className="px-3 py-2">{byStaffId.get(record.staffId)?.fullName ?? "-"}</td>
                <td className="px-3 py-2">
                  {byStaffId.get(record.staffId)?.employmentRole ?? "-"}
                </td>
                <td className="px-3 py-2">{bySchoolId.get(record.schoolId)?.name ?? "-"}</td>
                <td className="px-3 py-2">
                  {byTypeId.get(record.trainingTypeId)?.name ?? "-"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      record.status === "expired"
                        ? "text-rose-300"
                        : record.status === "expiring"
                          ? "text-amber-300"
                          : "text-emerald-300"
                    }
                  >
                    {record.status}
                  </span>
                </td>
                <td className="px-3 py-2">{record.complianceReasonCode ?? "-"}</td>
                <td className="px-3 py-2">{record.complianceRuleId ?? "-"}</td>
              </tr>
            ))}
            {recordsForSchoolSummary.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-sm text-slate-400">
                  No records match current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {loading ? <p className="mt-3 text-sm text-slate-300">Loading dashboard...</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
