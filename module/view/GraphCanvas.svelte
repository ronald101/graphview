<!-- The canvas (specification section 6): draws the model in 2D or 3D and turns clicks into commands on the model.
     A click on a unit makes it the root; Shift and a click make it the path's target; a chevron or
     a line opens in the inspector. Clicks never switch between 2D and 3D. The keyboard does the same
     (specification 6.14), and a polite live region says what changed. -->
<script lang="ts">
  import '@fontsource/atkinson-hyperlegible-next/400.css';
  import '@fontsource/atkinson-hyperlegible-next/600.css';
  import '@fontsource/atkinson-hyperlegible-next/700.css';
  import './view.css';
  import { onDestroy, onMount } from 'svelte';
  import { keyId, keypairId, type Key } from '../core/index.ts';
  import type { Inspected } from '../model/contracts.ts';
  import type { GraphModel } from '../model/model.ts';
  import { Gpu, type V3 } from '../render/gpu.ts';
  import { PUBLIC_LOOKS, type Looks } from '../render/looks.ts';
  import { Scene, type SceneSnapshot } from '../render/scene.ts';
  import { watch } from './watch.svelte.ts';
  import { announce, count, oneMessage } from './words.ts';

  interface Props {
    /** The model to draw. The canvas keeps the model it starts with. */
    model: GraphModel;
    theme?: 'light' | 'dark' | 'system';
    motion?: 'on' | 'off' | 'system';
    /** The / key asks the host to open its search, such as the Root field. */
    onfind?: () => void;
    /** How each kind of unit draws, and the shapes it may take (render/looks.ts); kept from the start. */
    looks?: Looks;
  }
  let { model, theme = 'system', motion = 'system', onfind, looks = PUBLIC_LOOKS }: Props = $props();

  // The scene follows the model and looks it was made with; new ones need a new canvas.
  // svelte-ignore state_referenced_locally
  const scene = new Scene(model, looks);
  let stage: HTMLDivElement;
  let host: HTMLDivElement;
  let labels: HTMLCanvasElement;
  let input: HTMLDivElement;
  let gpu: Gpu | null = null;
  let systemDark = $state(false);
  let systemReduced = $state(false);
  let live = $state('');
  // svelte-ignore state_referenced_locally
  const w = watch(() => model, ['mode']);

  $effect(() => {
    model.setTheme(theme === 'dark' || (theme !== 'light' && systemDark) ? 'dark' : 'light');
  });
  $effect(() => {
    scene.reducedMotion = motion === 'off' || (motion !== 'on' && systemReduced);
  });

  const info = $derived.by(() => {
    void w.v;
    const g = model.graph;
    return {
      mode: model.mode,
      refused: model.refused,
      units: g?.units.length ?? 0,
      relations: model.relationCount(),
      // Offering every unit's name stays cheap up to a few thousand units.
      names: g && g.units.length <= 2000 ? g.units.map((k) => model.label(k)) : [],
    };
  });

  onMount(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)');
    systemDark = dark.matches;
    systemReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    gpu = new Gpu(host, input);
    scene.attach(gpu, labels);
    gpu.resize();
    const ro = new ResizeObserver(() => gpu?.resize());
    ro.observe(stage);
    const onDark = () => (systemDark = dark.matches);
    dark.addEventListener('change', onDark);
    // The changes of one action arrive together; the region says them as one message.
    let pending: string[] = [];
    const quiet = model.subscribe((a) => {
      const words = announce(model, a);
      if (!words) return;
      if (!pending.length)
        setTimeout(() => {
          live = oneMessage(pending);
          pending = [];
        });
      pending.push(words);
    });
    return () => {
      quiet();
      ro.disconnect();
      dark.removeEventListener('change', onDark);
    };
  });

  onDestroy(() => {
    clearTimeout(hover);
    scene.detach();
    gpu?.dispose();
  });

  // ---------------------------------------------------------------- pointer and keyboard

  let down: { x: number; y: number } | null = null;
  const local = (e: PointerEvent) => {
    const b = input.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  async function onUp(e: PointerEvent) {
    const p = local(e);
    const d = down;
    down = null;
    if (!d || Math.hypot(p.x - d.x, p.y - d.y) > 4 || e.button !== 0) return;
    await clickAt(p.x, p.y, e.shiftKey);
  }

  // The pointer's shape follows what is under it, checked once the pointer rests.
  let hover = 0;
  function onMove(e: PointerEvent) {
    clearTimeout(hover);
    if (down) return;
    const p = local(e);
    hover = window.setTimeout(() => (input.style.cursor = scene.pick(p.x, p.y) ? 'pointer' : 'grab'), 50);
  }

  const MOVES: Record<string, Parameters<Scene['nudge']>[0]> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    '+': 'in',
    '=': 'in',
    '-': 'out',
    '[': 'turn-left',
    ']': 'turn-right',
  };

  /** The unit the keys act on: the inspected unit, or the far end of the inspected keypair. */
  function current(): { unit: Key | null; keypair: [Key, Key] | null } {
    const i = model.inspected;
    if (i?.kind === 'unit') return { unit: i.key, keypair: null };
    if (i?.kind === 'keypair') return { unit: null, keypair: [i.from, i.to] };
    return { unit: null, keypair: null };
  }
  let stepping: Key | null = null;

  function onKey(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const move = MOVES[e.key];
    if (move) scene.nudge(move);
    else if (e.key === '0') scene.fit();
    else if (e.key === 'Escape') {
      if (model.target !== null) void model.setTarget(null);
      else if (model.root !== null) void model.setRoot(null);
      model.inspect(null);
      stepping = null;
    } else if (e.key === '/' && onfind) onfind();
    else if (e.key === 'Tab') {
      // Tab steps through the keypairs of the unit last inspected; past the last one it leaves the canvas.
      const c = current();
      if (c.unit !== null) stepping = c.unit;
      else if (c.keypair && (stepping === null || !c.keypair.some((k) => keyId(k) === keyId(stepping!))))
        stepping = c.keypair[0];
      if (stepping === null || (c.unit === null && c.keypair === null)) return;
      const list = model.keypairsOf(stepping);
      let next = e.shiftKey ? list.length - 1 : 0;
      if (c.keypair) {
        const id = keypairId(c.keypair[0], c.keypair[1]);
        next = list.findIndex(([a, b]) => keypairId(a, b) === id) + (e.shiftKey ? -1 : 1);
      }
      if (next < 0 || next >= list.length) return;
      model.inspect({ kind: 'keypair', from: list[next][0], to: list[next][1] });
    } else if (e.key === 'Enter' || e.key === 'f' || e.key === 'F') {
      // Enter on a keypair moves to its far unit; on a unit it makes the root, with Shift the path's target.
      const c = current();
      if (c.keypair && e.key === 'Enter') {
        const [a, b] = c.keypair;
        model.inspect({ kind: 'unit', key: stepping !== null && keyId(a) !== keyId(stepping) ? a : b });
      } else if (c.unit !== null && e.shiftKey && model.root !== null) void model.setTarget(c.unit);
      else if (c.unit !== null) void model.setRoot(c.unit);
      else return;
    } else return;
    e.preventDefault();
  }

  // ---------------------------------------------------------------- commands

  /** Does what a click at a canvas point does, and says what it hit. */
  export async function clickAt(x: number, y: number, shift = false): Promise<Inspected> {
    const hit = scene.pick(x, y);
    if (hit?.kind === 'unit') {
      if (shift && model.root !== null && keyId(model.root) !== keyId(hit.key)) await model.setTarget(hit.key);
      else await model.setRoot(hit.key);
    }
    if (hit) model.inspect(hit);
    return hit;
  }
  /** What lies under a canvas point, without acting on it. */
  export function pickAt(x: number, y: number): Inspected {
    return scene.pick(x, y);
  }
  export function fit() {
    scene.fit();
  }
  export function getScene(): SceneSnapshot {
    return scene.snapshotForTests();
  }
  export function whenSettled(): Promise<void> {
    return scene.whenSettled();
  }
  export function getCamera() {
    return scene.getCamera();
  }
  export function setCamera(position: V3, target: V3) {
    scene.setCamera(position, target);
  }
  /** The picture as it is on screen, labels included, as a PNG. */
  export function picture(background: boolean): Promise<Blob | null> {
    const c = scene.capture(background);
    return c ? new Promise((r) => c.toBlob(r, 'image/png')) : Promise.resolve(null);
  }
