/** Both sides must support this protocol before a Codex turn can start. */
export const BRIDGE_CAPABILITIES = { pageReader: 1 } as const;

export function supportsPageReader(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const capabilities = (value as { capabilities?: unknown }).capabilities;
  return (
    !!capabilities &&
    typeof capabilities === 'object' &&
    (capabilities as { pageReader?: unknown }).pageReader === BRIDGE_CAPABILITIES.pageReader
  );
}
