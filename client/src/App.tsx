import { Route, Switch, Link } from "wouter";
import { Home, Users, Sparkles, Settings, LogOut, MessageCircle, Download, BookOpen } from "lucide-react";
import { useAuth } from "./shared/hooks";
import { NavLink, EnvironmentBadge, N1agoLogo } from "./shared/components";
import { TimezoneProvider } from "./contexts/TimezoneContext";
import { AIPage } from "./features/ai";
import { SettingsPage, ProductStandardsPage, ReprocessingPage, AutoClosePage } from "./features/settings";
import { EventsLayout } from "./features/events";
import { AtendimentosPage, UserConversationsPage } from "./features/conversations";
import { CadastroPage, UserStandardDetailPage, OrganizationStandardDetailPage } from "./features/cadastro";
import { ExportPage } from "./features/export";
import { KnowledgeBasePage } from "./features/knowledge-base";
import { LandingPage, LoadingPage, UnauthorizedPage, HomePage } from "./shared/pages";

function AuthenticatedApp() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <EnvironmentBadge />
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <Link href="/" className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900 hover:text-gray-700">
              <N1agoLogo className="w-8 h-8" />
              N1ago
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-[200px]">
                {user?.email}
              </span>
              <Link
                href="/settings"
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Configurações"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <button
                onClick={() => {
                  if (window.confirm("Tem certeza que deseja sair?")) {
                    window.location.href = "/api/logout";
                  }
                }}
                className="inline-flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
          <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide pb-px">
            <NavLink href="/">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </NavLink>
            <NavLink href="/cadastro">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Cadastro</span>
            </NavLink>
            <NavLink href="/atendimentos">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Atendimentos</span>
            </NavLink>
            <NavLink href="/ai">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">AI</span>
            </NavLink>
            <NavLink href="/export">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportações</span>
            </NavLink>
            <NavLink href="/knowledge-base">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Base de Conhecimento</span>
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/ai" component={AIPage} />
          <Route path="/ai/settings/:rest*" component={AIPage} />
          <Route path="/settings/events" component={EventsLayout} />
          <Route path="/settings/events/:rest*" component={EventsLayout} />
          <Route path="/cadastro">{() => <CadastroPage activeTab="usuarios" />}</Route>
          <Route path="/cadastro/organizacoes">{() => <CadastroPage activeTab="organizacoes" />}</Route>
          <Route path="/cadastro/users/:email">{(params) => <UserStandardDetailPage params={params} />}</Route>
          <Route path="/cadastro/organizations/:cnpjRoot">{(params) => <OrganizationStandardDetailPage params={params} />}</Route>
          <Route path="/atendimentos" component={AtendimentosPage} />
          <Route path="/atendimentos/:userId">{(params) => <UserConversationsPage params={params} />}</Route>
          <Route path="/export" component={ExportPage} />
          <Route path="/export/:rest*" component={ExportPage} />
          <Route path="/knowledge-base" component={KnowledgeBasePage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/settings/product-standards" component={ProductStandardsPage} />
          <Route path="/settings/reprocessing" component={ReprocessingPage} />
          <Route path="/settings/auto-close" component={AutoClosePage} />
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

  return (
    <TimezoneProvider>
      <AuthenticatedApp />
    </TimezoneProvider>
  );
}
