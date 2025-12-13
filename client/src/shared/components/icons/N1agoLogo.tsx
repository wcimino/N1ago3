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
      <circle cx="32" cy="32" r="28" fill="#EFF6FF" />
      <circle cx="32" cy="30" r="14" fill="#3B82F6" />
      <path
        d="M24 28C24 28 26 26 32 26C38 26 40 28 40 28"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="27" cy="30" r="2" fill="white" />
      <circle cx="37" cy="30" r="2" fill="white" />
      <path
        d="M29 35C29 35 31 37 32 37C33 37 35 35 35 35"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="28" y="44" width="8" height="8" rx="2" fill="#3B82F6" />
      <rect x="24" y="52" width="16" height="4" rx="1" fill="#1E40AF" />
      <path
        d="M14 26C14 20 18 16 24 16"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M50 26C50 20 46 16 40 16"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M24 16H40"
        stroke="#1E40AF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="10" y="24" width="8" height="10" rx="4" fill="#1E40AF" />
      <rect x="46" y="24" width="8" height="10" rx="4" fill="#1E40AF" />
      <path
        d="M10 34V42C10 44 12 46 14 46H22"
        stroke="#1E40AF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="46" r="3" fill="#1E40AF" />
    </svg>
  );
}
