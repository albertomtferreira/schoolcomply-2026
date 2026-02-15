import type { User } from "firebase/auth";

export async function refreshTrainingTrackAggregates(
  user: User,
  orgId: string,
): Promise<void> {
  const token = await user.getIdToken();
  const response = await fetch("/api/training-track/refresh-aggregates", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orgId }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh training aggregates.");
  }
}
