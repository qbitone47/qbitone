import { AppShell } from "@/components/qubit/shell/app-shell";
import { QubitNavProvider } from "@/components/qubit/nav-context";
import { RoleProvider } from "@/components/qubit/role-context";

export default function Home() {
  return (
    <RoleProvider>
      <QubitNavProvider initialScreen="ceo-overview">
        <AppShell />
      </QubitNavProvider>
    </RoleProvider>
  );
}
