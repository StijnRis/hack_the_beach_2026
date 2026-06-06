type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LeafIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 20c10 0 16-5 16-15-9 0-15 4-15 11" />
      <path d="M5 19c3-5 6-7 10-9" />
    </svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path
        d={
          "M12 20s-7-4.6-9.2-9C1.3 8 2.6 5 5.6 5 7.6 5 9 6.2 12 9" +
          "c3-2.8 4.4-4 6.4-4 3 0 4.3 3 2.8 6-2.2 4.4-9.2 9-9.2 9z"
        }
      />
    </svg>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path
        d={
          "M3.5 12.5 11 5h6.5a1.5 1.5 0 0 1 1.5 1.5V13l-7.5 7.5" +
          "a1.5 1.5 0 0 1-2.1 0L3.5 14.6a1.5 1.5 0 0 1 0-2.1z"
        }
      />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path
        d={
          "M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0" +
          " 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
        }
      />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function FlashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M13 2 4 13.5h6L9 22l9-11.5h-6z" />
    </svg>
  );
}

export function GalleryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="m4 17 4.5-4.5 4 4 3-3L20 17" />
    </svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M8 7h11M8 12h11M8 17h11" />
      <circle cx="4.4" cy="7" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4.4" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4.4" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HistoryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="m12 3 8.5 4.6a1 1 0 0 1 0 1.8L12 14 3.5 9.4a1 1 0 0 1 0-1.8z" />
      <path d="m4 12 8 4.4L20 12" />
      <path d="m4 16 8 4.4L20 16" />
    </svg>
  );
}

export function RotateIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3.5 12a8.5 8.5 0 1 1 2.6 6.1" />
      <path d="M3 14.5 4.2 19l4.4-1.2" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
