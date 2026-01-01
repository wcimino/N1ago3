import { useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface MobileNavMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  toggleButtonRef: React.RefObject<HTMLButtonElement>;
  navItems: NavItem[];
}

export function MobileNavMenu({ isOpen, onClose, onLogout, toggleButtonRef, navItems }: MobileNavMenuProps) {
  const [location] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (toggleButtonRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, toggleButtonRef]);

  const prevLocationRef = useRef(location);
  useEffect(() => {
    if (prevLocationRef.current !== location) {
      prevLocationRef.current = location;
      onClose();
    }
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
