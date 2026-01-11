export function normalizeUrlInput(rawValue: string): string {
  const value = (rawValue || '').trim();
  if (!value) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `https://${value}`;
}
