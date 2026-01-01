import { useState, useRef, useCallback, ReactNode } from "react";
import { Link } from "wouter";
import { Home, Sparkles, Settings, LogOut, MessageCircle, BarChart3, Menu, X } from "lucide-react";
import { useAuth, useConfirmation } from "../../hooks";
import { NavLink } from "./NavLink";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { N1agoLogo } from "../icons/N1agoLogo";
import { ConfirmModal } from "../ui/ConfirmModal";
import { MobileNavMenu, type NavItem } from "./MobileNavMenu";

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/atendimentos", label: "Atendimentos", icon: MessageCircle },
  { href: "/ai", label: "Config. IA", icon: Sparkles },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/settings", label: "Config.", icon: Settings },
];

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user } = useAuth();
  const confirmation = useConfirmation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleLogout = () => {
    closeMobileMenu();
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
              ref={menuToggleRef}
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
                {navItems.slice(0, 4).map(({ href, label, icon: Icon }) => (
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
          onClose={closeMobileMenu} 
          onLogout={handleLogout}
          toggleButtonRef={menuToggleRef}
          navItems={navItems}
        />
      </header>

      <main className="w-full px-4 py-4 sm:px-6 lg:px-8">
        {children}
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
