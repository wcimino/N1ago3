import { Route, Switch, Link } from "wouter";
import { Home, Users, Activity, Sparkles, Settings, LogOut } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { NavLink, EnvironmentBadge } from "./components";
import {
  LandingPage,
  UnauthorizedPage,
  LoadingPage,
  HomePage,
  AIPage,
  EventsLayout,
  UsersPage,
  UserConversationsPage,
  AuthorizedUsersPage,
} from "./pages";

function AuthenticatedApp() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <EnvironmentBadge />
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-gray-700">
              N1ago
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.email}
              </span>
              <Link
                href="/authorized-users"
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <a
                href="/api/logout"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </a>
            </div>
          </div>
          <nav className="flex gap-1 -mb-px">
            <NavLink href="/">
              <Home className="w-4 h-4" />
              Home
            </NavLink>
            <NavLink href="/users">
              <Users className="w-4 h-4" />
              Usuários
            </NavLink>
            <NavLink href="/events">
              <Activity className="w-4 h-4" />
              Eventos
            </NavLink>
            <NavLink href="/ai">
              <Sparkles className="w-4 h-4" />
              AI
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/ai" component={AIPage} />
          <Route path="/events" component={EventsLayout} />
          <Route path="/events/:rest*" component={EventsLayout} />
          <Route path="/users" component={UsersPage} />
          <Route path="/users/:userId">{(params) => <UserConversationsPage params={params} />}</Route>
          <Route path="/authorized-users" component={AuthorizedUsersPage} />
        </Switch>
      </main>
    </div>
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

  return <AuthenticatedApp />;
}
