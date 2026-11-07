/** Web has no secure enclave; keep the key in this browser's storage only. */
const KEY = 'margins.anthropic_api_key';

export async function getApiKey(): Promise<string | null> {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export async function setApiKey(v: string): Promise<void> {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
}
export async function clearApiKey(): Promise<void> {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
