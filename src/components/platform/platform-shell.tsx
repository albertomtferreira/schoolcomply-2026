"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { bootstrapUserProfile } from "@/lib/firebase/bootstrapClient";
import { auth, connectClientEmulators, db } from "@/lib/firebase/client";
import {
  MODULE_CATALOG,
  MODULE_HEALTH_LABELS,
  isModuleId,
  type ModuleState,
} from "@/lib/modules/catalog";
import {
  compareModuleHealthPriority,
  toModuleHealthView,
} from "@/lib/modules/moduleHealth";

type SessionState = {
  user: User | null;
  enabledModules: string[];
  orgId: string | null;
  schoolIds: string[];
  selectedSchoolId: string | null;
  schools: Array<{ id: string; name: string; status: "active" | "archived" | "unknown" }>;
  moduleHealthByModuleId: Record<
    string,
    { state: ModuleState; lastCalculatedAtLabel: string }
  >;
  entitlementSource: "profile" | "claims" | "fallback";
  loading: boolean;
};

const MODULE_FALLBACK = ["trainingTrack"];
const ORG_ID_STORAGE_KEY = "schooltrack.orgId";
const SCHOOL_SCOPE_STORAGE_KEY_PREFIX = "schooltrack.schoolScope.";

function getStateClasses(state: ModuleState): string {
  switch (state) {
    case "green":
      return "bg-emerald-400";
    case "amber":
      return "bg-amber-300";
    case "red":
      return "bg-rose-400";
    default:
      return "bg-slate-500";
  }
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [session, setSession] = useState<SessionState>({
    user: null,
    enabledModules: MODULE_FALLBACK,
    orgId: null,
    schoolIds: [],
    selectedSchoolId: null,
    schools: [],
    moduleHealthByModuleId: {},
    entitlementSource: "fallback",
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    connectClientEmulators();

    const loadModuleHealth = async (
      orgId: string,
      moduleIds: string[],
    ): Promise<Record<string, { state: ModuleState; lastCalculatedAtLabel: string }>> => {
      const entries = await Promise.all(
        moduleIds.map(async (moduleId) => {
          const moduleHealthRef = doc(db, `organisations/${orgId}/moduleHealth/${moduleId}`);
          const moduleHealthSnap = await getDoc(moduleHealthRef);
          const moduleHealthData = moduleHealthSnap.data();
          return [moduleId, toModuleHealthView(moduleHealthData)] as const;
        }),
      );

      return Object.fromEntries(entries);
    };

    const resolveSession = async (user: User) => {
      const token = await user.getIdTokenResult();
      const claimModules = Array.isArray(token.claims.enabledModules)
        ? token.claims.enabledModules
            .filter((value): value is string => typeof value === "string")
            .filter((value) => isModuleId(value))
        : [];
      const tokenOrgId =
        typeof token.claims.orgId === "string" ? token.claims.orgId : null;
      const storedOrgId = window.localStorage.getItem(ORG_ID_STORAGE_KEY);
      let orgIdCandidates = Array.from(
        new Set(
          [tokenOrgId, storedOrgId].filter(
            (value): value is string => typeof value === "string" && value.length > 0,
          ),
        ),
      );

      let orgIdFromProfile: string | null = null;
      let modulesFromProfile: string[] = [];
      let schoolIdsFromProfile: string[] = [];

      for (const candidateOrgId of orgIdCandidates) {
        const userRef = doc(db, `organisations/${candidateOrgId}/users/${user.uid}`);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          continue;
        }

        const profileData = userSnap.data();
        orgIdFromProfile =
          typeof profileData.orgId === "string" ? profileData.orgId : candidateOrgId;
        modulesFromProfile = Array.isArray(profileData.enabledModules)
          ? profileData.enabledModules
              .filter((value): value is string => typeof value === "string")
              .filter((value) => isModuleId(value))
          : [];
        schoolIdsFromProfile = Array.isArray(profileData.schoolIds)
          ? profileData.schoolIds.filter(
              (value): value is string => typeof value === "string" && value.length > 0,
            )
          : [];
        break;
      }

      if (!orgIdFromProfile) {
        const usersQuery = query(
          collectionGroup(db, "users"),
          where("uid", "==", user.uid),
          limit(1),
        );
        const usersSnap = await getDocs(usersQuery);
        const profileDoc = usersSnap.docs[0];
        if (profileDoc) {
          const profileData = profileDoc.data();
          orgIdFromProfile =
            typeof profileData.orgId === "string" ? profileData.orgId : null;
          modulesFromProfile = Array.isArray(profileData.enabledModules)
            ? profileData.enabledModules
                .filter((value): value is string => typeof value === "string")
                .filter((value) => isModuleId(value))
            : [];
          schoolIdsFromProfile = Array.isArray(profileData.schoolIds)
            ? profileData.schoolIds.filter(
                (value): value is string => typeof value === "string" && value.length > 0,
              )
            : [];
        }
      }

      // Self-heal local setup: if profile lookup missed, bootstrap then retry direct profile read.
      if (modulesFromProfile.length === 0) {
        try {
          const bootstrapResult = await bootstrapUserProfile(user);
          const refreshedStoredOrgId = window.localStorage.getItem(ORG_ID_STORAGE_KEY);
          orgIdCandidates = Array.from(
            new Set(
              [bootstrapResult.orgId, tokenOrgId, refreshedStoredOrgId].filter(
                (value): value is string =>
                  typeof value === "string" && value.length > 0,
              ),
            ),
          );

          for (const candidateOrgId of orgIdCandidates) {
            const userRef = doc(db, `organisations/${candidateOrgId}/users/${user.uid}`);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              continue;
            }

            const profileData = userSnap.data();
            orgIdFromProfile =
              typeof profileData.orgId === "string"
                ? profileData.orgId
                : candidateOrgId;
            modulesFromProfile = Array.isArray(profileData.enabledModules)
              ? profileData.enabledModules
                  .filter((value): value is string => typeof value === "string")
                  .filter((value) => isModuleId(value))
              : [];
            schoolIdsFromProfile = Array.isArray(profileData.schoolIds)
              ? profileData.schoolIds.filter(
                  (value): value is string => typeof value === "string" && value.length > 0,
                )
              : [];
            break;
          }
        } catch {
          // Continue to claims/fallback resolution.
        }
      }

      const orgId = orgIdFromProfile ?? tokenOrgId;
      if (orgIdFromProfile) {
        window.localStorage.setItem(ORG_ID_STORAGE_KEY, orgIdFromProfile);
      }

      let schools: Array<{
        id: string;
        name: string;
        status: "active" | "archived" | "unknown";
      }> = [];
      let selectedSchoolId: string | null = null;

      if (orgId) {
        const schoolDocs = await getDocs(collection(db, `organisations/${orgId}/schools`));
        schools = schoolDocs.docs.map((schoolDoc) => {
          const schoolData = schoolDoc.data();
          const status =
            schoolData.status === "active" || schoolData.status === "archived"
              ? schoolData.status
              : "unknown";

          return {
            id: schoolDoc.id,
            name:
              typeof schoolData.name === "string" && schoolData.name.length > 0
                ? schoolData.name
                : schoolDoc.id,
            status,
          };
        });

        const visibleSchools =
          schoolIdsFromProfile.length > 0
            ? schools.filter((school) => schoolIdsFromProfile.includes(school.id))
            : schools;

        const storageKey = `${SCHOOL_SCOPE_STORAGE_KEY_PREFIX}${orgId}`;
        const storedSchoolId = window.localStorage.getItem(storageKey);
        const allowedSchoolIds = visibleSchools.map((school) => school.id);
        selectedSchoolId =
          storedSchoolId && allowedSchoolIds.includes(storedSchoolId)
            ? storedSchoolId
            : allowedSchoolIds[0] ?? null;

        if (selectedSchoolId) {
          window.localStorage.setItem(storageKey, selectedSchoolId);
        }

        schools = visibleSchools;
      }

      const effectiveModules =
        modulesFromProfile.length > 0
          ? modulesFromProfile
          : claimModules.length > 0
            ? claimModules
            : [];

      const moduleHealthByModuleId =
        orgId && effectiveModules.length > 0
          ? await loadModuleHealth(orgId, effectiveModules)
          : {};

      if (modulesFromProfile.length > 0) {
        return {
          user,
          enabledModules: modulesFromProfile,
          orgId,
          schoolIds: schoolIdsFromProfile,
          selectedSchoolId,
          schools,
          moduleHealthByModuleId,
          entitlementSource: "profile" as const,
          loading: false,
        };
      }

      if (claimModules.length > 0) {
        return {
          user,
          enabledModules: claimModules,
          orgId,
          schoolIds: schoolIdsFromProfile,
          selectedSchoolId,
          schools,
          moduleHealthByModuleId,
          entitlementSource: "claims" as const,
          loading: false,
        };
      }

      return {
        user,
        enabledModules: [],
        orgId,
        schoolIds: schoolIdsFromProfile,
        selectedSchoolId,
        schools,
        moduleHealthByModuleId,
        entitlementSource: "fallback" as const,
        loading: false,
      };
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setSession({
          user: null,
          enabledModules: [],
          orgId: null,
          schoolIds: [],
          selectedSchoolId: null,
          schools: [],
          moduleHealthByModuleId: {},
          entitlementSource: "fallback",
          loading: false,
        });
        return;
      }

      void resolveSession(user)
        .then((resolvedSession) => {
          if (!cancelled) {
            setSession(resolvedSession);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSession({
              user,
              enabledModules: [],
              orgId: null,
              schoolIds: [],
              selectedSchoolId: null,
              schools: [],
              moduleHealthByModuleId: {},
              entitlementSource: "fallback",
              loading: false,
            });
          }
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const modules = useMemo(
    () => {
      const filteredModules = MODULE_CATALOG.filter((moduleItem) =>
        session.enabledModules.includes(moduleItem.id),
      );

      return filteredModules.sort((left, right) => {
        const leftState = session.moduleHealthByModuleId[left.id]?.state ?? "grey";
        const rightState = session.moduleHealthByModuleId[right.id]?.state ?? "grey";
        return compareModuleHealthPriority(
          leftState,
          rightState,
          left.label,
          right.label,
        );
      });
    },
    [session.enabledModules, session.moduleHealthByModuleId],
  );

  const activeModuleId = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments[1] ?? "";
  }, [pathname]);

  useEffect(() => {
    if (session.loading) {
      return;
    }

    const onAppRoute = pathname.startsWith("/app/");
    const isNoAccessRoute = pathname.startsWith("/app/no-access");
    const onModuleRoute = onAppRoute && !isNoAccessRoute;
    const isKnownAndEnabled = modules.some(
      (moduleItem) => moduleItem.id === activeModuleId,
    );

    if (onModuleRoute && modules.length === 0) {
      router.replace("/app/no-access");
      return;
    }

    if (onModuleRoute && !isKnownAndEnabled && modules.length > 0) {
      router.replace(`/app/${modules[0].id}`);
      return;
    }

    if (isNoAccessRoute && modules.length > 0) {
      router.replace(`/app/${modules[0].id}`);
    }
  }, [activeModuleId, modules, pathname, router, session.loading]);

  useEffect(() => {
    if (session.loading || !pathname.startsWith("/app/") || pathname.startsWith("/app/no-access")) {
      return;
    }

    const selectedSchoolId = session.selectedSchoolId;
    if (!selectedSchoolId) {
      return;
    }

    const currentSchoolId = searchParams.get("schoolId");
    if (currentSchoolId === selectedSchoolId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("schoolId", selectedSchoolId);
    router.replace(`${pathname}?${nextParams.toString()}`);
  }, [pathname, router, searchParams, session.loading, session.selectedSchoolId]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut(auth);
    router.replace("/");
  };

  const handleSchoolScopeChange = (schoolId: string) => {
    if (!session.orgId) {
      return;
    }

    window.localStorage.setItem(
      `${SCHOOL_SCOPE_STORAGE_KEY_PREFIX}${session.orgId}`,
      schoolId,
    );
    setSession((previous) => ({
      ...previous,
      selectedSchoolId: schoolId,
    }));
    router.replace(`${pathname}?schoolId=${encodeURIComponent(schoolId)}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen md:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-300">
              SCHOOLTRACK
            </p>
            <span className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300">
              Phase 1
            </span>
          </div>

          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Modules
            </p>
            <nav className="mt-3 space-y-2">
              {modules.map((moduleItem) => {
                const active = activeModuleId === moduleItem.id;
                const moduleHealth = session.moduleHealthByModuleId[moduleItem.id] ?? {
                  state: "grey",
                  lastCalculatedAtLabel: "Last updated unavailable",
                };
                const moduleState = moduleHealth.state;

                return (
                  <Link
                    key={moduleItem.id}
                    href={`/app/${moduleItem.id}`}
                    className={[
                      "block w-full rounded-md border px-3 py-2 text-sm transition",
                      active
                        ? "border-teal-300 bg-slate-800"
                        : "border-slate-700 hover:border-slate-500",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span>{moduleItem.label}</span>
                      <span
                        className="inline-flex items-center gap-2 text-xs text-slate-300"
                        role="status"
                        aria-label={`${moduleItem.label} indicator: ${MODULE_HEALTH_LABELS[moduleState]}`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${getStateClasses(moduleState)}`}
                          aria-hidden
                        />
                        {MODULE_HEALTH_LABELS[moduleState]}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {moduleHealth.lastCalculatedAtLabel}
                    </p>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200">
                Org: {session.orgId ?? "unassigned"}
              </div>
              <select
                value={session.selectedSchoolId ?? ""}
                onChange={(event) => handleSchoolScopeChange(event.target.value)}
                disabled={session.schools.length === 0}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300"
                aria-label="School scope"
              >
                {session.schools.length === 0 ? (
                  <option value="">No schools in scope</option>
                ) : (
                  session.schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-300">
                {session.user?.email ?? "Authenticated user"}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="rounded-md border border-slate-600 px-3 py-2 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
