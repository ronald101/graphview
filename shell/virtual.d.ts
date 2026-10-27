// The examples module that shell/vite.config.ts builds from the fixtures.
declare module 'virtual:examples' {
  const data: {
    list: { id: string; group: 'valid' | 'broken' | 'refused'; units: number | null; onDemand: boolean }[];
    docs: Record<string, unknown>;
  };
  export default data;
}
