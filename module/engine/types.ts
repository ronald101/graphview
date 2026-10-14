// The one adapter between the module and the drawing engine (specification H5).
// The module owns positions, camera, hit-testing and the scene; the engine draws units and lines.

export interface EngineUnit {
  id: string;
  x: number;
  y: number;
  color: string;
  hidden: boolean;
}

export interface EngineSegment {
  id: string;
  from: string;
  to: string;
  /** 'half' runs from `from` to the middle of the relation; 'line' joins both units; 'arc' is a curved arrow. */
  shape: 'half' | 'line' | 'arc';
  /** Identity of the relation, shared by its two halves, for the middle point. */
  relation: string;
  color: string;
  width: number;
  hidden: boolean;
}

export interface EngineCamera {
  /** Graph coordinates of the view's centre, y pointing down. */
  x: number;
  y: number;
  /** 1 shows the whole graph; larger values zoom in. */
  zoom: number;
  /** Degrees, clockwise. */
  angle: number;
}

export interface Engine {
  /** Replaces everything drawn. */
  setItems(units: EngineUnit[], segments: EngineSegment[]): void;
  /** Moves units; middle points follow. */
  setPositions(positions: Map<string, { x: number; y: number }>): void;
  /** Changes colours, widths and visibility without moving anything. */
  setStyles(
    units: Map<string, Pick<EngineUnit, 'color' | 'hidden'>>,
    segments: Map<string, Pick<EngineSegment, 'color' | 'width' | 'hidden'>>,
  ): void;
  /** Sets the extent that zoom 1 shows, in graph coordinates. */
  setExtent(extent: { minX: number; minY: number; maxX: number; maxY: number }): void;
  setCamera(camera: EngineCamera): void;
  /** Graph coordinates to CSS pixels in the canvas. */
  project(x: number, y: number): { x: number; y: number };
  /** CSS pixels to graph coordinates. */
  unproject(x: number, y: number): { x: number; y: number };
  /** Screen pixels per graph unit at the current camera. */
  scale(): number;
  resize(): void;
  /** Draws now, synchronously. */
  render(): void;
  /** Called after each drawn frame. */
  onRender(callback: () => void): void;
  /** The engine's canvases, for exporting a picture. */
  canvases(): HTMLCanvasElement[];
  destroy(): void;
}
