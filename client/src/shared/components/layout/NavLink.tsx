import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";

interface NavLinkProps {
  href: string;
  children: ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const [location] = useLocation();
  const isActive = href === "/" 
    ? location === "/" 
    : location === href || location.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
        isActive
          ? "border-primary text-primary"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </Link>
  );
}
