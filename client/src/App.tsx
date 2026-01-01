import { useAuth } from "./shared/hooks";
import { TimezoneProvider } from "./contexts/TimezoneContext";
import { AuthenticatedLayout } from "./shared/components/layout";
import { AppRoutes } from "./routes";
import { LandingPage, LoadingPage, UnauthorizedPage } from "./shared/pages";

function AuthenticatedApp() {
  return (
    <AuthenticatedLayout>
      <AppRoutes />
    </AuthenticatedLayout>
  );
}

export default function App() {
  const { user, isLoading, isUnauthorized, unauthorizedMessage } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (isUnauthorized) {
    return <UnauthorizedPage message={unauthorizedMessage || "Você não tem permissão para acessar esta aplicação"} />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <TimezoneProvider>
      <AuthenticatedApp />
    </TimezoneProvider>
  );
}
