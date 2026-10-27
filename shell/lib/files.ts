// Opening and saving files. Where the browser offers the File System Access API, a file opened
// can be saved back: Save asks before it overwrites, as editors do. Elsewhere, opening goes through
// a file input and saving downloads the file.

interface WritableFile {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

/** The part of a FileSystemFileHandle the shell uses. */
export interface FileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFile>;
}

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface Pickers {
  showOpenFilePicker?: (o: { types: PickerType[]; multiple?: boolean }) => Promise<FileHandle[]>;
  showSaveFilePicker?: (o: { suggestedName: string; types: PickerType[] }) => Promise<FileHandle>;
}

const pickers = () => window as unknown as Pickers;
const JSON_TYPE: PickerType = { description: 'Graph', accept: { 'application/json': ['.json'] } };
const PNG_TYPE: PickerType = { description: 'Picture', accept: { 'image/png': ['.png'] } };

/** Whether files can be picked with a handle that later allows saving back. */
export const canPick = () => typeof pickers().showOpenFilePicker === 'function';

/** Lets the person pick a graph file. Null when they cancel, or when the browser cannot pick. */
export async function pickFile(): Promise<{ handle: FileHandle; file: File } | null> {
  const open = pickers().showOpenFilePicker;
  if (!open) return null;
  try {
    const [handle] = await open({ types: [JSON_TYPE] });
    return { handle, file: await handle.getFile() };
  } catch {
    return null;
  }
}

async function write(handle: FileHandle, data: Blob | string) {
  const w = await handle.createWritable();
  await w.write(data);
  await w.close();
}

function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export type Saved = { how: 'overwritten' | 'saved' | 'downloaded'; name: string; handle: FileHandle | null } | null;

/**
 * Saves a file. With the handle of an open file, it asks first and then overwrites that file; if
 * the person declines, or there is no handle, the browser's own dialog picks the file, and warns
 * before it replaces one. Without that dialog, the file downloads.
 */
export async function saveFile(
  name: string,
  blob: Blob,
  kind: 'graph' | 'picture',
  handle: FileHandle | null,
  confirmOverwrite: (name: string) => boolean,
): Promise<Saved> {
  if (handle && confirmOverwrite(handle.name)) {
    await write(handle, blob);
    return { how: 'overwritten', name: handle.name, handle };
  }
  const save = pickers().showSaveFilePicker;
  if (save) {
    try {
      const h = await save({ suggestedName: name, types: [kind === 'graph' ? JSON_TYPE : PNG_TYPE] });
      await write(h, blob);
      return { how: 'saved', name: h.name, handle: h };
    } catch {
      return null;
    }
  }
  download(name, blob);
  return { how: 'downloaded', name, handle: null };
}
