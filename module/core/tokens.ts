// The thirteen colour tokens of specification F2. CSS custom properties are generated from them.

export type TokenName =
  | 'surface'
  | 'plane'
  | 'panel'
  | 'ink-1'
  | 'ink-2'
  | 'muted'
  | 'hairline'
  | 'ring'
  | 'context'
  | 'outgoing'
  | 'incoming'
  | 'path'
  | 'issue';

export type Theme = 'light' | 'dark';

export const tokens: Record<Theme, Record<TokenName, string>> = {
  light: {
    surface: '#F6F8F9',
    plane: '#EDF1F3',
    panel: '#FFFFFF',
    'ink-1': '#13222E',
    'ink-2': '#46596A',
    muted: '#5A6B7E',
    hairline: '#D5DDE2',
    ring: '#7D8E9C',
    context: '#74859A',
    outgoing: '#2A78D6',
    incoming: '#EB6834',
    path: '#17A070',
    issue: '#D03B3B',
  },
  dark: {
    surface: '#0F151A',
    plane: '#0A0F13',
    panel: '#141B21',
    'ink-1': '#E8EEF2',
    'ink-2': '#A9B8C4',
    muted: '#8C9DAB',
    hairline: '#24303A',
    ring: '#5E7080',
    context: '#7F909E',
    outgoing: '#3987E5',
    incoming: '#D95926',
    path: '#199E70',
    issue: '#D03B3B',
  },
};

/** CSS declarations "--gv-<token>: <value>;" for one theme, with optional host overrides. */
export function cssVariables(theme: Theme, overrides: Partial<Record<TokenName, string>> = {}): string {
  const t = { ...tokens[theme], ...overrides };
  return (Object.keys(t) as TokenName[]).map((name) => `--gv-${name}: ${t[name]};`).join(' ');
}
