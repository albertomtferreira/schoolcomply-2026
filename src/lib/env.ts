import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_APP_ENV: z.enum(["dev", "staging", "prod"]).default("dev"),
});

const serverEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FIREBASE_USE_EMULATORS: z.enum(["true", "false"]).default("false"),
  FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
  FIREBASE_STORAGE_EMULATOR_HOST: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getClientEnv(): ClientEnv {
  return clientEnvSchema.parse(process.env);
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}

