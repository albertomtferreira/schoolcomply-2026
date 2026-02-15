import { AuthGate } from "@/components/auth/auth-gate";
import { PlatformShell } from "@/components/platform/platform-shell";

export default function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGate>
      <PlatformShell>{children}</PlatformShell>
    </AuthGate>
  );
}