</script>

<div class="gv-canvas gv-ui" bind:this={stage}>
  <div class="gv-gl" bind:this={host}></div>
  <canvas class="gv-labels" bind:this={labels} aria-hidden="true"></canvas>
  <!-- The canvas takes the role "application"; the linter does not count that role as interactive. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="gv-input"
    bind:this={input}
    tabindex="0"
    role="application"
    aria-label="Graph in {info.mode === '3d' ? '3D' : '2D'}: {count(info.units, 'unit', 'units')}, {count(
      info.relations,
      'relation',
      'relations',
    )}"
    data-testid="canvas"
    onpointerdown={(e) => (down = local(e))}
    onpointerup={onUp}
    onpointermove={onMove}
    onkeydown={onKey}
  ></div>
  {#if info.refused}
    <div class="gv-refused" role="alert" data-testid="refused" data-code={info.refused.code}>
      <p><strong>This file was refused.</strong></p>
      <p>{info.refused.message}</p>
    </div>
  {/if}
  <p class="gv-hint">
    {info.mode === '3d' ? 'Drag to turn, right-drag to pan' : 'Drag to pan'}, wheel to zoom. Click a unit to make it the
    root; Shift-click another for paths.
  </p>
  <p class="gv-live" aria-live="polite" data-testid="live">{live}</p>
  <datalist id="gv-units">
    {#each info.names as n, i (i)}<option value={n}></option>{/each}
  </datalist>
</div>
