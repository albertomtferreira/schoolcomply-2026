"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  writeBatch,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { auth, connectClientEmulators, db } from "@/lib/firebase/client";
import { refreshTrainingTrackAggregates } from "@/lib/modules/trainingTrack/aggregatesClient";
import { buildTrainingTrackAuditLog } from "@/lib/modules/trainingTrack/auditClient";

const ORG_ID_STORAGE_KEY = "schooltrack.orgId";

type TrainingType = {
  id: string;
  name: string;
  code: string;
  required: boolean;
  expires: boolean;
  defaultValidityDays: string;
  isActive: boolean;
};

type TrainingTypeDraft = {
  name: string;
  code: string;
  required: boolean;
  expires: boolean;
  defaultValidityDays: string;
};

const EMPTY_DRAFT: TrainingTypeDraft = {
  name: "",
  code: "",
  required: true,
  expires: true,
  defaultValidityDays: "",
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

export function TrainingTypesManager() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [types, setTypes] = useState<TrainingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TrainingTypeDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<TrainingTypeDraft>(EMPTY_DRAFT);

  useEffect(() => {
    let cancelled = false;
    connectClientEmulators();

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setOrgId(null);
          setTypes([]);
          setLoading(false);
          setError("Sign in to manage training types.");
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
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    setLoading(true);
    setError(null);

    const typesQuery = query(
      collection(db, `organisations/${orgId}/modules/trainingTrack/trainingTypes`),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      typesQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((snap) => {
          const data = snap.data();
          return {
            id: snap.id,
            name: typeof data.name === "string" ? data.name : "Unnamed type",
            code: typeof data.code === "string" ? data.code : "",
            required: Boolean(data.required),
            expires: Boolean(data.expires),
            defaultValidityDays:
              typeof data.defaultValidityDays === "number"
                ? String(data.defaultValidityDays)
                : "",
            isActive: data.isActive !== false,
          } satisfies TrainingType;
        });
        setTypes(mapped);
        setLoading(false);
      },
      () => {
        setError("Failed to load training types.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [orgId]);

  const activeCount = useMemo(
    () => types.filter((typeItem) => typeItem.isActive).length,
    [types],
  );

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId || !draft.name.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const typesCollection = collection(
        db,
        `organisations/${orgId}/modules/trainingTrack/trainingTypes`,
      );
      const auditCollection = collection(
        db,
        `organisations/${orgId}/modules/trainingTrack/auditLogs`,
      );
      const typeRef = doc(typesCollection);
      const auditRef = doc(auditCollection);
      const payload = {
        name: draft.name.trim(),
        code: draft.code.trim() || null,
        required: draft.required,
        expires: draft.expires,
        defaultValidityDays:
          draft.defaultValidityDays.trim().length > 0
            ? Number.parseInt(draft.defaultValidityDays, 10)
            : null,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.set(typeRef, payload);
      batch.set(
        auditRef,
        buildTrainingTrackAuditLog({
          actorUserId: currentUserUid || "unknown",
          action: "create",
          entityType: "trainingType",
          entityId: typeRef.id,
          after: {
            name: payload.name,
            code: payload.code,
            required: payload.required,
            expires: payload.expires,
            defaultValidityDays: payload.defaultValidityDays,
            isActive: payload.isActive,
          },
        }),
      );
      await batch.commit();
      if (currentUser) {
        await refreshTrainingTrackAggregates(currentUser, orgId);
      }
      setDraft(EMPTY_DRAFT);
    } catch {
      setError("Unable to create training type.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (typeItem: TrainingType) => {
    setEditingId(typeItem.id);
    setEditingDraft({
      name: typeItem.name,
      code: typeItem.code,
      required: typeItem.required,
      expires: typeItem.expires,
      defaultValidityDays: typeItem.defaultValidityDays,
    });
  };

  const handleSaveEdit = async () => {
    if (!orgId || !editingId || !editingDraft.name.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const currentType = types.find((typeItem) => typeItem.id === editingId) ?? null;
      const typeRef = doc(
        db,
        `organisations/${orgId}/modules/trainingTrack/trainingTypes/${editingId}`,
      );
      const auditRef = doc(
        collection(db, `organisations/${orgId}/modules/trainingTrack/auditLogs`),
      );
      const patch = {
        name: editingDraft.name.trim(),
        code: editingDraft.code.trim() || null,
        required: editingDraft.required,
        expires: editingDraft.expires,
        defaultValidityDays:
          editingDraft.defaultValidityDays.trim().length > 0
            ? Number.parseInt(editingDraft.defaultValidityDays, 10)
            : null,
        updatedAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.update(typeRef, patch);
      batch.set(
        auditRef,
        buildTrainingTrackAuditLog({
          actorUserId: currentUserUid || "unknown",
          action: "update",
          entityType: "trainingType",
          entityId: editingId,
          before: currentType
            ? {
                name: currentType.name,
                code: currentType.code || null,
                required: currentType.required,
                expires: currentType.expires,
                defaultValidityDays: currentType.defaultValidityDays
                  ? Number.parseInt(currentType.defaultValidityDays, 10)
                  : null,
                isActive: currentType.isActive,
              }
            : null,
          after: {
            name: patch.name,
            code: patch.code,
            required: patch.required,
            expires: patch.expires,
            defaultValidityDays: patch.defaultValidityDays,
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
      setError("Unable to update training type.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!orgId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const currentType = types.find((typeItem) => typeItem.id === id) ?? null;
      const typeRef = doc(db, `organisations/${orgId}/modules/trainingTrack/trainingTypes/${id}`);
      const auditRef = doc(
        collection(db, `organisations/${orgId}/modules/trainingTrack/auditLogs`),
      );
      const batch = writeBatch(db);
      batch.update(typeRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
      batch.set(
        auditRef,
        buildTrainingTrackAuditLog({
          actorUserId: currentUserUid || "unknown",
          action: "update",
          entityType: "trainingType",
          entityId: id,
          before: currentType
            ? {
                name: currentType.name,
                code: currentType.code || null,
                required: currentType.required,
                expires: currentType.expires,
                defaultValidityDays: currentType.defaultValidityDays
                  ? Number.parseInt(currentType.defaultValidityDays, 10)
                  : null,
                isActive: currentType.isActive,
              }
            : null,
          after: {
            isActive: false,
          },
        }),
      );
      await batch.commit();
      if (currentUser) {
        await refreshTrainingTrackAggregates(currentUser, orgId);
      }
    } catch {
      setError("Unable to deactivate training type.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Training Types
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">
            Manage training definitions
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Active: {activeCount} of {types.length}
          </p>
        </div>
      </div>

      <form className="mt-5 grid gap-3 md:grid-cols-6" onSubmit={handleCreate}>
        <input
          placeholder="Name"
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 md:col-span-2"
          required
        />
        <input
          placeholder="Code"
          value={draft.code}
          onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        <input
          placeholder="Validity days"
          value={draft.defaultValidityDays}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, defaultValidityDays: event.target.value }))
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          inputMode="numeric"
        />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={draft.required}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, required: event.target.checked }))
            }
          />
          Required
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={draft.expires}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, expires: event.target.checked }))
            }
          />
          Expires
        </label>
        <button
          type="submit"
          disabled={submitting || !orgId}
          className="rounded-md bg-teal-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-6"
        >
          {submitting ? "Saving..." : "Create training type"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="mt-3 text-sm text-slate-300">Loading training types...</p> : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-300">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Required</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Validity</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {types.map((typeItem) => (
              <tr key={typeItem.id} className="border-t border-slate-800 text-slate-100">
                <td className="px-3 py-2">{typeItem.name}</td>
                <td className="px-3 py-2">{typeItem.code || "-"}</td>
                <td className="px-3 py-2">{typeItem.required ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{typeItem.expires ? "Yes" : "No"}</td>
                <td className="px-3 py-2">
                  {typeItem.defaultValidityDays ? `${typeItem.defaultValidityDays}d` : "-"}
                </td>
                <td className="px-3 py-2">
                  {typeItem.isActive ? (
                    <span className="text-emerald-300">Active</span>
                  ) : (
                    <span className="text-slate-400">Inactive</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(typeItem)}
                      className="rounded border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={!typeItem.isActive || submitting}
                      onClick={() => handleDeactivate(typeItem.id)}
                      className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {types.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-sm text-slate-400">
                  No training types yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editingId ? (
        <div className="mt-5 rounded-lg border border-slate-700 bg-slate-950 p-4">
          <p className="text-sm font-medium text-slate-200">Edit training type</p>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <input
              value={editingDraft.name}
              onChange={(event) =>
                setEditingDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 md:col-span-2"
            />
            <input
              value={editingDraft.code}
              onChange={(event) =>
                setEditingDraft((prev) => ({ ...prev, code: event.target.value }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={editingDraft.defaultValidityDays}
              onChange={(event) =>
                setEditingDraft((prev) => ({
                  ...prev,
                  defaultValidityDays: event.target.value,
                }))
              }
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              inputMode="numeric"
            />
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingDraft.required}
                  onChange={(event) =>
                    setEditingDraft((prev) => ({
                      ...prev,
                      required: event.target.checked,
                    }))
                  }
                />
                Required
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingDraft.expires}
                  onChange={(event) =>
                    setEditingDraft((prev) => ({
                      ...prev,
                      expires: event.target.checked,
                    }))
                  }
                />
                Expires
              </label>
            </div>
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
