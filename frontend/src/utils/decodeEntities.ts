export function decodeEntities(str: string): string {
  const doc = new DOMParser().parseFromString(str, "text/html");
  return doc.documentElement.textContent ?? str;
}
