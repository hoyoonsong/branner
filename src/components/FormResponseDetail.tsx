import type { FormResponse } from "../lib/connectedForm";
import { fullName } from "../lib/utils";

export function FormResponseDetail({
  response,
  residents = [],
}: {
  response: FormResponse;
  residents?: { email: string; firstName: string; lastName: string }[];
}) {
  const submitter = residents.find(
    (resident) => resident.email.toLowerCase() === response.submitter.toLowerCase(),
  );
  const who = submitter ? fullName(submitter) : response.submitter;

  return (
    <div className="overflow-hidden rounded-xl bg-stone-sand">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          {response.subtitle && <p className="font-display text-lg leading-tight">{response.subtitle}</p>}
          <p className="mt-0.5 text-sm text-stone-mute">
            {response.submittedAt ? `Submitted ${response.submittedAt}` : "Submitted"}
            {who ? ` by ${who}` : ""}
          </p>
        </div>
        {response.confirmation && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            {response.confirmation}
          </span>
        )}
      </div>
      <div className="space-y-2 px-2 pb-2">
        {response.sections.map((section) => (
          <section key={section.title} className="overflow-hidden rounded-lg bg-white shadow-sm">
            <h3 className="flex items-center gap-2.5 border-b border-black/5 px-4 py-2.5 font-display text-lg leading-none">
              <span className="h-4 w-1 rounded-full bg-cardinal" aria-hidden />
              {section.title}
            </h3>
            <dl>
              {section.fields.map((field) => (
                <div
                  key={field.label}
                  className="grid gap-1 border-t border-black/[0.04] px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6"
                >
                  <dt className="text-sm font-medium leading-6 text-stone-mute">{field.label}</dt>
                  <dd className="min-w-0 text-[15px] leading-6 text-stone-ink">
                    <Answer value={field.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {response.links.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3.5">
          {response.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-cardinal shadow-sm hover:bg-white/70"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function SheetsConnection({
  title,
  description,
  plain = false,
}: {
  title: string;
  description?: string;
  plain?: boolean;
}) {
  const body = (
    <>
      {!plain && <h2 className="font-display text-xl">Connect {title}</h2>}
      <p className={plain ? "text-sm text-stone-mute" : "mt-2 text-sm text-stone-mute"}>
        {description ? `${description} ` : ""}
        The response sheet is private, so Branner reads it with a staff Google account that can open the form.
        Connect once, and new submissions show up here and on each profile.
      </p>
      <a
        href="/api/auth/google/sheets"
        className="mt-4 inline-flex rounded-lg bg-cardinal px-4 py-2 text-sm font-semibold text-white"
      >
        Connect Google Sheets
      </a>
    </>
  );
  if (plain) return <div className="mt-3">{body}</div>;
  return <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">{body}</div>;
}

function Answer({ value }: { value: string }) {
  const trimmed = value.trim();
  if (/^(none|n\/a|na|nothing|—|-)$/i.test(trimmed)) {
    return <span className="text-stone-mute">None</span>;
  }
  const url = trimmed.match(/^https?:\/\/\S+$/)?.[0];
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="break-all text-cardinal">
        {url}
      </a>
    );
  }
  const items = listItems(trimmed);
  if (items) {
    const compact = items.every((item) => item.length <= 42);
    if (compact) {
      return (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="rounded-md bg-stone-sand px-2 py-0.5 text-sm leading-5">
              {item}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex gap-2.5">
            <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-cardinal/55" aria-hidden />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="whitespace-pre-wrap break-words">{trimmed}</p>;
}

function listItems(value: string): string[] | null {
  if (value.includes("\n") || !value.includes(", ")) return null;
  const parts = value
    .split(", ")
    .map((item) => item.trim())
    .filter(Boolean);
  const items: string[] = [];
  for (const part of parts) {
    const previous = items[items.length - 1];
    if (previous && /^[a-z(]/.test(part)) items[items.length - 1] = `${previous}, ${part}`;
    else items.push(part);
  }
  return items.length > 1 ? items : null;
}
