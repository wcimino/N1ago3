import { ReactNode } from "react";

export type BadgeVariant = 
  | "success" 
  | "error" 
  | "warning" 
  | "info" 
  | "purple" 
  | "teal" 
  | "default";

export type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: ReactNode;
  size?: BadgeSize;
  rounded?: "full" | "default";
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  warning: "bg-yellow-100 text-yellow-800",
  info: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
  teal: "bg-teal-100 text-teal-800",
  default: "bg-gray-100 text-gray-800",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2 py-1 text-xs",
};

export function Badge({ 
  children, 
  variant = "default", 
  icon, 
  size = "sm",
  rounded = "default",
  className = "" 
}: BadgeProps) {
  const roundedClass = rounded === "full" ? "rounded-full" : "rounded";
  
  return (
    <span 
      className={`inline-flex items-center gap-1 font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${roundedClass} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export const badgeVariants = variantStyles;
