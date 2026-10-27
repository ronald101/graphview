// The page wears the module's colour tokens as --gv-* properties, so that the shell and the
// module's panels share one set of colours.
import { tokens } from '../../module/index.ts';

export function wearTokens(theme: 'light' | 'dark') {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens[theme])) root.style.setProperty(`--gv-${k}`, v);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
