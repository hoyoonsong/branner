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

export function lastNameOf(s: string): string {
  const tokens = nameTokens(s);
  return tokens[tokens.length - 1] ?? "";
}

const NICKNAMES: Record<string, string[]> = {
  bill: ["william", "will", "billy"],
  billy: ["william", "will", "bill"],
  william: ["bill", "will", "billy"],
  joe: ["joseph", "joey"],
  joseph: ["joe", "joey"],
  ben: ["benjamin", "benny"],
  benjamin: ["ben", "benny"],
  evie: ["evelyn"],
  evelyn: ["evie"],
  nic: ["nicholas", "nick", "nico"],
  nick: ["nicholas", "nic", "nico"],
  nicholas: ["nic", "nick", "nico"],
  jamie: ["james", "jim", "jimmy"],
  james: ["jamie", "jim", "jimmy"],
  stef: ["stefania", "stefanie", "stephanie"],
  stefania: ["stef", "steffie"],
  jack: ["john", "johnny"],
  john: ["jack", "johnny"],
  sophie: ["sophia"],
  sophia: ["sophie"],
  vasilis: ["vasileios"],
  vasileios: ["vasilis"],
  mike: ["michael"],
  michael: ["mike"],
  liz: ["elizabeth"],
  beth: ["elizabeth"],
  elizabeth: ["liz", "beth"],
  alex: ["alexander", "alexandra"],
  alexander: ["alex"],
  alexandra: ["alex"],
};

export function givenNamesCompatible(a: string, b: string): boolean {
  const left = nameTokens(a)[0];
  const right = nameTokens(b)[0];
  if (!left || !right) return false;
  if (left === right) return true;
  if ((NICKNAMES[left] ?? []).includes(right)) return true;
  if ((NICKNAMES[right] ?? []).includes(left)) return true;
  if (left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left))) {
    return true;
  }
  return false;
}

export function scoreName(query: string, candidate: string): number {
  const a = nameTokens(query);
  const b = nameTokens(candidate);
  if (!a.length || !b.length) return 0;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  if (lastA !== lastB && !b.includes(lastA) && !a.includes(lastB)) return 0;
  if (!givenNamesCompatible(a[0], b[0]) && !b.includes(a[0]) && !a.includes(b[0])) return 0;
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
  email?: string | null;
};

export function personNameKeys(person: {
  firstName?: string | null;
  lastName?: string | null;
  legalName?: string | null;
  guestName?: string | null;
}): string[] {
  const keys = new Set<string>();
  const preferred = normName(`${person.firstName ?? ""} ${person.lastName ?? ""}`);
  if (preferred) keys.add(preferred);
  if (person.legalName) keys.add(normName(person.legalName));
  if (person.guestName) keys.add(normName(person.guestName));
  return [...keys];
}

export function namesOverlap(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const set = new Set(a);
  return b.some((n) => set.has(n));
}

function firstMatchesPerson(first: string, row: NameResident): boolean {
  if (givenNamesCompatible(first, row.firstName)) return true;
  if (!row.legalName) return false;
  const legal = nameTokens(row.legalName);
  return legal.slice(0, -1).some((token) => givenNamesCompatible(first, token) || token === nameTokens(first)[0]);
}

export function matchResidentByName<T extends NameResident>(
  firstName: string,
  lastName: string,
  residents: T[],
): T | null {
  const first = nameTokens(firstName)[0];
  const last = lastNameOf(lastName) || lastNameOf(`${firstName} ${lastName}`);
  if (!first || !last) return null;
  const hits = residents.filter((row) => {
    const lastOk =
      lastNameOf(row.lastName) === last || (row.legalName ? lastNameOf(row.legalName) === last : false);
    return lastOk && firstMatchesPerson(first, row);
  });
  return hits.length === 1 ? hits[0] : null;
}

export type PhotoPerson = {
  firstName: string;
  lastName: string;
  email?: string | null;
  legalName?: string | null;
};

function emailAgrees(email: string | null | undefined, fileGiven: string[]): boolean {
  if (!email) return false;
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (!local) return false;
  for (const token of fileGiven) {
    if (token.length >= 3 && (local.startsWith(token) || local.includes(token))) return true;
    if (token.length >= 5 && local.includes(token.slice(0, 4))) return true;
    if (token.length >= 6 && local.startsWith(token.slice(0, 2))) return true;
  }
  const initials = fileGiven.map((token) => token[0]).join("");
  if (initials.length >= 2 && (local.startsWith(initials) || local.includes(initials))) return true;
  return false;
}

export function scorePhotoMatch(fileLabel: string, person: PhotoPerson): number {
  const fileTokens = nameTokens(fileLabel.replace(/\.jpe?g$/i, ""));
  if (fileTokens.length < 2) return 0;
  const fileLast = fileTokens[fileTokens.length - 1];
  const fileGiven = fileTokens.slice(0, -1);
  const personLast = lastNameOf(person.lastName);
  if (!personLast || (fileLast !== personLast && !fileTokens.includes(personLast))) return 0;

  const first = nameTokens(person.firstName)[0];
  if (!first) return 0;
  const firstInFile = fileGiven.some((token) => token === first || givenNamesCompatible(first, token));
  const emailHit = emailAgrees(person.email, fileGiven);
  if (!firstInFile && !emailHit) return 0;

  let score = 10;
  if (fileGiven.includes(first)) score += 20;
  else if (firstInFile) score += 12;
  if (emailHit) score += 8;
  const preferred = nameTokens(`${person.firstName} ${person.lastName}`);
  if (preferred.every((token) => fileTokens.includes(token))) score += 15;
  return score;
}

export function assignPhotos<T extends PhotoPerson>(
  files: { id: string; label: string }[],
  people: T[],
): Map<string, T> {
  const pairs: { fileId: string; person: T; key: string; score: number }[] = [];
  for (const file of files) {
    for (const person of people) {
      const score = scorePhotoMatch(file.label, person);
      if (score <= 0) continue;
      pairs.push({
        fileId: file.id,
        person,
        key: (person.email || `${person.firstName}|${person.lastName}`).toLowerCase(),
        score,
      });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const usedFiles = new Set<string>();
  const usedPeople = new Set<string>();
  const assigned = new Map<string, T>();
  for (const pair of pairs) {
    if (usedFiles.has(pair.fileId) || usedPeople.has(pair.key)) continue;
    usedFiles.add(pair.fileId);
    usedPeople.add(pair.key);
    assigned.set(pair.fileId, pair.person);
  }
  return assigned;
}
