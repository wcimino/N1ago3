interface N1agoLogoProps {
  className?: string;
  variant?: "icon" | "full";
}

export function N1agoLogo({ className = "w-8 h-8", variant = "icon" }: N1agoLogoProps) {
  if (variant === "full") {
    return (
      <svg
        viewBox="0 0 115 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <g fill="currentColor">
          <rect x="6" y="18" width="7" height="30"/>
          <polygon points="6,18 13,18 26,48 19,48"/>
          <polygon points="15,4 29,4 29,48 22,48 22,9 15,9"/>
          <polygon points="29,18 36,18 53,48 46,48"/>
          <rect x="25" y="31" width="14" height="5"/>
        </g>
        <text x="52" y="48" fontFamily="system-ui, -apple-system, sans-serif" fontSize="26" fontWeight="600" fill="#64748b" letterSpacing="1">GO</text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g fill="currentColor">
        <rect x="6" y="18" width="7" height="30"/>
        <polygon points="6,18 13,18 26,48 19,48"/>
        <polygon points="15,4 29,4 29,48 22,48 22,9 15,9"/>
        <polygon points="29,18 36,18 53,48 46,48"/>
        <rect x="25" y="31" width="14" height="5"/>
      </g>
    </svg>
  );
}
