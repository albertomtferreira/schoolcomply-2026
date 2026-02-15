import type { User } from "firebase/auth";

type BootstrapUserResponse = {
  ok: boolean;
  orgId?: string;
};

const ORG_ID_STORAGE_KEY = "schooltrack.orgId";

export async function bootstrapUserProfile(
  user: User,
): Promise<{ orgId: string | null }> {
  const token = await user.getIdToken();
  const response = await fetch("/api/bootstrap-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to bootstrap user profile.");
  }

  const payload = (await response.json()) as BootstrapUserResponse;
  if (payload.ok && typeof payload.orgId === "string" && payload.orgId.length > 0) {
    window.localStorage.setItem(ORG_ID_STORAGE_KEY, payload.orgId);
  }

  await user.getIdToken(true);
  return {
    orgId:
      payload.ok && typeof payload.orgId === "string" && payload.orgId.length > 0
        ? payload.orgId
        : null,
  };
}
