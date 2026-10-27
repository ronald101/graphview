// The examples are the fixtures as they are. The shell starts with the database fixture, which it
// calls the sample graph. This file imports nothing, so that the build configuration can use it.

/** The fixture the sample graph is, and the id the shell gives it. */
export const SAMPLE_SOURCE = 'database-2026-07-24';
export const SAMPLE_ID = 'sample';

/** The id the shell gives a fixture. */
export const exampleId = (fixture: string): string => (fixture === SAMPLE_SOURCE ? SAMPLE_ID : fixture);
