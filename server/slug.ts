export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function uniqueSlug(base: string, extra: string): string {
  const a = slugify(base) || "event";
  const b = slugify(extra).slice(0, 8) || Math.random().toString(36).slice(2, 8);
  return `${a}-${b}`;
}
