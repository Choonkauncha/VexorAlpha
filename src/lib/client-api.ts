/** Parse API responses without ever storing an error envelope as application data. */
export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const raw = await response.text();
  let data: unknown;
  try { data = raw ? JSON.parse(raw) : null; } catch {
    throw new Error(`The server returned an invalid response (${response.status}). Please try again.`);
  }
  if (!response.ok) {
    const error = data && typeof data === 'object' && 'error' in data ? data.error : null;
    throw new Error(typeof error === 'string' ? error : `Request failed (${response.status}).`);
  }
  if (data === null) throw new Error('The server returned an empty response. Please try again.');
  return data as T;
}
