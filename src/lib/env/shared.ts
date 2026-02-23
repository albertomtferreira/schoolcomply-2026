import { z } from "zod";

const booleanInput = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value === "true" || value === "false", {
    message: "must be 'true' or 'false'",
  })
  .transform((value) => value === "true");

export const requiredString = z.string().trim().min(1, "is required");
export const booleanString = booleanInput;
export const appEnv = z.enum(["dev", "staging", "prod"]);

export function formatEnvErrors(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return `Environment validation failed: ${details}`;
}
