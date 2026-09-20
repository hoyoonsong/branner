export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function nameTokens(s: string): string[] {
  return normName(s).split(" ").filter(Boolean);
}

export function scoreName(query: string, candidate: string): number {
  const a = nameTokens(query);
  const b = nameTokens(candidate);
  if (!a.length || !b.length) return 0;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  if (lastA !== lastB && !b.includes(lastA) && !a.includes(lastB)) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const t of a) if (setB.has(t)) hits++;
  const lastBonus = lastA === lastB ? 3 : b.includes(lastA) ? 1.5 : 0;
  const firstBonus = a[0] && b[0] && (a[0] === b[0] || b.includes(a[0])) ? 2 : 0;
  return hits + lastBonus + firstBonus;
}

export type NameResident = {
  id: string;
  firstName: string;
  lastName: string;
  legalName: string | null;
};

export function matchResidentByName<T extends NameResident>(
  firstName: string,
  lastName: string,
  residents: T[],
  minScore = 5,
): T | null {
  const query = `${firstName} ${lastName}`.trim();
  if (!query) return null;
  let best: { row: T; score: number } | null = null;
  for (const row of residents) {
    const preferred = scoreName(query, `${row.firstName} ${row.lastName}`);
    const legal = row.legalName ? scoreName(query, row.legalName) : 0;
    const score = Math.max(preferred, legal);
    if (!best || score > best.score) best = { row, score };
  }
  if (!best || best.score < minScore) return null;
  const ties = residents.filter((row) => {
    const preferred = scoreName(query, `${row.firstName} ${row.lastName}`);
    const legal = row.legalName ? scoreName(query, row.legalName) : 0;
    return Math.max(preferred, legal) === best!.score;
  });
  return ties.length === 1 ? ties[0] : best.row;
}
