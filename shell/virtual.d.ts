// The examples modules that shell/vite.config.ts builds from the fixtures and shell/examples (8.10).
declare module 'virtual:examples' {
  const list: {
    id: string;
    group: 'valid' | 'broken' | 'refused';
    units: number | null;
    name: string | null;
    description: string | null;
  }[];
  export default list;
}
declare module 'virtual:example-docs' {
  const docs: Record<string, unknown>;
  export default docs;
}
