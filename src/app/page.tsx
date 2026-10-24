import { AppShell } from "@/components/qubit/shell/app-shell";
import { QubitNavProvider } from "@/components/qubit/nav-context";
import { RoleProvider } from "@/components/qubit/role-context";

// IAM: every visitor starts unauthenticated on the sign-in screen. After a
// verified credential login (+MFA) the shell routes to the personalized home
// screen computed server-side from the identity's entitlements.
export default function Home() {
  return (
    <RoleProvider>
      <QubitNavProvider initialScreen="login">
        <AppShell />
      </QubitNavProvider>
    </RoleProvider>
  );
}
