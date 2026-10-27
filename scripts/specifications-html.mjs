// Renders docs/specifications.md as docs/specifications.html: one self-contained page with a table
// of contents, the project's colour tokens in light and dark, and the typeface embedded. The
// Markdown stays the source; run `node scripts/specifications-html.mjs` after changing it.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const md = readFileSync(new URL('docs/specifications.md', root), 'utf8');
/** The version, from the document's own first line under the title, such as "Version 2.1, 27 October 2026." */
const version = /^Version ([\d.]+)/m.exec(md)?.[1] ?? '';
const font = (w) =>
  readFileSync(
    new URL(
      `node_modules/@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-${w}-normal.woff2`,
      root,
    ),
  ).toString('base64');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Bold, italics, code and bare web addresses, inside one line of text. */
function inline(text) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s.,;:)]|$)/g, '$1<em>$2</em>')
    .replace(/(https?:\/\/[^\s<)]+[^\s<).,])/g, '<a href="$1">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}

const slug = (t) => {
  const n = t.match(/^(\d+(?:\.\d+)?)\s/);
  if (n) return `s-${n[1].replace('.', '-')}`;
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

const lines = md.split('\n');
const out = [];
const toc = [];
let title = 'graphview: specifications';
let i = 0;
const cells = (row) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));

