export default function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className ?? ""}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21v-9" />
        <path d="M12 12C12 8 9.5 5.5 5 5c-.2 4.5 2.3 7 7 7z" />
        <path d="M12 14c0-3 2-5 6-5.5.2 3.5-1.8 5.5-6 5.5z" />
        <path d="M8.5 21h7" />
      </svg>
      <span>Crop CMS</span>
    </span>
  );
}
