import { Link, useLocation } from "wouter";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const [location] = useLocation();
  const isActive = location === href;

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
        isActive
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </Link>
  );
}
