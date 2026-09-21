import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import "@xyflow/react/dist/style.css";
import type { FieldType, FormField, FormSchema, Resident } from "../lib/types";
import { OPTION_TYPES } from "../lib/types";
import { createField, syncBranches } from "../lib/conditional";
import { FormRenderer } from "./FormRenderer";
import { FieldPalette } from "./builder/FieldPalette";
import SortableFieldCard from "./builder/SortableFieldCard";
import SortableConditionalField from "./builder/SortableConditionalField";
import { PublishSidebar } from "./builder/PublishSidebar";
import { BuilderPointerSensor } from "./builder/builderPointerSensor";
import {
  BuilderContextMenu,
  type BuilderContextMenuItem,
} from "./builder/BuilderContextMenu";
import { EditDetailsModal, type DetailsDraft } from "./builder/EditDetailsModal";
import { Alert } from "./ui";
import {
  cloneFormFields,
  clipboardHasFormFields,
  FORM_FIELD_CLIPBOARD_EVENT,
  isBuilderEditableTarget,
  isBuilderInteractiveTarget,
  parseFormFieldClipboard,
  readFormFieldClipboard,
  writeFormFieldClipboard,
} from "../lib/formFieldClipboard";
import { fullName } from "../lib/utils";

type BuilderTab = "questions" | "responses";

export type BuilderSubmission = {
  id: string;
  createdAt: string;
  guestName?: string | null;
  resident?: Pick<Resident, "id" | "firstName" | "lastName" | "room" | "hall"> | null;
};

function cleanFields(fields: FormField[]): FormField[] {
  return fields.map((f) => {
    const out: FormField = { ...f };
    const isCheckboxTrigger = f.type === "conditional" && f.triggerType === "checkbox";
    if (OPTION_TYPES.includes(f.type) || (f.type === "conditional" && !isCheckboxTrigger)) {
      out.options = (f.options ?? []).map((o) => o.trim()).filter(Boolean);
    }
    if (f.type === "conditional") {
      const synced = syncBranches(out);
      out.branches = (synced.branches ?? []).map((b) => ({
        ...b,
        fields: cleanFields(b.fields),
      }));
    }
    return out;
  });
}