while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) {
    i++;
    continue;
  }
  if (line.startsWith('```')) {
    const lang = line.slice(3).trim();
    const body = [];
    for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
    i++;
    out.push(`<pre${lang ? ` data-lang="${lang}"` : ''}><code>${esc(body.join('\n'))}</code></pre>`);
    continue;
  }
  const h = line.match(/^(#{1,3})\s+(.*)$/);
  if (h) {
    const level = h[1].length;
    const text = h[2];
    if (level === 1) {
      title = text;
      out.push(`<h1>${inline(text)}</h1>`);
    } else {
      const id = slug(text);
      toc.push({ level, id, text });
      out.push(
        `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inline(text)}</h${level}>`,
      );
    }
    i++;
    continue;
  }
  if (/^---+$/.test(line.trim())) {
    out.push('<hr>');
    i++;
    continue;
  }
  if (line.startsWith('|')) {
    const rows = [];
    for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]);
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    out.push(
      `<div class="table"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`,
    );
    continue;
  }
  const list = line.match(/^(-|\d+\.)\s+/);
  if (list) {
    const ordered = list[1] !== '-';
    const items = [];
    for (; i < lines.length; i++) {
      const m = lines[i].match(/^(-|\d+\.)\s+(.*)$/);
      if (m && (m[1] !== '-') === ordered) items.push(m[2]);
      else if (lines[i].startsWith('  ') && items.length) items[items.length - 1] += ` ${lines[i].trim()}`;
      else break;
    }
    const tag = ordered ? 'ol' : 'ul';
    out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
    continue;
  }
  const para = [];
  for (; i < lines.length && lines[i].trim() && !/^(#|```|\||-\s|\d+\.\s|---)/.test(lines[i]); i++)
    para.push(lines[i].trim());
  out.push(`<p>${inline(para.join(' '))}</p>`);
}

// The table of contents: sections, each with its subsections.
const tocHtml = [];
for (let k = 0; k < toc.length; k++) {
  const t = toc[k];
  if (t.level !== 2) continue;
  const subs = [];
  for (let j = k + 1; j < toc.length && toc[j].level === 3; j++) subs.push(toc[j]);
  tocHtml.push(
    `<li><a href="#${t.id}">${inline(t.text)}</a>${
      subs.length ? `<ol>${subs.map((s) => `<li><a href="#${s.id}">${inline(s.text)}</a></li>`).join('')}</ol>` : ''
    }</li>`,
  );
}

const css = `
@font-face { font-family: 'Atkinson Hyperlegible Next'; font-weight: 400; font-display: swap;
  src: url(data:font/woff2;base64,${font(400)}) format('woff2'); }
@font-face { font-family: 'Atkinson Hyperlegible Next'; font-weight: 600; font-display: swap;
  src: url(data:font/woff2;base64,${font(600)}) format('woff2'); }
@font-face { font-family: 'Atkinson Hyperlegible Next'; font-weight: 700; font-display: swap;
  src: url(data:font/woff2;base64,${font(700)}) format('woff2'); }
:root {
  --surface: #F6F8F9; --plane: #EDF1F3; --panel: #FFFFFF; --ink-1: #13222E; --ink-2: #46596A;
  --muted: #5A6B7E; --hairline: #D5DDE2; --accent: #2A78D6; --code: #EDF1F3;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --surface: #0F151A; --plane: #0A0F13; --panel: #141B21; --ink-1: #E8EEF2; --ink-2: #A9B8C4;
    --muted: #8C9DAB; --hairline: #24303A; --accent: #3987E5; --code: #0A0F13; color-scheme: dark;
  }
}
:root[data-theme='dark'] {
  --surface: #0F151A; --plane: #0A0F13; --panel: #141B21; --ink-1: #E8EEF2; --ink-2: #A9B8C4;
  --muted: #8C9DAB; --hairline: #24303A; --accent: #3987E5; --code: #0A0F13; color-scheme: dark;
}
* { box-sizing: border-box; }
html { scroll-padding-top: 72px; }
body { margin: 0; background: var(--plane); color: var(--ink-1);
  font: 16px/1.6 'Atkinson Hyperlegible Next', system-ui, sans-serif; }
a { color: var(--accent); }
.bar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px;
  height: 56px; padding: 0 20px; background: var(--panel); border-bottom: 1px solid var(--hairline); }
.bar .name { font-weight: 700; }
.bar .version { color: var(--muted); font-size: 14px; }
.bar .grow { flex: 1; }
.button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font: inherit; font-size: 14px;
  color: var(--ink-1); background: var(--panel); border: 1px solid var(--hairline); border-radius: 6px;
  text-decoration: none; cursor: pointer; }
.button:hover { border-color: var(--ink-2); }
.layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); }
nav.toc { position: sticky; top: 56px; align-self: start; max-height: calc(100vh - 56px); overflow: auto;
  padding: 20px 16px 40px 20px; font-size: 14px; border-right: 1px solid var(--hairline); }
nav.toc h2 { margin: 0 0 8px; padding: 0; border: 0; font-size: 13px; font-weight: 600; color: var(--muted); }
nav.toc ol { list-style: none; margin: 0; padding: 0; }
nav.toc li { margin: 2px 0; }
nav.toc ol ol { margin: 2px 0 8px 12px; padding-left: 8px; border-left: 1px solid var(--hairline); }
nav.toc a { display: block; padding: 2px 6px; border-radius: 4px; color: var(--ink-2); text-decoration: none; }
nav.toc a:hover { color: var(--ink-1); background: var(--plane); }
nav.toc a.here { color: var(--ink-1); background: var(--surface); font-weight: 600; }
nav.toc > ol > li > a { color: var(--ink-1); font-weight: 600; }
main { min-width: 0; padding: 32px 48px 96px; background: var(--surface); }
article { max-width: 820px; }
h1 { margin: 0 0 8px; font-size: 32px; line-height: 1.2; }
h2 { margin: 48px 0 12px; padding-top: 16px; font-size: 24px; border-top: 1px solid var(--hairline); }
h3 { margin: 28px 0 8px; font-size: 18px; }
h2, h3 { position: relative; }
.anchor { position: absolute; left: -22px; color: var(--muted); text-decoration: none; opacity: 0; }
h2:hover .anchor, h3:hover .anchor { opacity: 1; }
p, li { max-width: 72ch; }
hr { border: 0; }
code { font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 0.86em;
  padding: 1px 5px; background: var(--code); border-radius: 4px; }
pre { overflow: auto; padding: 14px 16px; background: var(--code); border: 1px solid var(--hairline);
  border-radius: 8px; font-size: 13px; line-height: 1.5; }
pre code { padding: 0; background: none; font-size: inherit; }
.table { overflow-x: auto; margin: 12px 0 20px; border: 1px solid var(--hairline); border-radius: 8px; background: var(--panel); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 7px 10px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--hairline); }
tr:last-child td { border-bottom: 0; }
th { color: var(--ink-2); font-weight: 600; background: var(--plane); }
.toc-toggle { display: none; }
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  nav.toc { position: fixed; inset: 56px 0 0 0; z-index: 3; align-self: stretch; height: calc(100vh - 56px);
    max-height: none; background: var(--panel);
    border-right: 0; display: none; }
  nav.toc.open { display: block; }
  .toc-toggle { display: inline-flex; }
  main { padding: 24px 16px 64px; }
  .anchor { display: none; }
  .bar .version { display: none; }
  .bar { gap: 8px; padding: 0 12px; }
  .bar .long { display: none; }
}
@media (max-width: 420px) {
  .bar .name { display: none; }
}
@media print {
  .bar, nav.toc { display: none; }
  .layout { display: block; }
  main { padding: 0; background: none; }
  h2 { break-after: avoid; } h3 { break-after: avoid; } pre, .table { break-inside: avoid; }
}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>graphview specifications</title>
<meta name="description" content="The consolidated specification for building graphview, a graph viewer in 2D and 3D, in one run.">
<style>${css}</style>
</head>
<body>
<header class="bar">
  <button class="button toc-toggle" type="button" aria-expanded="false" aria-controls="toc">Contents</button>
  <span class="name">graphview</span><span class="version">Specifications, version ${version}</span>
  <span class="grow"></span>
  <a class="button" href="specifications.md" download><span class="long">Download</span> Markdown</a>
  <a class="button" href="specifications.html" download><span class="long">Download</span> HTML</a>
  <button class="button" type="button" id="theme" aria-label="Switch between light and dark">Theme</button>
</header>
<div class="layout">
<nav class="toc" id="toc" aria-label="Contents"><h2>Contents</h2><ol>${tocHtml.join('')}</ol></nav>
<main><article>
${out.join('\n')}
</article></main>
</div>
<script>
  // Marks the section in view in the contents, and opens the contents on narrow screens.
  const toc = document.getElementById('toc');
  const links = new Map([...document.querySelectorAll('nav.toc a')].map((a) => [a.getAttribute('href').slice(1), a]));
  const heads = [...document.querySelectorAll('h2[id], h3[id]')];
  let marked = null;
  let queued = false;
  function mark() {
    queued = false;
    // The section in view is the last heading above the top fifth of the window.
    let here = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top < innerHeight / 5) here = h;
    const a = links.get(here.id);
    if (!a || a === marked) return;
    marked?.classList.remove('here');
    a.classList.add('here');
    marked = a;
    // Keep the marked entry in view inside the contents only; the page itself does not move.
    const r = a.getBoundingClientRect();
    const n = toc.getBoundingClientRect();
    if (toc.offsetParent && (r.top < n.top || r.bottom > n.bottom)) toc.scrollTop += r.top - n.top - n.height / 2;
  }
  addEventListener('scroll', () => {
    if (!queued) requestAnimationFrame(mark);
    queued = true;
  }, { passive: true });
  mark();
  const toggle = document.querySelector('.toc-toggle');
  toggle.addEventListener('click', () => {
    const open = toc.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  toc.addEventListener('click', (e) => {
    if (e.target.closest('a') && toc.classList.contains('open')) toggle.click();
  });
  const root = document.documentElement;
  let theme = null;
  try { theme = localStorage.getItem('gv-spec-theme'); } catch {}
  if (theme) root.dataset.theme = theme;
  document.getElementById('theme').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('gv-spec-theme', root.dataset.theme); } catch {}
  });
</script>
</body>
</html>
`;

writeFileSync(new URL('docs/specifications.html', root), html);
console.log(
  `docs/specifications.html: ${toc.filter((t) => t.level === 2).length} sections, ${toc.filter((t) => t.level === 3).length} subsections, ${title}`,
);
