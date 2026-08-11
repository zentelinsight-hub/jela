export const lightPalette = {
  background: '#F7F7F4',
  surface: '#FFFFFF',
  surfaceElevated: '#FCFCFA',
  text: '#171714',
  textMuted: '#66665F',
  border: '#DEDED7',
  primary: '#007F52',
  primaryPressed: '#005F3D',
  accent: '#FF7A21',
  danger: '#C6362C',
  warning: '#9A6500',
  success: '#087A50',
  overlay: 'rgba(0,0,0,0.55)',
  userBubble: '#E9F7F0',
  assistantBubble: 'transparent',
  skeleton: '#E9E9E2',
  statusBar: 'dark' as const,
};

export const darkPalette = {
  background: '#070807',
  surface: '#111310',
  surfaceElevated: '#181A17',
  text: '#F5F6F2',
  textMuted: '#A9ADA4',
  border: '#2D312B',
  primary: '#18CB88',
  primaryPressed: '#0DA66C',
  accent: '#FF8B3D',
  danger: '#FF7167',
  warning: '#F3BD55',
  success: '#31D497',
  overlay: 'rgba(0,0,0,0.75)',
  userBubble: '#16382B',
  assistantBubble: 'transparent',
  skeleton: '#252823',
  statusBar: 'light' as const,
};

export type Palette = Omit<typeof lightPalette, 'statusBar'> & { statusBar: 'light' | 'dark' };
export type ThemePreference = 'system' | 'light' | 'dark';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
