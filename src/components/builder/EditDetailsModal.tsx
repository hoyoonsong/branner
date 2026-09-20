export type DetailsDraft = {
  title: string;
  description: string;
  requireLogin: boolean;
};

export function EditDetailsModal({
  initial,
  saving,
  error,
  onClose,
  onSave,
}: {
  initial: DetailsDraft;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: DetailsDraft) => void | Promise<void>;
}) {
  return (
    <form
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void onSave({
          title: String(fd.get("title") ?? ""),
          description: String(fd.get("description") ?? ""),
          requireLogin: fd.get("access") === "staff",
        });
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Edit details</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">Title</span>
            <input name="title" defaultValue={initial.title} required className="input" />
          </label>
          <label className="block">
            <span className="label">Description</span>
            <textarea
              name="description"
              defaultValue={initial.description}
              rows={3}
              className="input"
              placeholder="Shown at the top of the check-in form"
            />
          </label>
          <fieldset>
            <legend className="label">Access</legend>
            <label className="mt-1 flex items-start gap-2 text-sm text-slate-700">
              <input type="radio" name="access" value="public" defaultChecked={!initial.requireLogin} className="mt-0.5" />
              <span>
                <span className="font-medium">Public link — no Stanford login</span>
                <span className="block text-xs text-slate-500">
                  Anyone with the QR / URL can submit. They type their first and last name.
                </span>
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
              <input type="radio" name="access" value="staff" defaultChecked={initial.requireLogin} className="mt-0.5" />
              <span>
                <span className="font-medium">Require Stanford login</span>
                <span className="block text-xs text-slate-500">
                  Residents sign in with @stanford.edu to verify identity.
                </span>
              </span>
            </label>
          </fieldset>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
