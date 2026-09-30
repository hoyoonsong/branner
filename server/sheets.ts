import { prisma } from "./prisma.js";
import { type ConnectedForm } from "./connected-forms.js";

export type FormField = { label: string; value: string };
export type FormSection = { title: string; fields: FormField[] };

export type FormResponse = {
  matchValue: string;
  submittedAt: string;
  submittedAtRaw: string;
  submitter: string;
  subtitle: string;
  confirmation: string;
  links: { label: string; url: string }[];
  sections: FormSection[];
  values: Record<string, string>;
};

export class SheetsNotConnected extends Error {
  constructor() {
    super("Google Sheets is not connected");
    this.name = "SheetsNotConnected";
  }
}

const cache = new Map<string, { at: number; responses: FormResponse[] }>();
const TTL_MS = 60_000;

export function clearSheetCache(id?: string) {
  if (id) cache.delete(id);
  else cache.clear();
}

export async function loadFormResponses(form: ConnectedForm, fresh = false): Promise<FormResponse[]> {
  if (!fresh) {
    const hit = cache.get(form.id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.responses;
  }
  const table = await fetchTable(form.spreadsheetId, form.gid);
  const responses = rowsToResponses(form, table);
  cache.set(form.id, { at: Date.now(), responses });
  return responses;
}

async function fetchTable(spreadsheetId: string, gid: string): Promise<string[][]> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const pub = await fetch(csvUrl, { redirect: "follow" });
  if (pub.ok) {
    const text = await pub.text();
    if (!text.trim().startsWith("<")) return parseCsv(text);
  }

  const token = await sheetsAccessToken();
  if (!token) throw new SheetsNotConnected();

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (metaRes.status === 401 || metaRes.status === 403) throw new SheetsNotConnected();
  if (!metaRes.ok) {
    throw new Error(`Could not open the spreadsheet (${metaRes.status})`);
  }
  const meta = (await metaRes.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  };
  const sheet = meta.sheets?.find((item) => String(item.properties?.sheetId) === gid);
  const title = sheet?.properties?.title;
  if (!title) throw new Error("That response tab was not found in the spreadsheet");

  const range = encodeURIComponent(`'${title.replace(/'/g, "''")}'`);
  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (valuesRes.status === 401 || valuesRes.status === 403) throw new SheetsNotConnected();
  if (!valuesRes.ok) throw new Error(`Could not read form responses (${valuesRes.status})`);
  const body = (await valuesRes.json()) as { values?: string[][] };
  return (body.values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
}

async function sheetsAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const admin = await prisma.admin.findFirst({
    where: { status: "approved", googleRefreshToken: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { googleRefreshToken: true },
  });
  const refreshToken = admin?.googleRefreshToken;
  if (!refreshToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token || null;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value.trim()));
}

export function rowsToResponses(form: ConnectedForm, table: string[][]): FormResponse[] {
  const [headerRow, ...body] = table;
  if (!headerRow) return [];
  const headers = uniqueHeaders(headerRow);
  const byMatch = new Map<string, FormResponse>();
  for (const line of body) {
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      values[header] = (line[index] ?? "").trim();
    });
    const matchValue = matchKey(values[form.matchHeader] ?? "", form.matchOn);
    if (!matchValue) continue;
    const rawTime = values[form.timestampHeader ?? "Timestamp"] ?? "";
    const response = toResponse(form, headers, values, matchValue);
    const previous = byMatch.get(matchValue);
    if (!previous || sheetTime(rawTime) >= sheetTime(previous.submittedAtRaw)) {
      byMatch.set(matchValue, response);
    }
  }
  return [...byMatch.values()];
}

function uniqueHeaders(row: string[]): string[] {
  const seen = new Map<string, number>();
  return row.map((cell) => {
    const header = cell.trim();
    if (!header) return "";
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count === 0 ? header : `${header} (${count + 1})`;
  });
}

function toResponse(
  form: ConnectedForm,
  headers: string[],
  values: Record<string, string>,
  matchValue: string,
): FormResponse {
  const timestampHeader = form.timestampHeader ?? "Timestamp";
  const submitterHeader = form.submitterHeader ?? "Email Address";
  const groups = new Map<string, FormField[]>();
  const groupOrder: string[] = [];
  const extra: FormField[] = [];
  const links: { label: string; url: string }[] = [];
  let confirmation = "";
  const summary: string[] = [];

  const ensure = (title: string) => {
    if (!groups.has(title)) {
      groups.set(title, []);
      groupOrder.push(title);
    }
    return groups.get(title)!;
  };

  for (const header of headers) {
    if (!header) continue;
    const value = values[header] ?? "";
    if (!value) continue;
    if (
      header === form.matchHeader ||
      header === timestampHeader ||
      header === submitterHeader
    ) {
      continue;
    }
    if (form.summaryHeaders?.some((name) => name.toLowerCase() === header.toLowerCase())) {
      summary.push(value);
      continue;
    }
    if (form.confirmationPattern?.test(header)) {
      confirmation = value;
      continue;
    }
    if (form.selfiePattern?.test(header)) {
      const url = firstUrl(value);
      if (url) links.push({ label: "Roommate selfie", url });
      continue;
    }
    const url = firstUrl(value);
    if (url && value.trim() === url) {
      links.push({ label: header, url });
      continue;
    }
    const group = form.groups?.find((item) => item.pattern.test(header));
    if (group) ensure(group.title).push({ label: header, value });
    else extra.push({ label: header, value });
  }

  if (!form.groups?.length && extra.length) {
    ensure("Responses").push(...extra);
    extra.length = 0;
  }
  const sections: FormSection[] = groupOrder.map((title) => ({
    title,
    fields: groups.get(title) ?? [],
  }));
  if (extra.length) sections.push({ title: form.groups?.length ? "More" : "Responses", fields: extra });

  return {
    matchValue,
    submittedAt: formatSheetDate(values[timestampHeader] ?? ""),
    submittedAtRaw: values[timestampHeader] ?? "",
    submitter: values[submitterHeader] ?? "",
    subtitle: summary.join(" · "),
    confirmation,
    links,
    sections: sections.filter((section) => section.fields.length > 0),
    values,
  };
}

function matchKey(value: string, matchOn: "room" | "email"): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (matchOn === "email") return trimmed.toLowerCase();
  return trimmed.match(/\d+/)?.[0] ?? trimmed;
}

function sheetTime(value: string): number {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return Date.parse(value) || 0;
  return new Date(
    Number(match[3]),
    Number(match[1]) - 1,
    Number(match[2]),
    Number(match[4] ?? 0),
    Number(match[5] ?? 0),
    Number(match[6] ?? 0),
  ).getTime();
}

function formatSheetDate(value: string): string {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return value.trim();
  const date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function firstUrl(value: string): string | null {
  const match = value.match(/https?:\/\/\S+/);
  if (!match) return null;
  return match[0].replace(/[),.;]+$/, "");
}
