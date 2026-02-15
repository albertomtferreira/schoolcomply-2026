"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  where,
} from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { auth, connectClientEmulators, db } from "@/lib/firebase/client";
import { refreshTrainingTrackAggregates } from "@/lib/modules/trainingTrack/aggregatesClient";
import { buildTrainingTrackAuditLog } from "@/lib/modules/trainingTrack/auditClient";
import {
  deriveExpiryDate,
  evaluateTrainingRecordCompliance,
} from "@/lib/modules/trainingTrack/compliance";

const ORG_ID_STORAGE_KEY = "schooltrack.orgId";

type TrainingTypeOption = {
  id: string;
  name: string;
  expires: boolean;
  defaultValidityDays: number | null;
};

type StaffOption = {
  id: string;
  fullName: string;
  schoolIds: string[];
};

type RecordDraft = {
  staffId: string;
  trainingTypeId: string;
  issuedAt: string;
  expiresAt: string;
  provider: string;
  notes: string;
};

type TrainingRecordRow = {
  id: string;
  staffName: string;
  staffId: string;
  trainingTypeName: string;
  trainingTypeId: string;
  status: "valid" | "expiring" | "expired";
  daysToExpiry: number | null;
  schoolId: string;
  issuedAt: string | null;
  expiresAt: string | null;
  complianceRuleId: string | null;
  complianceReasonCode: string | null;
};

