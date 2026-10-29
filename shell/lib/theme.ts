// The page wears the module's colour tokens as --gv-* properties, so that the shell and the
// module's panels share one set of colours: the model's, which follow the viewer's settings.
import { tokens, type TokenName } from '../../module/index.ts';

export function wearTokens(theme: 'light' | 'dark', colours: Record<TokenName, string> = tokens[theme]) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(colours)) root.style.setProperty(`--gv-${k}`, v);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
