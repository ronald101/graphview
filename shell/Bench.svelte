<!-- The bench page (specification G7): speed on the machine in front of it. Open with #bench. -->
<script lang="ts">
  import { GraphView, type LayoutSettledEvent } from '../module/index.ts';
  import { exampleDoc } from './lib/examples.ts';

  interface Row {
    graph: string;
    firstPictureMs: number;
    zoom: { median: number; p95: number; frames: number };
    rotate: { median: number; p95: number; frames: number };
  }

  let doc: unknown = $state.raw(null);
  let gv: ReturnType<typeof GraphView> | undefined = $state();
  let rows: Row[] = $state([]);
  let status = $state('Press Run to measure.');
  let running = $state(false);
  let settled: ((e: LayoutSettledEvent) => void) | null = null;

  const gl = (() => {
    const c = document.createElement('canvas').getContext('webgl2');
    if (!c) return 'WebGL 2 is not available.';
    const ext = c.getExtension('WEBGL_debug_renderer_info');
    return `${c.getParameter(c.VERSION)}; ${ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)}`;
  })();

  const stats = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN);
    return { median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), frames: s.length };
  };
  const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

  async function animate(step: (t: number) => void): Promise<number[]> {
    const times: number[] = [];
    let last = await frame();
    const start = last;
    for (;;) {
      const now = await frame();
      times.push(now - last);
      last = now;
      const t = Math.min(1, (now - start) / 2000);
      step(t);
      if (t >= 1) return times;
    }
  }

  async function measure(id: string, name: string): Promise<Row> {
    status = `Loading ${name}`;
    const d = await exampleDoc(id);
    const t0 = performance.now();
    const done = new Promise<void>((r) => (settled = () => r()));
    doc = d;
    await done;
    await frame();
    await frame();
    const firstPictureMs = performance.now() - t0;
    const v = gv!;
    await v.setViewState({ camera: { ...v.getViewState().camera, zoom: 1, angle: 0 } });
    await v.fit('all');
    const base = v.getViewState().camera;
    status = `Zooming ${name}`;
    const zoom = stats(
      await animate((t) => void v.setViewState({ camera: { ...base, zoom: base.zoom * Math.pow(8, t) } })),
    );
    status = `Rotating ${name}`;
    const rotate = stats(await animate((t) => void v.setViewState({ camera: { ...base, angle: 360 * t } })));
    return { graph: name, firstPictureMs: +firstPictureMs.toFixed(0), zoom, rotate };
  }

  export async function run(): Promise<Row[]> {
    running = true;
    rows = [];
    rows.push(await measure('database-2026-07-24', 'Database graph'));
    doc = null;
    await frame();
    rows.push(await measure('random-10k', 'Random graph of 10,000 units'));
    status = 'Done.';
    running = false;
    return rows;
  }

  $effect(() => {
    (window as unknown as Record<string, unknown>).bench = { run, rows: () => rows };
  });
</script>

<div class="bench">
  <header class="top"><h1>graphview bench</h1></header>
  <div class="bench-body">
    <section>
      <p>
        This page measures graphview on this machine: the time to the first picture, and frame times while zooming from
        1 to 8 and turning a full circle, each over 2 seconds.
      </p>
      <dl class="info">
        <dt>Browser</dt>
        <dd data-testid="browser">{navigator.userAgent}</dd>
        <dt>Graphics</dt>
        <dd data-testid="graphics">{gl}</dd>
        <dt>Processors</dt>
        <dd>{navigator.hardwareConcurrency}</dd>
      </dl>
      <button type="button" class="primary" onclick={run} disabled={running}>Run</button>
      <p role="status" data-testid="bench-status">{status}</p>
      {#if rows.length}
        <table data-testid="bench-results">
          <thead
            ><tr
              ><th>Graph</th><th>First picture</th><th>Zoom frame, median</th><th>Zoom, 95th percentile</th><th
                >Turn frame, median</th
              ><th>Turn, 95th percentile</th></tr
            ></thead
          >
          <tbody>
            {#each rows as r (r.graph)}
              <tr
                ><td>{r.graph}</td><td class="num">{r.firstPictureMs} ms</td><td class="num">{r.zoom.median} ms</td><td
                  class="num">{r.zoom.p95} ms</td
                ><td class="num">{r.rotate.median} ms</td><td class="num">{r.rotate.p95} ms</td></tr
              >
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
    <div class="bench-view">
      {#if doc !== null}
        <GraphView
          bind:this={gv}
          graph={doc}
          look={{ motion: 'off', panels: { details: false, paths: false, issues: false, key: false } }}
          onlayoutsettled={(e) => settled?.(e)}
        />
      {/if}
    </div>
  </div>
</div>
