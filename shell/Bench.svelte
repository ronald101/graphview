<!-- The bench page (specification 8.14): speed on the machine in front of it. Open with #bench. -->
<script lang="ts">
  import { GraphCanvas, GraphModel } from '../module/index.ts';
  import { SAMPLE_ID } from './lib/sample.ts';
  import { exampleDoc } from './lib/examples.ts';
  import { wearTokens } from './lib/theme.ts';

  const scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  interface Stats {
    median: number;
    p95: number;
    frames: number;
  }
  interface Row {
    graph: string;
    firstPictureMs: number;
    zoom: Stats;
    turn: Stats;
  }

  const model = new GraphModel();
  wearTokens(scheme, model.colours(scheme));
  let canvas: ReturnType<typeof GraphCanvas> | undefined = $state();
  let rows: Row[] = $state([]);
  let status = $state('Press Run to measure.');
  let running = $state(false);

  const gl = (() => {
    const c = document.createElement('canvas').getContext('webgl2');
    if (!c) return 'WebGL 2 is not available.';
    const ext = c.getExtension('WEBGL_debug_renderer_info');
    return `${c.getParameter(c.VERSION)}; ${ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)}`;
  })();

  const stats = (xs: number[]): Stats => {
    const s = [...xs].sort((a, b) => a - b);
    const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN);
    return { median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), frames: s.length };
  };
  const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

  /** Calls step with t from 0 to 1 over 2 seconds, one call per frame, and returns the frame times. */
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
    const doc = await exampleDoc(id);
    model.setMode('2d');
    const t0 = performance.now();
    await model.load(doc);
    await canvas!.whenSettled();
    await frame();
    await frame();
    const firstPictureMs = performance.now() - t0;
    const c = canvas!;
    c.fit();
    const start = c.getCamera()!;
    const d = start.position[2];
    status = `Zooming ${name}`;
    const zoom = stats(await animate((t) => c.setCamera([0, 0, d / Math.pow(8, t)], [0, 0, 0])));
    status = `Turning ${name}`;
    model.setMode('3d');
    await c.whenSettled();
    const turn = stats(
      await animate((t) => {
        const a = 2 * Math.PI * t;
        c.setCamera([d * 0.5 * Math.sin(a), -d * 0.5 * Math.cos(a), d * 0.87], [0, 0, 0]);
      }),
    );
    return { graph: name, firstPictureMs: +firstPictureMs.toFixed(0), zoom, turn };
  }

  export async function run(): Promise<Row[]> {
    running = true;
    rows = [];
    rows.push(await measure(SAMPLE_ID, 'Sample graph'));
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
        1 to 8 and while turning a full circle in 3D, each over 2 seconds.
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
          <thead>
            <tr>
              <th>Graph</th><th>First picture</th><th>Zoom frame, median</th><th>Zoom, 95th percentile</th>
              <th>Turn frame, median</th><th>Turn, 95th percentile</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as r (r.graph)}
              <tr>
                <td>{r.graph}</td><td>{r.firstPictureMs} ms</td><td>{r.zoom.median} ms</td><td>{r.zoom.p95} ms</td>
                <td>{r.turn.median} ms</td><td>{r.turn.p95} ms</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
    <div class="bench-view"><GraphCanvas bind:this={canvas} {model} motion="off" /></div>
  </div>
</div>
