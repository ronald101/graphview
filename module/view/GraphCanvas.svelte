<!-- The canvas (specification section 6): draws the model in 2D or 3D and turns clicks into commands on the model.
     A click on a unit makes it the root; Shift and a click make it the path's target; a chevron or
     a line opens in the inspector. Clicks never switch between 2D and 3D. The keyboard does the same
     (specification 6.14), and a live region says what changed. The settings say which button and keys
     do what, and in which words. -->
<script lang="ts">
  import '@fontsource/atkinson-hyperlegible-next/400.css';
  import '@fontsource/atkinson-hyperlegible-next/600.css';
  import '@fontsource/atkinson-hyperlegible-next/700.css';
  import './view.css';
  import { onDestroy, onMount } from 'svelte';
  import { keyId, keypairId, type Key } from '../core/index.ts';
  import type { Inspected } from '../model/contracts.ts';
  import type { GraphModel } from '../model/model.ts';
  import { Gpu, type GpuOptions, type V3 } from '../render/gpu.ts';
  import { PUBLIC_LOOKS, type Looks } from '../render/looks.ts';
  import { Scene, type SceneSnapshot } from '../render/scene.ts';
  import type { KeyAction } from '../settings/groups/input.ts';
  import type { SettingKey } from '../settings/registry.ts';
  import { viewCss } from './css.ts';
  import { watch } from './watch.svelte.ts';
  import { announce, count, fill, oneMessage, type Message } from './words.ts';

  interface Props {
    /** The model to draw. The canvas keeps the model it starts with. */
    model: GraphModel;
    /** Base values of the settings "Colours" and "Motion"; without them the settings decide. */
    theme?: 'light' | 'dark' | 'system';
    motion?: 'on' | 'off' | 'system';
    /** The / key asks the host to open its search, such as the Root field. */
    onfind?: () => void;
    /** How each kind of unit draws, and the shapes it may take (render/looks.ts); kept from the start. */
    looks?: Looks;
  }
  let { model, theme, motion, onfind, looks = PUBLIC_LOOKS }: Props = $props();

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
  const w = watch(() => model, ['mode', 'theme']);
  const set = <K extends SettingKey>(key: K) => model.settings.get(key);

  $effect(() => {
    if (theme !== undefined) model.setBaseSettings({ 'theme.scheme': theme });
  });
  $effect(() => {
    if (motion !== undefined) model.setBaseSettings({ 'motion.enabled': motion });
  });
  $effect(() => {
    const scheme = model.settings.get('theme.scheme');
    model.setTheme(scheme === 'dark' || (scheme !== 'light' && systemDark) ? 'dark' : 'light');
  });
  $effect(() => {
    const m = model.settings.get('motion.enabled');
    scene.reducedMotion = m === 'off' || (m !== 'on' && systemReduced);
  });

  const info = $derived.by(() => {
    void w.v;
    const g = model.graph;
    const locale = set('words.locale');
    const mode = model.mode;
    return {
      mode,
      refused: model.refused,
      refusal: model.refused
        ? fill(set('words.refusals')[model.refused.code] ?? model.refused.message, {
            reason: model.refused.reason ?? '',
          })
        : '',
      name: fill(set('words.canvasName'), {
        mode: mode === '3d' ? '3D' : '2D',
        units: count(g?.units.length ?? 0, 'unit', 'units', locale),
        relations: count(model.relationCount(), 'relation', 'relations', locale),
      }),
      hint: set('accessibility.hint') ? `${set('words.hint')[mode]} ${set('words.hint').more}`.trim() : '',
      role: set('accessibility.canvasRole'),
      politeness: set('accessibility.liveRegion'),
      css: viewCss(model),
      // Offering every unit's name stays cheap up to a few thousand units.
      names: g && g.units.length <= set('accessibility.unitNamesUpTo') ? g.units.map((k) => model.label(k)) : [],
    };
  });

  /** The renderer's settings, which a new renderer takes. */
  function options(): GpuOptions {
    return {
      antialias: set('renderer.antialias'),
      alpha: set('renderer.alpha'),
      preserveDrawingBuffer: set('renderer.preserveDrawingBuffer'),
      pixelRatio: set('renderer.pixelRatio'),
      fov: set('camera.fov'),
      near: set('camera.near'),
      far: set('camera.far'),
      start: set('camera.start'),
    };
  }
  const REBUILD = ['renderer.antialias', 'renderer.alpha', 'renderer.preserveDrawingBuffer', 'renderer.pixelRatio'];

  /** A renderer with the settings' options; the camera stays where it was. */
  function build() {
    const camera = gpu ? scene.getCamera() : null;
    if (gpu) {
      scene.release();
      gpu.dispose();
    }
    gpu = new Gpu(host, input, options());
    scene.attach(gpu, labels);
    gpu.resize();
    if (camera) scene.setCamera(camera.position, camera.target);
  }

  onMount(() => {
    const dark = matchMedia('(prefers-color-scheme: dark)');
    systemDark = dark.matches;
    systemReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    build();
    const ro = new ResizeObserver(() => gpu?.resize());
    ro.observe(stage);
    const onDark = () => (systemDark = dark.matches);
    dark.addEventListener('change', onDark);
    // The changes of one action arrive together; the region says them as one message.
    let pending: Message[] = [];
    const quiet = model.subscribe((a) => {
      if (a.has('settings') && model.changedSettings.some((k) => REBUILD.includes(k))) build();
      if (set('accessibility.liveRegion') === 'off') return;
      const words = announce(model, a);
      if (!words) return;
      if (!pending.length)
        setTimeout(() => {
          live = set('accessibility.onePerAction') ? oneMessage(pending) : pending.map((p) => p.text).join('. ');
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

  const BUTTON = { left: 0, middle: 1, right: 2 } as const;
  let down: { x: number; y: number } | null = null;
  const local = (e: PointerEvent) => {
    const b = input.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  async function onUp(e: PointerEvent) {
    const p = local(e);
    const d = down;
    down = null;
    if (!d || Math.hypot(p.x - d.x, p.y - d.y) > set('pointer.dragThreshold')) return;
    if (e.button !== BUTTON[set('pointer.button')]) return;
    await clickAt(p.x, p.y, e.shiftKey);
  }

  // The pointer's shape follows what is under it, checked once the pointer rests.
  let hover = 0;
  function onMove(e: PointerEvent) {
    clearTimeout(hover);
    if (down) return;
    const p = local(e);
    hover = window.setTimeout(
      () => (input.style.cursor = scene.pick(p.x, p.y) ? set('pointer.cursor.target') : set('pointer.cursor.idle')),
      set('pointer.hoverDelay'),
    );
  }

  const MOVES: Partial<Record<KeyAction, Parameters<Scene['nudge']>[0]>> = {
    'pan-left': 'left',
    'pan-right': 'right',
    'pan-up': 'up',
    'pan-down': 'down',
    'zoom-in': 'in',
    'zoom-out': 'out',
    'turn-left': 'turn-left',
    'turn-right': 'turn-right',
  };
  const MODIFIERS = { Alt: 'altKey', Control: 'ctrlKey', Meta: 'metaKey' } as const;

  /** The unit the keys act on: the inspected unit, or the far end of the inspected keypair. */
  function current(): { unit: Key | null; keypair: [Key, Key] | null } {
    const i = model.inspected;
    if (i?.kind === 'unit') return { unit: i.key, keypair: null };
    if (i?.kind === 'keypair') return { unit: null, keypair: [i.from, i.to] };
    return { unit: null, keypair: null };
  }
  let stepping: Key | null = null;

  function onKey(e: KeyboardEvent) {
    if (set('keyboard.ignoreWith').some((m) => e[MODIFIERS[m]])) return;
    const action = set('keyboard.bindings')[e.key];
    if (!action) return;
    const move = MOVES[action];
    if (move) scene.nudge(move);
    else if (action === 'fit') scene.fit();
    else if (action === 'clear') {
      if (model.target !== null) void model.setTarget(null);
      else if (model.root !== null) void model.setRoot(null);
      model.inspect(null);
      stepping = null;
    } else if (action === 'find') {
      if (!onfind) return;
      onfind();
    } else if (action === 'step') {
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
    } else if (action === 'act' || action === 'root') {
      // On a keypair, "act" moves to its far unit; on a unit both make it the root, with Shift the path's target.
      const c = current();
      if (c.keypair && action === 'act') {
        const [a, b] = c.keypair;
        model.inspect({ kind: 'unit', key: stepping !== null && keyId(a) !== keyId(stepping) ? a : b });
      } else if (c.unit !== null && e.shiftKey && model.root !== null) void model.setTarget(c.unit);
      else if (c.unit !== null) void model.setRoot(c.unit);
      else return;
    } else return;
    e.preventDefault();
  }

  // ---------------------------------------------------------------- commands

  /** Does what a click at a canvas point does, as the pointer's settings say, and says what it hit. */
  export async function clickAt(x: number, y: number, shift = false): Promise<Inspected> {
    const hit = scene.pick(x, y);
    if (hit?.kind === 'unit') {
      const does = shift ? set('pointer.shiftClick') : set('pointer.click');
      const differs = model.root !== null && keyId(model.root) !== keyId(hit.key);
      if (does === 'target' && differs) await model.setTarget(hit.key);
      else if (does === 'root' || (does === 'target' && model.root === null) || (does === 'target' && !differs))
        await model.setRoot(hit.key);
    }
    if (hit && set('pointer.inspectOnClick')) model.inspect(hit);
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
  /** The picture as it is on screen, as the settings of the group "Picture" say; the background as asked. */
  export function picture(background: boolean = set('picture.background')): Promise<Blob | null> {
    const c = scene.capture(background, set('picture.scale'), set('picture.labels'));
    return c ? new Promise((r) => c.toBlob(r, set('picture.format'))) : Promise.resolve(null);
  }
</script>

<div class="gv-canvas gv-ui" style={info.css} bind:this={stage}>
  <div class="gv-gl" bind:this={host}></div>
  <canvas class="gv-labels" bind:this={labels} aria-hidden="true"></canvas>
  <!-- The canvas takes the role "application"; the linter does not count that role as interactive. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="gv-input"
    bind:this={input}
    tabindex="0"
    role={info.role}
    aria-label={info.name}
    data-testid="canvas"
    onpointerdown={(e) => (down = local(e))}
    onpointerup={onUp}
    onpointermove={onMove}
    onkeydown={onKey}
  ></div>
  {#if info.refused}
    <div class="gv-refused" role="alert" data-testid="refused" data-code={info.refused.code}>
      <p><strong>This file was refused.</strong></p>
      <p>{info.refusal}</p>
    </div>
  {/if}
  {#if info.hint}<p class="gv-hint">{info.hint}</p>{/if}
  <p class="gv-live" aria-live={info.politeness} data-testid="live">{live}</p>
  <datalist id="gv-units">
    {#each info.names as n, i (i)}<option value={n}></option>{/each}
  </datalist>
</div>
