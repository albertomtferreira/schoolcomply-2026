import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;
const rules = readFileSync("firestore.rules", "utf8");

const ts = "2026-02-15T00:00:00.000Z";

type UserSeed = {
  role: "org_admin" | "school_admin" | "staff" | "viewer";
  schoolIds?: string[];
  staffId?: string;
  isActive?: boolean;
  orgId?: string;
  enabledModules?: string[];
};

async function seedUser(orgId: string, uid: string, user: UserSeed): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `organisations/${orgId}/users/${uid}`), {
      uid,
      fullName: uid,
      email: `${uid}@example.com`,
      role: user.role,
      orgId: user.orgId ?? orgId,
      schoolIds: user.schoolIds ?? [],
      staffId: user.staffId ?? null,
      enabledModules: user.enabledModules ?? ["trainingTrack"],
      isActive: user.isActive ?? true,
      createdAt: ts,
      updatedAt: ts,
    });
  });
}

async function seedDoc(path: string, data: Record<string, unknown>): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, path), data);
  });
}

function authed(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "schooltrack-dev",
    firestore: { rules },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Security Contract - Firestore Rules", () => {
  describe("4.1 Tenant Isolation", () => {
    it("1. org_admin from org A reads school from org B -> deny", async () => {
      await seedUser("orgA", "adminA", { role: "org_admin" });
      await seedDoc("organisations/orgB/schools/s1", {
        name: "School B1",
        status: "active",
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("adminA");
      await assertFails(getDoc(doc(db, "organisations/orgB/schools/s1")));
    });

    it("2. school_admin from org A writes training record in org B -> deny", async () => {
      await seedUser("orgA", "saA", { role: "school_admin", schoolIds: ["s1"] });

      const db = authed("saA");
      await assertFails(
        setDoc(doc(db, "organisations/orgB/modules/trainingTrack/trainingRecords/r1"), {
          staffId: "st1",
          schoolId: "s1",
          trainingTypeId: "tt1",
          createdBy: "saA",
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    });
  });

  describe("4.2 Org Admin Access", () => {
    it("3. org_admin reads/writes staff in own org -> allow", async () => {
      await seedUser("orgA", "adminA", { role: "org_admin" });
      await seedDoc("organisations/orgA/staff/st1", {
        fullName: "Staff 1",
        schoolIds: ["s1"],
        employmentRole: "teacher",
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("adminA");
      await assertSucceeds(getDoc(doc(db, "organisations/orgA/staff/st1")));
      await assertSucceeds(
        setDoc(doc(db, "organisations/orgA/staff/st2"), {
          fullName: "Staff 2",
          schoolIds: ["s1"],
          employmentRole: "teacher",
          isActive: true,
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    });

    it("4. org_admin creates training type in own org -> allow", async () => {
      await seedUser("orgA", "adminA", { role: "org_admin" });

      const db = authed("adminA");
      await assertSucceeds(
        setDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingTypes/tt1"), {
          name: "First Aid",
          expires: true,
          required: true,
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    });
  });

  describe("4.3 School Scope Enforcement", () => {
    it("5. school_admin with schoolIds=['s1'] reads record where schoolId='s1' -> allow", async () => {
      await seedUser("orgA", "saA", { role: "school_admin", schoolIds: ["s1"] });
      await seedDoc("organisations/orgA/modules/trainingTrack/trainingRecords/r1", {
        staffId: "st1",
        schoolId: "s1",
        trainingTypeId: "tt1",
        createdBy: "saA",
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("saA");
      await assertSucceeds(getDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingRecords/r1")));
    });

    it("6. school_admin with schoolIds=['s1'] writes record where schoolId='s2' -> deny", async () => {
      await seedUser("orgA", "saA", { role: "school_admin", schoolIds: ["s1"] });

      const db = authed("saA");
      await assertFails(
        setDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingRecords/r2"), {
          staffId: "st1",
          schoolId: "s2",
          trainingTypeId: "tt1",
          createdBy: "saA",
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    });

    it("7. viewer with schoolIds=['s1'] reads staff linked to s1 -> allow", async () => {
      await seedUser("orgA", "viewerA", { role: "viewer", schoolIds: ["s1"] });
      await seedDoc("organisations/orgA/staff/st1", {
        fullName: "Staff 1",
        schoolIds: ["s1", "s3"],
        employmentRole: "teacher",
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("viewerA");
      await assertSucceeds(getDoc(doc(db, "organisations/orgA/staff/st1")));
    });

    it("8. viewer attempts any write -> deny", async () => {
      await seedUser("orgA", "viewerA", { role: "viewer", schoolIds: ["s1"] });

      const db = authed("viewerA");
      await assertFails(
        setDoc(doc(db, "organisations/orgA/staff/st2"), {
          fullName: "Staff 2",
          schoolIds: ["s1"],
          employmentRole: "teacher",
          isActive: true,
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    });
  });

  describe("4.4 Staff Self Access", () => {
    it("9. staff reads own staff doc via users.staffId match -> allow", async () => {
      await seedUser("orgA", "staffUserA", {
        role: "staff",
        schoolIds: ["s1"],
        staffId: "st1",
      });
      await seedDoc("organisations/orgA/staff/st1", {
        fullName: "Self Staff",
        schoolIds: ["s1"],
        employmentRole: "teacher",
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("staffUserA");
      await assertSucceeds(getDoc(doc(db, "organisations/orgA/staff/st1")));
    });

    it("10. staff reads another staff doc -> deny", async () => {
      await seedUser("orgA", "staffUserA", {
        role: "staff",
        schoolIds: ["s1"],
        staffId: "st1",
      });
      await seedDoc("organisations/orgA/staff/st2", {
        fullName: "Other Staff",
        schoolIds: ["s1"],
        employmentRole: "teacher",
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("staffUserA");
      await assertFails(getDoc(doc(db, "organisations/orgA/staff/st2")));
    });

    it("11. staff submits own training record with staffId match and scoped school -> allow", async () => {
      await seedUser("orgA", "staffUserA", {
        role: "staff",
        schoolIds: ["s1"],
        staffId: "st1",
      });

      const db = authed("staffUserA");
      await assertSucceeds(
        setDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingRecords/rSelf"), {
          staffId: "st1",
          schoolId: "s1",
          trainingTypeId: "tt1",
          createdBy: "staffUserA",
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    });

    it("12. staff updates another staff member record -> deny", async () => {
      await seedUser("orgA", "staffUserA", {
        role: "staff",
        schoolIds: ["s1"],
        staffId: "st1",
      });
      await seedDoc("organisations/orgA/modules/trainingTrack/trainingRecords/rOther", {
        staffId: "st2",
        schoolId: "s1",
        trainingTypeId: "tt1",
        createdBy: "adminA",
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("staffUserA");
      await assertFails(
        updateDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingRecords/rOther"), {
          notes: "attempted edit",
        }),
      );
    });
  });

  describe("4.5 Immutable Audit Logs", () => {
    it("13. org_admin creates audit log -> allow", async () => {
      await seedUser("orgA", "adminA", { role: "org_admin" });

      const db = authed("adminA");
      await assertSucceeds(
        setDoc(doc(db, "organisations/orgA/modules/trainingTrack/auditLogs/log1"), {
          actorUserId: "adminA",
          action: "create",
          entityType: "staff",
          entityId: "st1",
          createdAt: ts,
        }),
      );
    });

    it("14. org_admin updates existing audit log -> deny", async () => {
      await seedUser("orgA", "adminA", { role: "org_admin" });
      await seedDoc("organisations/orgA/modules/trainingTrack/auditLogs/log2", {
        actorUserId: "adminA",
        action: "create",
        entityType: "staff",
        entityId: "st1",
        createdAt: ts,
      });

      const db = authed("adminA");
      await assertFails(
        updateDoc(doc(db, "organisations/orgA/modules/trainingTrack/auditLogs/log2"), {
          action: "update",
        }),
      );
    });

    it("15. school_admin deletes audit log -> deny", async () => {
      await seedUser("orgA", "saA", { role: "school_admin", schoolIds: ["s1"] });
      await seedDoc("organisations/orgA/modules/trainingTrack/auditLogs/log3", {
        actorUserId: "saA",
        action: "create",
        entityType: "trainingRecord",
        entityId: "r1",
        createdAt: ts,
      });

      const db = authed("saA");
      await assertFails(deleteDoc(doc(db, "organisations/orgA/modules/trainingTrack/auditLogs/log3")));
    });
  });

  describe("4.6 Aggregate Protection", () => {
    it("16. viewer writes aggregates/orgCompliance -> deny", async () => {
      await seedUser("orgA", "viewerA", { role: "viewer", schoolIds: ["s1"] });

      const db = authed("viewerA");
      await assertFails(
        setDoc(doc(db, "organisations/orgA/aggregates/orgCompliance"), {
          compliantCount: 1,
          nonCompliantCount: 0,
          expiringSoonCount: 0,
          lastCalculatedAt: ts,
        }),
      );
    });

    it("17. school_admin writes aggregate doc directly -> deny", async () => {
      await seedUser("orgA", "saA", { role: "school_admin", schoolIds: ["s1"] });

      const db = authed("saA");
      await assertFails(
        setDoc(doc(db, "organisations/orgA/aggregates/school_s1"), {
          compliantCount: 1,
          nonCompliantCount: 0,
          expiringSoonCount: 0,
          lastCalculatedAt: ts,
        }),
      );
    });

    it("18. org_admin reads aggregate doc in own org -> allow", async () => {
      await seedUser("orgA", "adminA", { role: "org_admin" });
      await seedDoc("organisations/orgA/aggregates/orgCompliance", {
        compliantCount: 3,
        nonCompliantCount: 1,
        expiringSoonCount: 2,
        lastCalculatedAt: ts,
      });

      const db = authed("adminA");
      await assertSucceeds(getDoc(doc(db, "organisations/orgA/aggregates/orgCompliance")));
    });
  });

  describe("4.7 User Record Integrity", () => {
    it("19. non-admin create/update users/{uid} for another uid -> deny", async () => {
      await seedUser("orgA", "viewerA", { role: "viewer", schoolIds: ["s1"] });
      await seedDoc("organisations/orgA/users/targetUser", {
        uid: "targetUser",
        fullName: "Target",
        email: "target@example.com",
        role: "staff",
        orgId: "orgA",
        schoolIds: ["s1"],
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("viewerA");
      await assertFails(
        setDoc(doc(db, "organisations/orgA/users/otherUser"), {
          uid: "otherUser",
          fullName: "Other",
          email: "other@example.com",
          role: "viewer",
          orgId: "orgA",
          schoolIds: ["s1"],
          isActive: true,
          createdAt: ts,
          updatedAt: ts,
        }),
      );

      await assertFails(
        updateDoc(doc(db, "organisations/orgA/users/targetUser"), {
          fullName: "Hacked",
        }),
      );
    });

    it("20. non-admin user tries to set orgId different from path org -> deny", async () => {
      await seedUser("orgA", "viewerA", { role: "viewer", schoolIds: ["s1"] });

      const db = authed("viewerA");
      await assertFails(
        setDoc(doc(db, "organisations/orgA/users/viewerA"), {
          uid: "viewerA",
          fullName: "Viewer A",
          email: "viewer@example.com",
          role: "viewer",
          orgId: "orgB",
          schoolIds: ["s1"],
          enabledModules: [],
          isActive: true,
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    });
  });

  describe("4.8 Module Entitlement", () => {
    it("21. user without trainingTrack entitlement reads module training record -> deny", async () => {
      await seedUser("orgA", "viewerNoModule", {
        role: "viewer",
        schoolIds: ["s1"],
        enabledModules: [],
      });
      await seedDoc("organisations/orgA/modules/trainingTrack/trainingRecords/r1", {
        staffId: "st1",
        schoolId: "s1",
        trainingTypeId: "tt1",
        createdBy: "adminA",
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("viewerNoModule");
      await assertFails(getDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingRecords/r1")));
    });

    it("22. user with trainingTrack entitlement reads scoped module training record -> allow", async () => {
      await seedUser("orgA", "viewerWithModule", {
        role: "viewer",
        schoolIds: ["s1"],
        enabledModules: ["trainingTrack"],
      });
      await seedDoc("organisations/orgA/modules/trainingTrack/trainingRecords/r2", {
        staffId: "st1",
        schoolId: "s1",
        trainingTypeId: "tt1",
        createdBy: "adminA",
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("viewerWithModule");
      await assertSucceeds(getDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingRecords/r2")));
    });

    it("23. legacy root training path is no longer accessible -> deny", async () => {
      await seedUser("orgA", "viewerWithModule", {
        role: "viewer",
        schoolIds: ["s1"],
        enabledModules: ["trainingTrack"],
      });
      await seedDoc("organisations/orgA/trainingRecords/rLegacy", {
        staffId: "st1",
        schoolId: "s1",
        trainingTypeId: "tt1",
        createdBy: "adminA",
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("viewerWithModule");
      await assertFails(getDoc(doc(db, "organisations/orgA/trainingRecords/rLegacy")));
    });

    it("24. user without trainingTrack entitlement reads moduleHealth/trainingTrack -> deny", async () => {
      await seedUser("orgA", "viewerNoModule", {
        role: "viewer",
        schoolIds: ["s1"],
        enabledModules: [],
      });
      await seedDoc("organisations/orgA/moduleHealth/trainingTrack", {
        state: "amber",
        openRiskCount: 2,
        lastCalculatedAt: ts,
      });

      const db = authed("viewerNoModule");
      await assertFails(getDoc(doc(db, "organisations/orgA/moduleHealth/trainingTrack")));
    });

    it("25. user with trainingTrack entitlement reads moduleHealth/trainingTrack -> allow", async () => {
      await seedUser("orgA", "viewerWithModule", {
        role: "viewer",
        schoolIds: ["s1"],
        enabledModules: ["trainingTrack"],
      });
      await seedDoc("organisations/orgA/moduleHealth/trainingTrack", {
        state: "green",
        openRiskCount: 0,
        lastCalculatedAt: ts,
      });

      const db = authed("viewerWithModule");
      await assertSucceeds(getDoc(doc(db, "organisations/orgA/moduleHealth/trainingTrack")));
    });

    it("26. org_admin with trainingTrack entitlement writes moduleHealth/trainingTrack directly -> deny", async () => {
      await seedUser("orgA", "adminA", {
        role: "org_admin",
        enabledModules: ["trainingTrack"],
      });

      const db = authed("adminA");
      await assertFails(
        setDoc(doc(db, "organisations/orgA/moduleHealth/trainingTrack"), {
          state: "red",
          openRiskCount: 3,
          lastCalculatedAt: ts,
        }),
      );
    });
  });

  describe("4.9 Scope Isolation (Org/School)", () => {
    it("27. school_admin scoped to s1 reads schools/s2 in same org -> deny", async () => {
      await seedUser("orgA", "saA", { role: "school_admin", schoolIds: ["s1"] });
      await seedDoc("organisations/orgA/schools/s2", {
        name: "School 2",
        status: "active",
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("saA");
      await assertFails(getDoc(doc(db, "organisations/orgA/schools/s2")));
    });

    it("28. school_admin scoped to s1 reads training record for schoolId=s2 -> deny", async () => {
      await seedUser("orgA", "saA", {
        role: "school_admin",
        schoolIds: ["s1"],
        enabledModules: ["trainingTrack"],
      });
      await seedDoc("organisations/orgA/modules/trainingTrack/trainingRecords/rSchool2", {
        staffId: "st2",
        schoolId: "s2",
        trainingTypeId: "tt1",
        createdBy: "adminA",
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("saA");
      await assertFails(
        getDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingRecords/rSchool2")),
      );
    });

    it("29. viewer scoped to s1 reads users doc scoped only to s2 -> deny", async () => {
      await seedUser("orgA", "viewerA", {
        role: "viewer",
        schoolIds: ["s1"],
      });
      await seedDoc("organisations/orgA/users/userS2", {
        uid: "userS2",
        fullName: "User S2",
        email: "users2@example.com",
        role: "staff",
        orgId: "orgA",
        schoolIds: ["s2"],
        enabledModules: ["trainingTrack"],
        isActive: true,
        createdAt: ts,
        updatedAt: ts,
      });

      const db = authed("viewerA");
      await assertFails(getDoc(doc(db, "organisations/orgA/users/userS2")));
    });

    it("30. staff scoped to s1 submits training record with schoolId=s2 -> deny", async () => {
      await seedUser("orgA", "staffA", {
        role: "staff",
        schoolIds: ["s1"],
        staffId: "st1",
        enabledModules: ["trainingTrack"],
      });

      const db = authed("staffA");
      await assertFails(
        setDoc(doc(db, "organisations/orgA/modules/trainingTrack/trainingRecords/rBadScope"), {
          staffId: "st1",
          schoolId: "s2",
          trainingTypeId: "tt1",
          createdBy: "staffA",
          createdAt: ts,
          updatedAt: ts,
        }),
      );
    });
  });

  describe("4.10 Seeded Module Health Indicators", () => {
    it("31. seeded moduleHealth states are readable and preserved for entitled user", async () => {
      await seedUser("orgA", "viewerWithModule", {
        role: "viewer",
        schoolIds: ["s1"],
        enabledModules: ["trainingTrack"],
      });

      const seededStates = ["green", "amber", "red", "grey"] as const;
      const db = authed("viewerWithModule");

      for (const state of seededStates) {
        await seedDoc("organisations/orgA/moduleHealth/trainingTrack", {
          state,
          openRiskCount: 0,
          lastCalculatedAt: ts,
        });

        const snap = await assertSucceeds(
          getDoc(doc(db, "organisations/orgA/moduleHealth/trainingTrack")),
        );
        expect(snap.data()?.state).toBe(state);
      }
    });
  });
});
