// Simple line icons, drawn with the current text colour.
function Icon({ size = 18, strokeWidth = 2, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p) => <Icon strokeWidth={3} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const PlusIcon = (p) => <Icon strokeWidth={2.4} {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const BackIcon = (p) => <Icon {...p}><path d="M15 6l-6 6 6 6" /></Icon>;
export const SearchIcon = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Icon>;
export const LocateIcon = (p) => <Icon {...p}><path d="M3 11l18-8-8 18-2-8z" /></Icon>;
export const CloseIcon = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const ExternalIcon = (p) => <Icon {...p}><path d="M7 17L17 7M9 7h8v8" /></Icon>;
export const ShareIcon = (p) => (
  <Icon {...p}><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></Icon>
);
export const PinIcon = (p) => (
  <Icon strokeWidth={1.8} {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Icon>
);
export const UsersIcon = (p) => (
  <Icon {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5" /><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 15.3c1.8.6 3 2.1 3.5 4.7" /></Icon>
);
export const UserIcon = (p) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6" /></Icon>;
export const MoonIcon = (p) => <Icon {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Icon>;
export const SunIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);
export const FiltersIcon = (p) => <Icon {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>;
export const ShieldIcon = (p) => (
  <Icon {...p}><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></Icon>
);
