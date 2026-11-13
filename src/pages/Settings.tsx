import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { personSearchHay } from "../lib/utils";

type Person = {
  email: string;
  name: string;
  detail: string;
  kind: "resident" | "admin";
};

type Overview = {
  ready: boolean;
  from: string;
  selected: string[];
  people: Person[];
  lastError: string;
  lastSentAt: string | null;
  next: null | {
    sendLabel: string;
    birthdayLabel: string;
    due: boolean;
    people: { name: string; detail: string }[];
  };
};

export function Settings() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState("");

  const load = () =>
    api<Overview>("/api/settings/birthday-reminders").then((data) => {
      const next = new Set(data.selected);
      setOverview(data);
      setSelected(next);
      setSaved(next);
    });

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  const save = async (next: Set<string>) => {
    setSelected(new Set(next));
    setSaving(true);
    setError("");
    try {
      const data = await api<Overview>("/api/settings/birthday-reminders", {
        method: "PUT",
        body: JSON.stringify({ emails: [...next] }),
      });
      const savedNext = new Set(data.selected);
      setOverview(data);
      setSelected(savedNext);
      setSaved(savedNext);
    } catch (err) {
      setSelected(new Set(saved));
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (email: string) => {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    void save(next);
  };

  const people = overview?.people ?? [];
  const filtered = useMemo(() => {
    const needle = personSearchHay([query]);
    if (!needle) return people;
    return people.filter((person) =>
      personSearchHay([person.name, person.email, person.detail]).includes(needle),
    );
  }, [people, query]);
  const residents = filtered.filter((person) => person.kind === "resident");
  const admins = filtered.filter((person) => person.kind === "admin");

  const sendTest = async () => {
    setTesting(true);
    setTestNote("");
    setError("");
    try {
      const result = await api<{ email: string }>("/api/settings/birthday-reminders/test", {
        method: "POST",
      });
      setTestNote(`Test sent to ${result.email}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const next = overview?.next;
  const names = next?.people.map((person) => person.name).join(", ");

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">Settings</h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-mute">
        Checked people get an email at 10:00 AM Pacific the day before a birthday. If a birthday is
        on the 11th, that email goes out at 10:00 AM on the 10th.
      </p>

      {error && <p className="mt-4 text-sm text-cardinal">{error}</p>}

      {overview && !overview.ready && (
        <p className="mt-4 text-sm text-cardinal">
          Set RESEND_API_KEY and RESEND_FROM on the server before these emails can send. RESEND_FROM
          has to be an address on a domain you verified in Resend.
        </p>
      )}
      {overview?.ready && overview.from && (
        <p className="mt-4 text-sm text-stone-mute">Sent from {overview.from}.</p>
      )}
      {overview?.lastError && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-cardinal">{overview.lastError}</p>
      )}
      {overview?.lastSentAt && (
        <p className="mt-2 text-sm text-stone-mute">
          Last sent {new Date(overview.lastSentAt).toLocaleString()}.
        </p>
      )}

      {next && (
        <p className="mt-4 max-w-2xl text-sm">
          {names} {next.people.length === 1 ? "has a birthday" : "have birthdays"} on{" "}
          {next.birthdayLabel}.{" "}
          {selected.size
            ? next.due
              ? "10:00 AM has passed, so checked people get the email shortly."
              : `Checked people are emailed ${next.sendLabel}.`
            : "Nobody is checked, so no email will send."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={testing || !overview?.ready}
          className="rounded-lg bg-cardinal px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {testing ? "Sending…" : "Send me a test"}
        </button>
        {testNote && <p className="text-sm text-stone-mute">{testNote}</p>}
        {saving && <p className="text-sm text-stone-mute">Saving…</p>}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, room"
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm sm:w-64"
        />
        <p className="text-sm text-stone-mute">
          {selected.size} {selected.size === 1 ? "person" : "people"} checked
        </p>
      </div>

      <PersonList people={residents} selected={selected} onToggle={toggle} />
      {admins.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl">Admins not on the roster</h2>
          <PersonList people={admins} selected={selected} onToggle={toggle} />
        </section>
      )}
      {overview && filtered.length === 0 && (
        <p className="mt-6 text-sm text-stone-mute">No matching people.</p>
      )}
    </div>
  );
}

function PersonList({
  people,
  selected,
  onToggle,
}: {
  people: Person[];
  selected: Set<string>;
  onToggle: (email: string) => void;
}) {
  if (!people.length) return null;
  return (
    <div className="mt-4 divide-y divide-black/5 rounded-2xl bg-white shadow-sm">
      {people.map((person) => (
        <label key={person.email} className="flex cursor-pointer items-start gap-3 px-4 py-3 sm:px-5">
          <input
            type="checkbox"
            className="mt-1 accent-cardinal"
            checked={selected.has(person.email)}
            onChange={() => onToggle(person.email)}
          />
          <span className="min-w-0">
            <span className="font-medium">{person.name}</span>
            {person.detail && <span className="block text-sm text-stone-mute">{person.detail}</span>}
            <span className="block break-all text-xs text-stone-mute">{person.email}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
