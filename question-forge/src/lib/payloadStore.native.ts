import { Directory, File, Paths } from 'expo-file-system';
import type { SourcePayload } from './types';

/** Large file payloads live on disk, one JSON file per source. */
function dir(): Directory {
  const d = new Directory(Paths.document, 'sources');
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

export async function putPayload(id: string, payload: SourcePayload): Promise<void> {
  const f = new File(dir(), `${id}.json`);
  if (!f.exists) f.create();
  await f.write(JSON.stringify(payload));
}

export async function getPayload(id: string): Promise<SourcePayload | null> {
  const f = new File(dir(), `${id}.json`);
  if (!f.exists) return null;
  return JSON.parse(await f.text()) as SourcePayload;
}

export async function deletePayload(id: string): Promise<void> {
  const f = new File(dir(), `${id}.json`);
  if (f.exists) f.delete();
}
