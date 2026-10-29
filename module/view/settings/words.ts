// A setting's value in words, for the note "Default: …" (specification 7.10).
import type { GraphModel } from '../../model/model.ts';
import {
  num,
  type NumberSetting,
  type OrderSetting,
  type Palette,
  type SelectSetting,
  type SetSetting,
  type Setting,
  type SliderSetting,
  type ThemeColour,
} from '../../settings/setting.svelte.ts';
import { say } from '../words.ts';

export function describe(m: GraphModel, s: Setting, v: unknown): string {
  const t = (text: string) => say(m, text);
  switch (s.control) {
    case 'checkbox':
      return t(v ? 'On' : 'Off');
    case 'slider':
    case 'number': {
      const n = s as SliderSetting<string> | NumberSetting<string, number | null>;
      if (v === null) return (n as NumberSetting<string, number | null>).none ?? '';
      return `${num(v as number)}${n.unit ? ` ${n.unit}` : ''}`;
    }
    case 'range':
      return `${num((v as number[])[0])} ${t('to')} ${num((v as number[])[1])}`;
    case 'select':
      return t((s as SelectSetting<string>).options.find(([o]) => o === v)?.[1] ?? String(v));
    case 'theme-colour':
      return `${t('light')} ${(v as ThemeColour).light}, ${t('dark')} ${(v as ThemeColour).dark}`;
    case 'palette':
      return say(m, '{light} colours light, {dark} dark', {
        light: (v as Palette).light.length,
        dark: (v as Palette).dark.length,
      });
    case 'order':
    case 'set': {
      const items = (s as OrderSetting<string> | SetSetting<string>).items;
      const list = (v as string[]).map((i) => t(items.find(([x]) => x === i)?.[1] ?? i));
      return list.length ? list.join(', ') : t('none');
    }
    case 'keys':
      return say(m, '{n} keys', { n: Object.keys(v as object).length });
    case 'json': {
      const text = JSON.stringify(v);
      return text.length > 60 ? `${text.slice(0, 57)}…` : text;
    }
    default:
      return String(v);
  }
}
