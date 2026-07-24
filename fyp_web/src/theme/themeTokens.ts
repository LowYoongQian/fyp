export const THEME_TOKENS = {
  // These resolve at render time, so inline-styled profile/security dialogs
  // follow the same root theme as the rest of the application.
  bg: 'var(--theme-bg)',
  surface: 'var(--theme-surface)',
  surfaceElevated: 'var(--theme-surface-elevated)',
  border: 'var(--theme-border)',
  textPrimary: 'var(--theme-text-primary)',
  textSecondary: 'var(--theme-text-secondary)',
  accent: '#2563eb',          // Single Primary Accent: BLUE (no purple or pink)
  accentHover: '#1d4ed8',     // Blue hover state
  accentLight: 'rgba(37, 99, 235, 0.15)', // Blue tint background
  success: '#10b981',         // Success green
  warning: '#f59e0b',         // Warning orange
  danger: '#ef4444',          // Danger red
};