const EMPTY_DRAFT: RecordDraft = {
  staffId: "",
  trainingTypeId: "",
  issuedAt: "",
  expiresAt: "",
  provider: "",
  notes: "",
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

function toIsoFromDateInput(value: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function TrainingRecordsManager({ schoolId }: { schoolId: string | null }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [types, setTypes] = useState<TrainingTypeOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [records, setRecords] = useState<TrainingRecordRow[]>([]);
  const [draft, setDraft] = useState<RecordDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<RecordDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    connectClientEmulators();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setOrgId(null);
          setCurrentUserUid("");
          setLoading(false);
          setError("Sign in to manage training records.");
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
          setCurrentUserUid(user.uid);
          setCurrentUser(user);
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

    const unsubscribeTypes = onSnapshot(
      query(
        collection(db, `organisations/${orgId}/modules/trainingTrack/trainingTypes`),
        orderBy("updatedAt", "desc"),
      ),
      (snapshot) => {
        const mapped = snapshot.docs.map((snap) => {
          const data = snap.data();
          return {
            id: snap.id,
            name: typeof data.name === "string" ? data.name : "Unnamed type",
            expires: data.expires !== false,
            defaultValidityDays:
              typeof data.defaultValidityDays === "number"
                ? data.defaultValidityDays
                : null,
          } satisfies TrainingTypeOption;
        });
        setTypes(mapped);
      },
      () => setError("Failed to load training types."),
    );

    const unsubscribeStaff = onSnapshot(
      query(collection(db, `organisations/${orgId}/staff`), orderBy("fullName", "asc")),
      (snapshot) => {
        const mapped = snapshot.docs.map((snap) => {
          const data = snap.data();
          return {
            id: snap.id,
            fullName:
              typeof data.fullName === "string" ? data.fullName : "Unknown staff",
            schoolIds: Array.isArray(data.schoolIds)
              ? data.schoolIds.filter(
                  (value): value is string => typeof value === "string",
                )
              : [],
          } satisfies StaffOption;
        });
        setStaff(mapped);
      },
      () => setError("Failed to load staff list."),
    );

    const unsubscribeRecords = onSnapshot(
      query(
        collection(db, `organisations/${orgId}/modules/trainingTrack/trainingRecords`),
        orderBy("updatedAt", "desc"),
      ),
      (snapshot) => {
        const byTypeId = new Map(types.map((item) => [item.id, item]));
        const byStaffId = new Map(staff.map((item) => [item.id, item]));
        const mapped = snapshot.docs
          .map((snap) => {
            const data = snap.data();
            const rowSchoolId =
              typeof data.schoolId === "string" ? data.schoolId : "";
            if (schoolId && rowSchoolId !== schoolId) {
              return null;
            }
            const type = byTypeId.get(
              typeof data.trainingTypeId === "string" ? data.trainingTypeId : "",
            );
            const staffMember = byStaffId.get(
              typeof data.staffId === "string" ? data.staffId : "",
            );
            return {
              id: snap.id,
              staffName: staffMember?.fullName ?? "Unknown staff",
              staffId: typeof data.staffId === "string" ? data.staffId : "",
              trainingTypeName: type?.name ?? "Unknown type",
              trainingTypeId:
                typeof data.trainingTypeId === "string" ? data.trainingTypeId : "",
              status:
                data.status === "valid" ||
                data.status === "expiring" ||
                data.status === "expired"
                  ? data.status
                  : "expired",
              daysToExpiry:
                typeof data.daysToExpiry === "number" ? data.daysToExpiry : null,
              schoolId: rowSchoolId,
              issuedAt:
                typeof data.issuedAt === "string"
                  ? data.issuedAt
                  : data.issuedAt?.toDate?.().toISOString?.() ?? null,
              expiresAt:
                typeof data.expiresAt === "string"
                  ? data.expiresAt
                  : data.expiresAt?.toDate?.().toISOString?.() ?? null,
              complianceRuleId:
                typeof data.complianceRuleId === "string"
                  ? data.complianceRuleId
                  : null,
              complianceReasonCode:
                typeof data.complianceReasonCode === "string"
                  ? data.complianceReasonCode
                  : null,
            } satisfies TrainingRecordRow;
          })
          .filter((item): item is TrainingRecordRow => item !== null);

        setRecords(mapped);
      },
      () => setError("Failed to load training records."),
    );

    return () => {
      unsubscribeTypes();
      unsubscribeStaff();
      unsubscribeRecords();
    };
  }, [orgId, schoolId, staff, types]);

  const scopedStaff = useMemo(
    () =>
      schoolId ? staff.filter((staffItem) => staffItem.schoolIds.includes(schoolId)) : staff,
    [schoolId, staff],
  );

  const selectedDraftType = types.find((item) => item.id === draft.trainingTypeId) ?? null;
  const selectedEditType =
    types.find((item) => item.id === editingDraft.trainingTypeId) ?? null;

  const applyRecordWriteDefaults = (
    recordDraft: RecordDraft,
    typeItem: TrainingTypeOption | null,
  ) => {
    const expires = typeItem?.expires ?? true;
    const expiresAtFromValidity =
      expires && typeItem
        ? deriveExpiryDate(recordDraft.issuedAt, typeItem.defaultValidityDays)
        : null;
    const expiresAtCandidate = recordDraft.expiresAt
      ? toIsoFromDateInput(recordDraft.expiresAt)
      : expiresAtFromValidity;
    const compliance = evaluateTrainingRecordCompliance(expires, expiresAtCandidate);

    return {
      issuedAt: toIsoFromDateInput(recordDraft.issuedAt),
      expiresAt: compliance.expiresAtIso,
      status: compliance.status,
      daysToExpiry: compliance.daysToExpiry,
    };
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId || !schoolId || !draft.staffId || !draft.trainingTypeId) {
      return;
    }

    const selectedType = types.find((item) => item.id === draft.trainingTypeId) ?? null;
    const computed = applyRecordWriteDefaults(draft, selectedType);

    setSubmitting(true);
    setError(null);
    try {
      const recordsCollection = collection(
        db,
        `organisations/${orgId}/modules/trainingTrack/trainingRecords`,
      );
      const auditCollection = collection(
        db,
        `organisations/${orgId}/modules/trainingTrack/auditLogs`,
      );
      const recordRef = doc(recordsCollection);
      const auditRef = doc(auditCollection);
      const payload = {
        staffId: draft.staffId,
        schoolId,
        trainingTypeId: draft.trainingTypeId,
        createdBy: currentUserUid || "unknown",
        provider: draft.provider.trim() || null,
        notes: draft.notes.trim() || null,
        issuedAt: computed.issuedAt,
        expiresAt: computed.expiresAt,
        status: computed.status,
        daysToExpiry: computed.daysToExpiry,
        complianceRuleId: computed.ruleId,
        complianceReasonCode: computed.reasonCode,
        complianceRulePath: computed.rulePath,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.set(recordRef, payload);
      batch.set(
        auditRef,
        buildTrainingTrackAuditLog({
          actorUserId: currentUserUid || "unknown",
          action: "create",
          entityType: "trainingRecord",
          entityId: recordRef.id,
          after: {
            staffId: payload.staffId,
            schoolId: payload.schoolId,
            trainingTypeId: payload.trainingTypeId,
            status: payload.status,
            daysToExpiry: payload.daysToExpiry,
            issuedAt: payload.issuedAt,
            expiresAt: payload.expiresAt,
            complianceRuleId: payload.complianceRuleId,
            complianceReasonCode: payload.complianceReasonCode,
            complianceRulePath: payload.complianceRulePath,
          },
        }),
      );
      await batch.commit();
      if (currentUser) {
        await refreshTrainingTrackAggregates(currentUser, orgId);
      }
      setDraft(EMPTY_DRAFT);
    } catch {
      setError("Unable to create training record.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (record: TrainingRecordRow) => {
    setEditingId(record.id);
    setEditingDraft({
      staffId: record.staffId,
      trainingTypeId: record.trainingTypeId,
      issuedAt: record.issuedAt ? record.issuedAt.slice(0, 10) : "",
      expiresAt: record.expiresAt ? record.expiresAt.slice(0, 10) : "",
      provider: "",
      notes: "",
    });
  };

  const handleSaveEdit = async () => {
    if (!orgId || !schoolId || !editingId || !editingDraft.staffId || !editingDraft.trainingTypeId) {
      return;
    }
    const selectedType = types.find((item) => item.id === editingDraft.trainingTypeId) ?? null;
    const computed = applyRecordWriteDefaults(editingDraft, selectedType);

    setSubmitting(true);
    setError(null);
    try {
      const currentRecord = records.find((record) => record.id === editingId) ?? null;
      const recordRef = doc(
        db,
        `organisations/${orgId}/modules/trainingTrack/trainingRecords/${editingId}`,
      );
      const auditRef = doc(
        collection(db, `organisations/${orgId}/modules/trainingTrack/auditLogs`),
      );
      const patch = {
        staffId: editingDraft.staffId,
        schoolId,
        trainingTypeId: editingDraft.trainingTypeId,
        provider: editingDraft.provider.trim() || null,
        notes: editingDraft.notes.trim() || null,
        issuedAt: computed.issuedAt,
        expiresAt: computed.expiresAt,
        status: computed.status,
        daysToExpiry: computed.daysToExpiry,
        complianceRuleId: computed.ruleId,
        complianceReasonCode: computed.reasonCode,
        complianceRulePath: computed.rulePath,
        updatedAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.update(recordRef, patch);
      batch.set(
        auditRef,
        buildTrainingTrackAuditLog({
          actorUserId: currentUserUid || "unknown",
          action: "update",
          entityType: "trainingRecord",
          entityId: editingId,
          before: currentRecord
            ? {
                staffId: currentRecord.staffId,
                schoolId: currentRecord.schoolId,
                trainingTypeName: currentRecord.trainingTypeName,
                status: currentRecord.status,
                daysToExpiry: currentRecord.daysToExpiry,
                issuedAt: currentRecord.issuedAt,
                expiresAt: currentRecord.expiresAt,
                complianceRuleId: currentRecord.complianceRuleId,
                complianceReasonCode: currentRecord.complianceReasonCode,
              }
            : null,
          after: {
            staffId: patch.staffId,
            schoolId: patch.schoolId,
            trainingTypeId: patch.trainingTypeId,
            status: patch.status,
            daysToExpiry: patch.daysToExpiry,
            issuedAt: patch.issuedAt,
            expiresAt: patch.expiresAt,
            complianceRuleId: patch.complianceRuleId,
            complianceReasonCode: patch.complianceReasonCode,
            complianceRulePath: patch.complianceRulePath,
          },
        }),
      );
      await batch.commit();
      if (currentUser) {
        await refreshTrainingTrackAggregates(currentUser, orgId);
      }
      setEditingId(null);
      setEditingDraft(EMPTY_DRAFT);
    } catch {
      setError("Unable to update training record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Training Records
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-100">
        Records with expiry and compliance status
      </h2>

      {!schoolId ? (
        <p className="mt-3 text-sm text-amber-300">
          Select a school scope in the top bar to create training records.
        </p>
      ) : null}

      <form className="mt-5 grid gap-3 md:grid-cols-6" onSubmit={handleCreate}>
        <select
          value={draft.staffId}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, staffId: event.target.value }))
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          required
        >
          <option value="">Select staff</option>
          {scopedStaff.map((staffItem) => (
            <option key={staffItem.id} value={staffItem.id}>
              {staffItem.fullName}
            </option>
          ))}
        </select>

        <select
          value={draft.trainingTypeId}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, trainingTypeId: event.target.value }))
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          required
        >
          <option value="">Select training type</option>
          {types.map((typeItem) => (
            <option key={typeItem.id} value={typeItem.id}>
              {typeItem.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={draft.issuedAt}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, issuedAt: event.target.value }))
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          required
        />

        <input
          type="date"
          value={draft.expiresAt}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, expiresAt: event.target.value }))
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          disabled={selectedDraftType ? !selectedDraftType.expires : false}
        />

        <input
          placeholder="Provider"
          value={draft.provider}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, provider: event.target.value }))
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />

        <input
          placeholder="Notes"
          value={draft.notes}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, notes: event.target.value }))
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />

        <button
          type="submit"
          disabled={submitting || !schoolId}
          className="rounded-md bg-teal-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-6"
        >
          {submitting ? "Saving..." : "Create training record"}
        </button>
      </form>

      {selectedDraftType?.expires && selectedDraftType.defaultValidityDays ? (
        <p className="mt-2 text-xs text-slate-400">
          Expiry defaults to issued date + {selectedDraftType.defaultValidityDays} days.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="mt-3 text-sm text-slate-300">Loading training records...</p> : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-300">
            <tr>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Days to expiry</th>
              <th className="px-3 py-2">Expires at</th>
              <th className="px-3 py-2">Reason code</th>
              <th className="px-3 py-2">Rule ID</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-slate-800 text-slate-100">
                <td className="px-3 py-2">{record.staffName}</td>
                <td className="px-3 py-2">{record.trainingTypeName}</td>
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
                <td className="px-3 py-2">
                  {record.daysToExpiry !== null ? record.daysToExpiry : "-"}
                </td>
                <td className="px-3 py-2">
                  {record.expiresAt ? record.expiresAt.slice(0, 10) : "-"}
                </td>
                <td className="px-3 py-2">{record.complianceReasonCode ?? "-"}</td>
                <td className="px-3 py-2">{record.complianceRuleId ?? "-"}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => startEdit(record)}
                    className="rounded border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-sm text-slate-400">
                  No training records for this scope.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editingId ? (
        <div className="mt-5 rounded-lg border border-slate-700 bg-slate-950 p-4">
          <p className="text-sm font-medium text-slate-200">Edit training record</p>
          <div className="mt-3 grid gap-3 md:grid-cols-6">
            <select
              value={editingDraft.staffId}
              onChange={(event) =>
                setEditingDraft((prev) => ({ ...prev, staffId: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Select staff</option>
              {scopedStaff.map((staffItem) => (
                <option key={staffItem.id} value={staffItem.id}>
                  {staffItem.fullName}
                </option>
              ))}
            </select>

            <select
              value={editingDraft.trainingTypeId}
              onChange={(event) =>
                setEditingDraft((prev) => ({
                  ...prev,
                  trainingTypeId: event.target.value,
                }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Select type</option>
              {types.map((typeItem) => (
                <option key={typeItem.id} value={typeItem.id}>
                  {typeItem.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={editingDraft.issuedAt}
              onChange={(event) =>
                setEditingDraft((prev) => ({ ...prev, issuedAt: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />

            <input
              type="date"
              value={editingDraft.expiresAt}
              onChange={(event) =>
                setEditingDraft((prev) => ({ ...prev, expiresAt: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              disabled={selectedEditType ? !selectedEditType.expires : false}
            />

            <input
              placeholder="Provider"
              value={editingDraft.provider}
              onChange={(event) =>
                setEditingDraft((prev) => ({ ...prev, provider: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />

            <input
              placeholder="Notes"
              value={editingDraft.notes}
              onChange={(event) =>
                setEditingDraft((prev) => ({ ...prev, notes: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={submitting}
              className="rounded-md bg-teal-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setEditingDraft(EMPTY_DRAFT);
              }}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
