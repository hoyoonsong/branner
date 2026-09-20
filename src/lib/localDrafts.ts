export type LocalDraftEnvelope<T> = {
  updatedAt: number;
  data: T;
};

export function emailDraftKey(id: string | 'new'): string {
  return `email-draft:${id}`;
}

export function formDraftKey(id: string | 'new'): string {
  return `form-draft:${id}`;
}

export function readDraft<T>(key: string): LocalDraftEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraftEnvelope<T>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.updatedAt !== 'number' ||
      parsed.data === undefined
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, data: T): void {
  try {
    const envelope: LocalDraftEnvelope<T> = {
      updatedAt: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function hasDraft(key: string): boolean {
  return readDraft(key) !== null;
}
