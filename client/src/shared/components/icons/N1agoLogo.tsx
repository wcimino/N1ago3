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
      <rect x="16" y="20" width="32" height="28" rx="6" fill="#3B82F6" />
      <rect x="20" y="26" width="10" height="8" rx="2" fill="white" />
      <rect x="34" y="26" width="10" height="8" rx="2" fill="white" />
      <circle cx="25" cy="30" r="2" fill="#1E3A5F" />
      <circle cx="39" cy="30" r="2" fill="#1E3A5F" />
      <rect x="26" y="38" width="12" height="4" rx="2" fill="white" />
      <rect x="28" y="14" width="8" height="6" rx="2" fill="#60A5FA" />
      <path
        d="M8 28C8 24 10 22 14 22"
        stroke="#1E3A5F"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="32" r="5" fill="#1E3A5F" />
      <circle cx="8" cy="32" r="3" fill="#60A5FA" />
      <path
        d="M56 28C56 24 54 22 50 22"
        stroke="#1E3A5F"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="56" cy="32" r="5" fill="#1E3A5F" />
      <circle cx="56" cy="32" r="3" fill="#60A5FA" />
      <path
        d="M14 22H50"
        stroke="#1E3A5F"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M8 38V44C8 46 10 48 14 48"
        stroke="#1E3A5F"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="18" cy="50" rx="6" ry="3" fill="#1E3A5F" />
    </svg>
  );
}
