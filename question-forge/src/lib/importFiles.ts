import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { uid } from './bytes';
import { extractFile } from './extract';
import type { SourceMeta, SourcePayload } from './types';

export interface ImportResult {
  added: { meta: SourceMeta; payload: SourcePayload }[];
  failed: { name: string; reason: string }[];
}

async function readBytes(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web' && asset.file) {
    return new Uint8Array(await asset.file.arrayBuffer());
  }
  return new File(asset.uri).bytes();
}

/** Opens the system file picker (any type, multiple) and extracts each file. */
export async function pickAndExtract(): Promise<ImportResult | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;

  const out: ImportResult = { added: [], failed: [] };
  for (const asset of res.assets) {
    try {
      const bytes = await readBytes(asset);
      const ex = await extractFile(asset.name, asset.mimeType, bytes);
      const usable = ex.payload.base64 || (ex.payload.text && ex.words >= 15);
      if (!usable) {
        out.failed.push({ name: asset.name, reason: 'No readable content found in this file.' });
        continue;
      }
      out.added.push({
        meta: {
          id: uid(),
          name: asset.name,
          mimeType: ex.mimeType,
          size: asset.size ?? bytes.length,
          kind: ex.kind,
          detail: ex.detail,
          words: ex.words,
          importedAt: Date.now(),
        },
        payload: ex.payload,
      });
    } catch (e) {
      out.failed.push({ name: asset.name, reason: e instanceof Error ? e.message : 'Could not read this file.' });
    }
  }
  return out;
}
