import { clsx } from "clsx";

export function PublishSidebar({
  status,
  saving,
  shareUrl,
  onPreview,
  onSaveDraft,
  onPublish,
  onCopyLink,
  onOpenDetails,
}: {
  status: "draft" | "published";
  saving: boolean;
  shareUrl?: string;
  onPreview: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onCopyLink: () => void;
  onOpenDetails: () => void;
}) {
  const isLive = status === "published";

  return (
    <div className="space-y-4">
      <div
        className={clsx(
          "rounded-lg border bg-white p-4 shadow-sm",
          isLive ? "border-green-200" : "border-amber-300",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Publish
          </span>
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              isLive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
            )}
          >
            {isLive ? "LIVE" : "DRAFT"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {isLive ? "Your form is live." : "This form is a draft."}
        </p>

        <div className="mt-4 space-y-2">
          <button type="button" onClick={onPreview} className="btn-secondary w-full">
            Preview form
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="btn-secondary w-full"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={saving}
            className="btn w-full bg-green-600 text-white hover:bg-green-700"
          >
            {isLive ? "Update live page" : "Publish form"}
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Share link
          </span>
          <div className="mt-2 flex gap-2">
            <input readOnly value={shareUrl} className="input flex-1 text-xs" />
            <button type="button" onClick={onCopyLink} className="btn-primary px-3">
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Program settings
        </span>
        <div className="mt-2 divide-y divide-slate-100">
          <SettingLink
            title="Edit details"
            subtitle="Title, description, link & confirmation"
            onClick={onOpenDetails}
          />
          <SettingLink title="Access" subtitle="Public link or Stanford login" onClick={onOpenDetails} />
        </div>
      </div>
    </div>
  );
}

function SettingLink({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="block w-full py-2.5 text-left">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </button>
  );
}