export function FormBuilderModal({
  schema,
  onChange,
  onClose,
  title = "Untitled form",
  description = "",
  requireLogin = false,
  shareUrl,
  status = "draft",
  submissions = [],
  saving = false,
  onSave,
  onMetaChange,
  onDeleteSubmission,
}: {
  schema: FormSchema;
  onChange: (schema: FormSchema) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  requireLogin?: boolean;
  shareUrl?: string;
  status?: "draft" | "published";
  submissions?: BuilderSubmission[];
  saving?: boolean;
  onSave?: (schema: FormSchema) => void | Promise<void>;
  onMetaChange?: (meta: DetailsDraft) => void | Promise<void>;
  onDeleteSubmission?: (submission: BuilderSubmission) => void;
}) {
  const [meta, setMeta] = useState<DetailsDraft>({ title, description, requireLogin });
  const [tab, setTab] = useState<BuilderTab>("questions");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clipboardReady, setClipboardReady] = useState(clipboardHasFormFields);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; fieldId: string | null } | null>(
    null,
  );
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null,
  );
  const lastSelectedRef = useRef<string | null>(null);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const listRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(BuilderPointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    setMeta({ title, description, requireLogin });
  }, [title, description, requireLogin]);

  const setFields = (fields: FormField[]) => onChange({ fields });

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }, []);

  const addField = (type: FieldType) => setFields([...schema.fields, createField(type)]);
  const addPersonalInfo = () => {
    const mk = (type: FieldType, label: string): FormField => ({
      ...createField(type),
      label,
      required: true,
      width: "half",
    });
    setFields([
      ...schema.fields,
      mk("text", "First name"),
      mk("text", "Last name"),
      mk("phone", "Phone number"),
      mk("email", "Email address"),
    ]);
  };
  const updateField = (index: number, changes: Partial<FormField>) =>
    setFields(schema.fields.map((f, i) => (i === index ? { ...f, ...changes } : f)));
  const replaceField = (index: number, next: FormField) =>
    setFields(schema.fields.map((f, i) => (i === index ? next : f)));
  const removeField = (index: number) => setFields(schema.fields.filter((_, i) => i !== index));

  const fieldsForAction = useCallback(
    (clickedId?: string | null): FormField[] => {
      if (clickedId && selectedIds.has(clickedId) && selectedIds.size > 1) {
        return schema.fields.filter((f) => selectedIds.has(f.id));
      }
      if (clickedId) {
        const one = schema.fields.find((f) => f.id === clickedId);
        return one ? [one] : [];
      }
      if (selectedIds.size > 0) return schema.fields.filter((f) => selectedIds.has(f.id));
      return [];
    },
    [selectedIds, schema.fields],
  );

  const removeFieldsById = useCallback(
    (ids: Set<string>) => {
      if (ids.size === 0) return;
      setFields(schema.fields.filter((f) => !ids.has(f.id)));
      setSelectedIds(new Set());
      lastSelectedRef.current = null;
    },
    [schema.fields],
  );

  const copyFields = useCallback(
    async (clickedId?: string | null) => {
      const fields = fieldsForAction(clickedId);
      if (fields.length === 0) return;
      await writeFormFieldClipboard(fields);
      setClipboardReady(true);
      flash(fields.length === 1 ? "Copied question." : `Copied ${fields.length} questions.`);
    },
    [fieldsForAction, flash],
  );

  const duplicateFields = useCallback(
    (clickedId?: string | null) => {
      const fields = fieldsForAction(clickedId);
      if (fields.length === 0) return;
      const clones = cloneFormFields(fields);
      const ids = schema.fields.map((f) => f.id);
      const lastId = fields[fields.length - 1]?.id;
      const at = lastId ? ids.indexOf(lastId) : -1;
      const insertAt = at >= 0 ? at + 1 : schema.fields.length;
      setFields([...schema.fields.slice(0, insertAt), ...clones, ...schema.fields.slice(insertAt)]);
      setSelectedIds(new Set(clones.map((f) => f.id)));
      lastSelectedRef.current = clones[clones.length - 1]?.id ?? null;
      flash(clones.length === 1 ? "Duplicated question." : `Duplicated ${clones.length} questions.`);
    },
    [fieldsForAction, flash, schema.fields],
  );

  const cutFields = useCallback(
    async (clickedId?: string | null) => {
      const fields = fieldsForAction(clickedId);
      if (fields.length === 0) return;
      await writeFormFieldClipboard(fields);
      setClipboardReady(true);
      removeFieldsById(new Set(fields.map((f) => f.id)));
      flash(fields.length === 1 ? "Cut question." : `Cut ${fields.length} questions.`);
    },
    [fieldsForAction, flash, removeFieldsById],
  );

  const pasteFields = useCallback(
    async (pastedText?: string) => {
      const raw = await readFormFieldClipboard(pastedText);
      if (!raw || raw.length === 0) return false;
      const clones = cloneFormFields(raw);
      const ids = schema.fields.map((f) => f.id);
      let insertAt = schema.fields.length;
      if (selectedIds.size > 0) {
        let last = -1;
        for (let i = 0; i < ids.length; i++) {
          if (selectedIds.has(ids[i]!)) last = i;
        }
        if (last >= 0) insertAt = last + 1;
      }
      setFields([...schema.fields.slice(0, insertAt), ...clones, ...schema.fields.slice(insertAt)]);
      setSelectedIds(new Set(clones.map((f) => f.id)));
      lastSelectedRef.current = clones[clones.length - 1]?.id ?? null;
      flash(clones.length === 1 ? "Pasted question." : `Pasted ${clones.length} questions.`);
      return true;
    },
    [flash, selectedIds, schema.fields],
  );

  const selectField = useCallback(
    (id: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      const ids = schema.fields.map((f) => f.id);
      setSelectedIds((prev) => {
        if (e.shiftKey && lastSelectedRef.current) {
          const a = ids.indexOf(lastSelectedRef.current);
          const b = ids.indexOf(id);
          if (a >= 0 && b >= 0) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            return new Set(ids.slice(lo, hi + 1));
          }
        }
        if (e.metaKey || e.ctrlKey) {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          lastSelectedRef.current = id;
          return next;
        }
        lastSelectedRef.current = id;
        return new Set([id]);
      });
    },
    [schema.fields],
  );

  const openFieldMenu = useCallback(
    (e: React.MouseEvent, fieldId: string) => {
      if (isBuilderEditableTarget(e.target)) return;
      e.preventDefault();
      if (!selectedIds.has(fieldId)) {
        lastSelectedRef.current = fieldId;
        setSelectedIds(new Set([fieldId]));
      }
      setCtxMenu({ x: e.clientX, y: e.clientY, fieldId });
    },
    [selectedIds],
  );

  useEffect(() => {
    const sync = () => setClipboardReady(clipboardHasFormFields());
    window.addEventListener(FORM_FIELD_CLIPBOARD_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FORM_FIELD_CLIPBOARD_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab !== "questions") return;
      if (isBuilderEditableTarget(e.target)) return;
      const metaKey = e.metaKey || e.ctrlKey;
      if (metaKey && e.key.toLowerCase() === "c") {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        void copyFields();
        return;
      }
      if (metaKey && e.key.toLowerCase() === "x") {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        void cutFields();
        return;
      }
      if (metaKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(new Set(schema.fields.map((f) => f.id)));
        lastSelectedRef.current = schema.fields[schema.fields.length - 1]?.id ?? null;
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setCtxMenu(null);
        lastSelectedRef.current = null;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && selectedIds.size > 0) {
        if (isBuilderEditableTarget(e.target)) return;
        e.preventDefault();
        removeFieldsById(selectedIds);
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (tab !== "questions") return;
      if (isBuilderEditableTarget(e.target)) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (!parseFormFieldClipboard(text)) return;
      e.preventDefault();
      void pasteFields(text);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [copyFields, cutFields, pasteFields, removeFieldsById, selectedIds, schema.fields, tab]);

  useEffect(() => {
    if (tab !== "questions") return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      if (t.closest("header")) return;
      if (t.closest("[data-builder-block]")) return;
      if (t.closest("[data-no-marquee]")) return;
      if (t.closest(".fixed.inset-0")) return;
      if (isBuilderInteractiveTarget(t)) return;
      const start = { x: e.clientX, y: e.clientY };
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const existing = additive ? new Set(selectedIdsRef.current) : new Set<string>();
      setMarquee({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });
      document.body.classList.add("select-none");

      const hits = (clientX: number, clientY: number) => {
        const box = {
          left: Math.min(start.x, clientX),
          top: Math.min(start.y, clientY),
          right: Math.max(start.x, clientX),
          bottom: Math.max(start.y, clientY),
        };
        const tiny = box.right - box.left < 6 && box.bottom - box.top < 6;
        const next = new Set(existing);
        if (!tiny) {
          const root = listRef.current ?? document;
          root.querySelectorAll<HTMLElement>("[data-builder-block]").forEach((node) => {
            const id = node.dataset.fieldId;
            if (!id) return;
            const r = node.getBoundingClientRect();
            const hit =
              r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top;
            if (hit) next.add(id);
          });
        }
        return { next, tiny };
      };

      const onMove = (ev: PointerEvent) => {
        setMarquee({ x1: start.x, y1: start.y, x2: ev.clientX, y2: ev.clientY });
        const { next, tiny } = hits(ev.clientX, ev.clientY);
        if (!tiny) {
          setSelectedIds(next);
          lastSelectedRef.current = [...next].pop() ?? null;
        }
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        document.body.classList.remove("select-none");
        const { next, tiny } = hits(ev.clientX, ev.clientY);
        setMarquee(null);
        if (tiny) {
          if (!additive) {
            setSelectedIds(new Set());
            lastSelectedRef.current = null;
          }
          return;
        }
        setSelectedIds(next);
        lastSelectedRef.current = [...next].pop() ?? null;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      document.body.classList.remove("select-none");
    };
  }, [tab]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = schema.fields.findIndex((f) => f.id === active.id);
    const newIndex = schema.fields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setFields(arrayMove(schema.fields, oldIndex, newIndex));
  };

  const persist = async () => {
    setError(null);
    try {
      await onSave?.({ fields: cleanFields(schema.fields) });
      flash(status === "published" ? "Form published." : "Saved.");
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    flash("Link copied.");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div
          data-no-marquee
          className="mb-6 flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{meta.title || "Untitled form"}</h1>
              {status === "published" && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                  LIVE
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {meta.description || "Build your form below."}
            </p>
          </div>

          <div className="flex justify-center">
            <div
              role="tablist"
              aria-label="Form sections"
              className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
            >
              <BuilderTabButton active={tab === "questions"} onClick={() => setTab("questions")}>
                Questions
              </BuilderTabButton>
              <BuilderTabButton active={tab === "responses"} onClick={() => setTab("responses")}>
                Responses
                {submissions.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {submissions.length}
                  </span>
                )}
              </BuilderTabButton>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              ← Back
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4" data-no-marquee>
            <Alert variant="success">{notice}</Alert>
          </div>
        )}
        {error && (
          <div className="mb-4" data-no-marquee>
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {tab === "responses" && (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold text-slate-800">Responses</h2>
              <p className="text-sm text-slate-500">{submissions.length} check-ins</p>
            </div>
            <div className="divide-y divide-slate-100">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {s.resident ? fullName(s.resident) : s.guestName || "Guest"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.resident ? `${s.resident.room} · ${s.resident.hall}` : "Name written at check-in"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                    {onDeleteSubmission && (
                      <button
                        type="button"
                        onClick={() => onDeleteSubmission(s)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {submissions.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-slate-400">
                  Responses appear here after residents check in.
                </p>
              )}
            </div>
          </div>
        )}

        <div className={clsx("grid gap-6 lg:grid-cols-[1fr_320px]", tab === "responses" && "hidden")}>
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50/60 p-4">
              <div className="mb-4 flex items-center gap-2 border-l-4 border-green-500 pl-3">
                <h2 className="text-lg font-semibold text-slate-800">Form Builder</h2>
              </div>

              <div data-no-marquee className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <FieldPalette onAdd={addField} onAddPersonalInfo={addPersonalInfo} />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div
                  data-no-marquee
                  className="mb-0 flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3"
                >
                  <h3 className="font-semibold text-slate-800">Your Questions</h3>
                  <span className="text-sm text-brand-600">
                    {schema.fields.length} {schema.fields.length === 1 ? "question" : "questions"} added
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {selectedIds.size > 0 && (
                      <>
                        <span className="text-xs font-medium text-slate-500">
                          {selectedIds.size} selected
                        </span>
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-700 hover:underline"
                          onClick={() => void copyFields()}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-700 hover:underline"
                          onClick={() => duplicateFields()}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:underline"
                          onClick={() => removeFieldsById(selectedIds)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={schema.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    <div
                      ref={listRef}
                      className={`relative min-h-[8rem] space-y-4 px-6 py-5 ${marquee ? "select-none" : ""}`}
                      onContextMenu={(e) => {
                        if (isBuilderEditableTarget(e.target)) return;
                        if (e.target instanceof Element && e.target.closest("[data-builder-block]")) {
                          return;
                        }
                        e.preventDefault();
                        setCtxMenu({ x: e.clientX, y: e.clientY, fieldId: null });
                      }}
                    >
                      {schema.fields.map((field, index) =>
                        field.type === "conditional" ? (
                          <SortableConditionalField
                            key={field.id}
                            field={field}
                            selected={selectedIds.has(field.id)}
                            onSelect={(e) => selectField(field.id, e)}
                            onContextMenu={(e) => openFieldMenu(e, field.id)}
                            onCopy={() => void copyFields(field.id)}
                            onCut={() => void cutFields(field.id)}
                            onDuplicate={() => duplicateFields(field.id)}
                            onChange={(next) => replaceField(index, next)}
                            onRemove={() => removeField(index)}
                          />
                        ) : (
                          <SortableFieldCard
                            key={field.id}
                            field={field}
                            selected={selectedIds.has(field.id)}
                            onSelect={(e) => selectField(field.id, e)}
                            onContextMenu={(e) => openFieldMenu(e, field.id)}
                            onCopy={() => void copyFields(field.id)}
                            onCut={() => void cutFields(field.id)}
                            onDuplicate={() => duplicateFields(field.id)}
                            onChange={(c) => updateField(index, c)}
                            onRemove={() => removeField(index)}
                          />
                        ),
                      )}
                      {schema.fields.length === 0 && (
                        <p className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                          No questions yet. Pick a field type above to get started.
                        </p>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>

          <div data-no-marquee className="lg:sticky lg:top-6 lg:self-start">
            <PublishSidebar
              status={status}
              saving={saving}
              shareUrl={shareUrl}
              onPreview={() => setShowPreview(true)}
              onSaveDraft={() => void persist()}
              onPublish={() => {
                void persist().then((ok) => {
                  if (ok) onClose();
                });
              }}
              onCopyLink={() => void copyLink()}
              onOpenDetails={() => setShowDetails(true)}
            />
            <p className="mt-3 text-xs text-slate-500">
              Check-in location is not a question — it is captured automatically when tracking is on.
            </p>
          </div>
        </div>
      </div>

      {showDetails && (
        <EditDetailsModal
          initial={meta}
          saving={saving}
          error={error}
          onClose={() => setShowDetails(false)}
          onSave={async (draft) => {
            setMeta(draft);
            await onMetaChange?.(draft);
            setShowDetails(false);
            flash("Saved.");
          }}
        />
      )}

      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-6 py-6">
              <h3 className="text-xl font-bold text-slate-900">{meta.title || "Untitled form"}</h3>
              {meta.description && <p className="mb-4 mt-1 text-sm text-slate-500">{meta.description}</p>}
              <PreviewForm fields={schema.fields} />
            </div>
          </div>
        </div>
      )}

      {marquee &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[4000] border border-brand-500 bg-brand-500/10"
            style={{
              left: Math.min(marquee.x1, marquee.x2),
              top: Math.min(marquee.y1, marquee.y2),
              width: Math.abs(marquee.x2 - marquee.x1),
              height: Math.abs(marquee.y2 - marquee.y1),
            }}
          />,
          document.body,
        )}

      {ctxMenu && (
        <BuilderContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={((): BuilderContextMenuItem[] => {
            const n = fieldsForAction(ctxMenu.fieldId).length;
            const noun = n === 1 ? "question" : n > 1 ? `${n} questions` : "question";
            if (!ctxMenu.fieldId) {
              const items: BuilderContextMenuItem[] = [
                {
                  id: "paste",
                  label: "Paste",
                  hint: "⌘V",
                  disabled: !clipboardReady,
                  onClick: () => void pasteFields(),
                },
                {
                  id: "select-all",
                  label: "Select all",
                  hint: "⌘A",
                  disabled: schema.fields.length === 0,
                  onClick: () => {
                    setSelectedIds(new Set(schema.fields.map((f) => f.id)));
                    lastSelectedRef.current = schema.fields[schema.fields.length - 1]?.id ?? null;
                  },
                },
              ];
              if (selectedIds.size > 0) {
                items.unshift(
                  {
                    id: "copy",
                    label: `Copy ${noun}`,
                    hint: "⌘C",
                    onClick: () => void copyFields(),
                  },
                  {
                    id: "dup",
                    label: `Duplicate ${noun}`,
                    onClick: () => duplicateFields(),
                  },
                );
              }
              return items;
            }
            return [
              {
                id: "copy",
                label: `Copy ${noun}`,
                hint: "⌘C",
                onClick: () => void copyFields(ctxMenu.fieldId),
              },
              {
                id: "dup",
                label: `Duplicate ${noun}`,
                onClick: () => duplicateFields(ctxMenu.fieldId),
              },
              {
                id: "cut",
                label: `Cut ${noun}`,
                hint: "⌘X",
                onClick: () => void cutFields(ctxMenu.fieldId),
              },
              {
                id: "del",
                label: `Delete ${noun}`,
                danger: true,
                onClick: () =>
                  removeFieldsById(new Set(fieldsForAction(ctxMenu.fieldId).map((f) => f.id))),
              },
            ];
          })()}
        />
      )}
    </div>
  );
}

function BuilderTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function PreviewForm({ fields }: { fields: FormField[] }) {
  const cleaned = cleanFields(fields).filter((f) => f.label.trim() || f.type === "conditional");
  const key = JSON.stringify(cleaned.map((f) => [f.id, f.type, f.options, f.branches?.length]));
  return (
    <FormRenderer
      key={key}
      schema={{ fields: cleaned }}
      onSubmit={() => undefined}
      submitLabel="Submit (preview)"
    />
  );
}
