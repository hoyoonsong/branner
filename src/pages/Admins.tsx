import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { STAFF_PAGES, type AdminRole, type StaffPageId } from "../lib/permissions";
import type { AdminUser } from "../lib/types";

type AdminPatch = {
  status?: string;
  role?: AdminRole;
  pages?: StaffPageId[];
};

type ReminderOverview = {
  ready: boolean;
  selected: string[];
  lastError: string;
  next: null | {
    sendLabel: string;
    birthdayLabel: string;
    due: boolean;
    people: { name: string }[];
  };
};

export function Admins() {
  const { user, refresh } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [birthdayEmails, setBirthdayEmails] = useState<Set<string>>(new Set());
  const [savedBirthdayEmails, setSavedBirthdayEmails] = useState<Set<string>>(new Set());
  const [reminders, setReminders] = useState<ReminderOverview | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    Promise.all([
      api<{ admins: AdminUser[] }>("/api/auth/admins"),
      api<ReminderOverview>("/api/settings/birthday-reminders"),
    ]).then(([adminsData, reminderData]) => {
      setAdmins(adminsData.admins);
      const selected = new Set(reminderData.selected);
      setBirthdayEmails(selected);
      setSavedBirthdayEmails(selected);
      setReminders(reminderData);
    });
  useEffect(() => {
    load().catch(console.error);
  }, []);

  const update = async (id: string, patch: AdminPatch) => {
    setError("");
    try {
      await api(`/api/auth/admins/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
      if (user?.id === id) await refresh();
    } catch (err) {
      setError((err as Error).message);
      load().catch(console.error);
    }
  };

  const toggleBirthdayEmail = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    const next = new Set(birthdayEmails);
    if (next.has(normalized)) next.delete(normalized);
    else next.add(normalized);
    setBirthdayEmails(next);
    setError("");
    try {
      const data = await api<ReminderOverview>("/api/settings/birthday-reminders", {
        method: "PUT",
        body: JSON.stringify({ emails: [...next] }),
      });
      const saved = new Set(data.selected);
      setBirthdayEmails(saved);
      setSavedBirthdayEmails(saved);
      setReminders(data);
    } catch (err) {
      setBirthdayEmails(new Set(savedBirthdayEmails));
      setError((err as Error).message);
    }
  };

  const visible = admins.filter((admin) => admin.status !== "rejected");
  const rejected = admins.filter((admin) => admin.status === "rejected");
  const next = reminders?.next;
  const nextNames = next?.people.map((person) => person.name).join(", ");

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">Admins</h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-mute">
        Approve staff. Admins can open every page. Student leaders only get the pages you check.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-stone-mute">
        Birthday email sends at 10:00 AM Pacific the day before a birthday. A birthday on the 11th
        is emailed at 10:00 AM on the 10th.
      </p>
      {next && (
        <p className="mt-3 max-w-2xl text-sm">
          {nextNames} {next.people.length === 1 ? "has a birthday" : "have birthdays"} on{" "}
          {next.birthdayLabel}.{" "}
          {birthdayEmails.size
            ? next.due
              ? "10:00 AM has passed, so checked admins get the email shortly."
              : `Checked admins are emailed ${next.sendLabel}.`
            : "Nobody is checked, so no email will send."}
        </p>
      )}
      {reminders && !reminders.ready && (
        <p className="mt-3 max-w-2xl text-sm text-stone-mute">
          These checkboxes are saved. Emails stay off until Railway has RESEND_API_KEY and
          RESEND_FROM set to {"Branner <birthday@hoyoonsong.com>"}.
        </p>
      )}
      {reminders?.lastError && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-cardinal">{reminders.lastError}</p>
      )}
      {error && <p className="mt-4 text-sm text-cardinal">{error}</p>}
      <div className="mt-6 space-y-3">
        {visible.map((admin) => (
          <AdminRow
            key={admin.id}
            admin={admin}
            birthdayEmail={birthdayEmails.has(admin.email.trim().toLowerCase())}
            onUpdate={update}
            onToggleBirthday={toggleBirthdayEmail}
          />
        ))}
        {visible.length === 0 && (
          <p className="px-4 py-5 text-sm text-stone-mute sm:px-5">No pending or approved admins.</p>
        )}
      </div>

      {rejected.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl">Rejected</h2>
          <p className="mt-1 text-sm text-stone-mute">
            These people are hidden above. Approve one to let them back in.
          </p>
          <div className="mt-4 space-y-3">
            {rejected.map((admin) => (
              <AdminRow
                key={admin.id}
                admin={admin}
                birthdayEmail={false}
                onUpdate={update}
                onToggleBirthday={toggleBirthdayEmail}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminRow({
  admin,
  birthdayEmail,
  onUpdate,
  onToggleBirthday,
}: {
  admin: AdminUser;
  birthdayEmail: boolean;
  onUpdate: (id: string, patch: AdminPatch) => void;
  onToggleBirthday: (email: string) => void;
}) {
  const role = admin.role === "student_leader" ? "student_leader" : "admin";
  const pages = new Set(admin.pages ?? []);

  const togglePage = (pageId: StaffPageId) => {
    const next = new Set(pages);
    if (next.has(pageId)) next.delete(pageId);
    else next.add(pageId);
    onUpdate(
      admin.id,
      { pages: STAFF_PAGES.map((page) => page.id).filter((id) => next.has(id)) },
    );
  };

  return (
    <article className="rounded-2xl bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{admin.name}</p>
          <p className="break-all text-sm text-stone-mute">{admin.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {admin.status === "approved" && (
            <label className="text-sm">
              <span className="sr-only">Role for {admin.name}</span>
              <select
                value={role}
                onChange={(event) => onUpdate(admin.id, { role: event.target.value as AdminRole })}
                className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm"
              >
                <option value="admin">Admin</option>
                <option value="student_leader">Student leader</option>
              </select>
            </label>
          )}
          <span className="text-xs uppercase tracking-wide text-stone-mute">{admin.status}</span>
          {admin.status !== "approved" && (
            <button
              type="button"
              className="text-sm font-medium text-cardinal"
              onClick={() => onUpdate(admin.id, { status: "approved" })}
            >
              Approve
            </button>
          )}
          {admin.status !== "rejected" && (
            <button
              type="button"
              className="text-sm text-stone-mute"
              onClick={() => onUpdate(admin.id, { status: "rejected" })}
            >
              Reject
            </button>
          )}
        </div>
      </div>
      {admin.status === "approved" && (
        <label className="mt-4 flex items-center gap-2 rounded-xl bg-stone-sand px-3 py-2 text-sm">
          <input
            type="checkbox"
            className="accent-cardinal"
            checked={birthdayEmail}
            onChange={() => onToggleBirthday(admin.email)}
          />
          Birthday email
        </label>
      )}
      {admin.status === "approved" && role === "student_leader" && (
        <div className="mt-3 border-t border-black/5 pt-3">
          <p className="text-xs uppercase tracking-wide text-stone-mute">Pages they can open</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Pages they can open">
            {STAFF_PAGES.map((page) => (
              <label key={page.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-cardinal"
                  checked={pages.has(page.id)}
                  onChange={() => togglePage(page.id)}
                />
                {page.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
