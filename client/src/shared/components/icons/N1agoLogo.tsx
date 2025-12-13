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
      <circle cx="26" cy="32" r="3" fill="white" />
      <circle cx="38" cy="32" r="3" fill="white" />
      <path
        d="M26 42C28 44 36 44 38 42"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M10 32C10 22 20 14 32 14C44 14 54 22 54 32"
        stroke="#1E40AF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="34" r="6" fill="#1E40AF" />
      <circle cx="54" cy="34" r="6" fill="#1E40AF" />
    </svg>
  );
}
