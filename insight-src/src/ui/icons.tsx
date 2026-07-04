// Inline icon set — stroke 1.5, currentColor, 20px default. No emoji in product UI.
import React from 'react';

export interface IconProps { size?: number; className?: string; }

function I({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Logo = ({ size = 22, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="12" width="3.6" height="8" rx="1.2" fill="#3a6df4" />
    <rect x="10.2" y="7" width="3.6" height="13" rx="1.2" fill="#7c4dff" />
    <rect x="17.4" y="3" width="3.6" height="17" rx="1.2" fill="#19c9a6" />
  </svg>
);

export const UploadIcon = (p: IconProps) => <I {...p}><path d="M12 16V4m0 0 4 4m-4-4-4 4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></I>;
export const TableIcon = (p: IconProps) => <I {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9.5h18M9 9.5V20" /></I>;
export const ChartIcon = (p: IconProps) => <I {...p}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15v-4m4 4V8m4 7v-6" /></I>;
export const ChatIcon = (p: IconProps) => <I {...p}><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" /></I>;
export const SparkIcon = (p: IconProps) => <I {...p}><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1" /></I>;
export const ShieldIcon = (p: IconProps) => <I {...p}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" /><path d="m9.5 12 1.8 1.8 3.2-3.6" /></I>;
export const FilterIcon = (p: IconProps) => <I {...p}><path d="M4 6h16M7 12h10m-7 6h4" /></I>;
export const XIcon = (p: IconProps) => <I {...p}><path d="m6 6 12 12M18 6 6 18" /></I>;
export const CheckIcon = (p: IconProps) => <I {...p}><path d="m5 13 4 4L19 7" /></I>;
export const ArrowRight = (p: IconProps) => <I {...p}><path d="M5 12h14m0 0-5-5m5 5-5 5" /></I>;
export const PlusIcon = (p: IconProps) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const TrashIcon = (p: IconProps) => <I {...p}><path d="M4 7h16m-2 0-1 13H7L6 7m4-3h4m-9 3h14" /></I>;
export const LinkIcon = (p: IconProps) => <I {...p}><path d="M10 14a4 4 0 0 0 6 .4l3-3a4 4 0 1 0-5.7-5.7L12 7" /><path d="M14 10a4 4 0 0 0-6-.4l-3 3a4 4 0 1 0 5.7 5.7L12 17" /></I>;
export const FileIcon = (p: IconProps) => <I {...p}><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4" /></I>;
export const GridIcon = (p: IconProps) => <I {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></I>;
export const GearIcon = (p: IconProps) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1m-10 10-2.1 2.1" /></I>;
export const UserIcon = (p: IconProps) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></I>;
export const ClockIcon = (p: IconProps) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></I>;
export const WandIcon = (p: IconProps) => <I {...p}><path d="m14 7 3 3L7 20H4v-3L14 7Z" /><path d="M13 4.5 15.5 2 18 4.5 15.5 7M19 11l1.5 1.5" /></I>;
export const DownloadIcon = (p: IconProps) => <I {...p}><path d="M12 4v12m0 0 4-4m-4 4-4-4" /><path d="M4 19h16" /></I>;
export const PinIcon = (p: IconProps) => <I {...p}><path d="M9 4h6l1 7 2 2v2H6v-2l2-2 1-7Z" /><path d="M12 15v6" /></I>;
export const BoltIcon = (p: IconProps) => <I {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></I>;
export const EyeIcon = (p: IconProps) => <I {...p}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></I>;
export const FolderIcon = (p: IconProps) => <I {...p}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" /></I>;
export const GlobeIcon = (p: IconProps) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></I>;

export const GoogleIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.2v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4.1-3.1Z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8L20.1 3A12 12 0 0 0 1.2 6.6l4.1 3.1A7.2 7.2 0 0 1 12 4.8Z" />
  </svg>
);
