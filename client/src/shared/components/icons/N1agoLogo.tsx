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
      <circle cx="32" cy="36" r="16" fill="#FBBF24" />
      <circle cx="26" cy="34" r="3" fill="white" />
      <circle cx="38" cy="34" r="3" fill="white" />
      <circle cx="26" cy="34" r="1.5" fill="#1E293B" />
      <circle cx="38" cy="34" r="1.5" fill="#1E293B" />
      <path
        d="M28 43C28 43 30 45 32 45C34 45 36 43 36 43"
        stroke="#1E293B"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="32" cy="20" rx="14" ry="4" fill="white" />
      <rect x="18" y="16" width="28" height="6" fill="white" />
      <path
        d="M18 22L18 16C18 14 20 12 22 12H42C44 12 46 14 46 16V22"
        stroke="#3B82F6"
        strokeWidth="2"
        fill="none"
      />
      <rect x="22" y="10" width="20" height="4" rx="2" fill="#3B82F6" />
      <circle cx="32" cy="12" r="2" fill="#60A5FA" />
      <path
        d="M12 32C12 26 16 22 20 22"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M52 32C52 26 48 22 44 22"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M20 22H44"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="36" r="5" fill="#1E40AF" />
      <circle cx="12" cy="36" r="2.5" fill="#60A5FA" />
      <circle cx="52" cy="36" r="5" fill="#1E40AF" />
      <circle cx="52" cy="36" r="2.5" fill="#60A5FA" />
      <path
        d="M12 41L12 50C12 51 13 52 14 52H18"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="20" cy="52" rx="4" ry="3" fill="#1E40AF" />
    </svg>
  );
}
