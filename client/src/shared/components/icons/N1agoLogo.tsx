interface N1agoLogoProps {
  className?: string;
}

export function N1agoLogo({ className = "w-8 h-8" }: N1agoLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="32" cy="34" r="18" fill="#3B82F6" />
      <circle cx="25" cy="32" r="4" fill="white" />
      <circle cx="39" cy="32" r="4" fill="white" />
      <circle cx="25" cy="32" r="2" fill="#1E40AF" />
      <circle cx="39" cy="32" r="2" fill="#1E40AF" />
      <path
        d="M26 42C26 42 29 45 32 45C35 45 38 42 38 42"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="28" y="14" width="8" height="6" rx="3" fill="#60A5FA" />
      <path
        d="M10 30C10 26 13 24 18 24"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M54 30C54 26 51 24 46 24"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M18 24H46"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="10" cy="34" r="5" fill="#1E40AF" />
      <circle cx="10" cy="34" r="2.5" fill="#60A5FA" />
      <circle cx="54" cy="34" r="5" fill="#1E40AF" />
      <circle cx="54" cy="34" r="2.5" fill="#60A5FA" />
    </svg>
  );
}
