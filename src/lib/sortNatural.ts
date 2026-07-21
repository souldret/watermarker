export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortByNameNatural<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((x, y) => naturalCompare(x.name, y.name));
}
