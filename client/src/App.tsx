import { useState, useRef, useEffect } from "react";
import { Route, Switch, Link, Redirect, useLocation } from "wouter";
import { Home, Sparkles, Settings, LogOut, MessageCircle, BookOpen, BarChart3, Menu, X, ChevronDown } from "lucide-react";
import { useAuth, useConfirmation } from "./shared/hooks";
import { NavLink, EnvironmentBadge, N1agoLogo, ConfirmModal } from "./shared/components";
import { TimezoneProvider } from "./contexts/TimezoneContext";
import { AIPage } from "./features/ai";
import { SettingsPage, ProductStandardsPage, ReprocessingPage, AutoClosePage, ProductCatalogPage, DuplicatesPage, ArchivePage, ZendeskUsersPage, ZendeskUserDetailPage } from "./features/settings";
import { EventsLayout } from "./features/events";
import { AtendimentosPage, UserConversationsPage } from "./features/conversations";
import { CadastroPage, UserStandardDetailPage, OrganizationStandardDetailPage } from "./features/cadastro";
import { ExportPage } from "./features/export";
import { KnowledgeBasePage } from "./features/knowledge";
import { ReportsPage, QuestionTopicsPage } from "./features/reports";
import { RoutingRulesPage } from "./features/routing";
import { LandingPage, LoadingPage, UnauthorizedPage, HomePage } from "./shared/pages";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/atendimentos", label: "Atendimentos", icon: MessageCircle },
  { href: "/ai", label: "Config. IA", icon: Sparkles },
  { href: "/knowledge-base", label: "Conhecimento", icon: BookOpen },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/settings", label: "Config.", icon: Settings },
];

function MobileNavMenu({ isOpen, onClose, onLogout }: { isOpen: boolean; onClose: () => void; onLogout: () => void }) {
  const [location] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    onClose();
  }, [location, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={menuRef} className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-50 md:hidden">
      <nav className="py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? "text-primary bg-primary/5 border-l-2 border-primary" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
        <div className="border-t my-2" />
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </nav>
    </div>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const confirmation = useConfirmation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    confirmation.confirm({
      title: "Sair do sistema",
      message: "Tem certeza que deseja sair?",
      confirmLabel: "Sair",
      variant: "info",
      onConfirm: () => {
        window.location.href = "/api/logout";
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <EnvironmentBadge />
      <header className="bg-white shadow-sm border-b sticky top-0 z-40 relative">
        <div className="w-full px-3 sm:px-4 lg:px-8">
          <div className="flex items-center py-2 sm:py-3 gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg md:hidden"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center text-gray-900 hover:text-gray-700 shrink-0">
              <N1agoLogo className="w-8 h-8 md:hidden" variant="icon" />
              <N1agoLogo className="hidden md:block h-9 w-auto" variant="full" />
            </Link>
            
            <nav className="hidden md:flex items-center flex-1">
              <div className="flex gap-0.5">
                {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
                  <NavLink key={href} href={href}>
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{label}</span>
                  </NavLink>
                ))}
              </div>
              <div className="ml-auto">
                <NavLink href="/settings">
                  <Settings className="w-4 h-4" />
                  <span className="hidden lg:inline">Configurações</span>
                </NavLink>
              </div>
            </nav>

            <div className="flex items-center gap-2 ml-auto md:ml-0 shrink-0">
              <span className="hidden lg:inline text-sm text-gray-600 truncate max-w-[180px]">
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
        
        <MobileNavMenu 
          isOpen={mobileMenuOpen} 
          onClose={() => setMobileMenuOpen(false)} 
          onLogout={handleLogout}
        />
      </header>

      <main className="w-full px-4 py-4 sm:px-6 lg:px-8">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/ai" component={AIPage} />
          <Route path="/ai/settings/:rest*" component={AIPage} />
          <Route path="/settings/events" component={EventsLayout} />
          <Route path="/settings/events/:rest*" component={EventsLayout} />
          <Route path="/atendimentos" component={AtendimentosPage} />
          <Route path="/atendimentos/routing" component={AtendimentosPage} />
          <Route path="/atendimentos/favoritos" component={AtendimentosPage} />
          <Route path="/atendimentos/:userId/:conversationId">{(params) => <UserConversationsPage params={params} />}</Route>
          <Route path="/atendimentos/:userId">{(params) => <UserConversationsPage params={params} />}</Route>
          <Route path="/settings/maintenance/export" component={ExportPage} />
          <Route path="/settings/maintenance/export/:rest*" component={ExportPage} />
          <Route path="/knowledge-base" component={KnowledgeBasePage} />
          <Route path="/reports" component={ReportsPage} />
          <Route path="/reports/question-topics" component={QuestionTopicsPage} />
          <Route path="/routing-rules" component={RoutingRulesPage} />
          <Route path="/settings">{() => <Redirect to="/settings/access" />}</Route>
          <Route path="/settings/access">{() => <SettingsPage activeTab="access" />}</Route>
          <Route path="/settings/general">{() => <SettingsPage activeTab="general" />}</Route>
          <Route path="/settings/catalog">{() => <SettingsPage activeTab="catalog" />}</Route>
          <Route path="/settings/maintenance">{() => <SettingsPage activeTab="maintenance" />}</Route>
          <Route path="/settings/external-data">{() => <SettingsPage activeTab="external-data" />}</Route>
          <Route path="/settings/external-events">{() => <SettingsPage activeTab="external-events" />}</Route>
          <Route path="/settings/monitoring">{() => <SettingsPage activeTab="monitoring" />}</Route>
          <Route path="/settings/external-data/zendesk-users" component={ZendeskUsersPage} />
          <Route path="/settings/external-data/zendesk-users/:id">{(params) => <ZendeskUserDetailPage params={params} />}</Route>
          <Route path="/settings/product-standards" component={ProductStandardsPage} />
          <Route path="/settings/reprocessing" component={ReprocessingPage} />
          <Route path="/settings/auto-close" component={AutoClosePage} />
          <Route path="/settings/catalog/users">{() => <CadastroPage activeTab="usuarios" />}</Route>
          <Route path="/settings/catalog/users/:email">{(params) => <UserStandardDetailPage params={params} />}</Route>
          <Route path="/settings/catalog/organizations">{() => <CadastroPage activeTab="organizacoes" />}</Route>
          <Route path="/settings/catalog/organizations/:cnpjRoot">{(params) => <OrganizationStandardDetailPage params={params} />}</Route>
          <Route path="/settings/catalog/products" component={ProductCatalogPage} />
          <Route path="/settings/maintenance/duplicates" component={DuplicatesPage} />
          <Route path="/settings/maintenance/archive" component={ArchivePage} />
        </Switch>
      </main>

      <ConfirmModal
        isOpen={confirmation.isOpen}
        onClose={confirmation.close}
        onConfirm={confirmation.handleConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel}
        variant={confirmation.variant}
      />
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
