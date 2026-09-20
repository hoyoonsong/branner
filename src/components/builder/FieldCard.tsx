// @ts-nocheck — campaign filing props are stubbed; keep the original card UI.
import { clsx } from 'clsx';
import {
  ADDRESS_PART_META,
  DEFAULT_ADDRESS_PARTS,
  FIELD_TYPE_LABELS,
  HEADSHOT_ASPECT_META,
  HEADSHOT_DEFAULT_ASPECT,
  OPTION_TYPES,
  REGISTER_LAYERS,
  defaultRegisterLayer,
  fieldAccent,
  type AddressPart,
  type FormField,
  type MeetAndGreetHostType,
  type RegisterLayer,
  type RegisterTarget,
  type VolunteerRegisterStatus,
  type YardSignStatus,
} from '../../lib/types';
import { accentOf } from './accents';
import { RichTextEditor } from '../RichTextEditor';
import { richTextToPlain, sanitizeHref } from '../../lib/richtext';
import { RegisterTargetSelect } from './RegisterTargetSelect';
import { OptionFilingControls } from './OptionFilingControls';
import { BlockOverflowMenu } from './BlockOverflowMenu';

function renameKeyedMap<T>(
  map: Partial<Record<string, T>> | undefined,
  oldKey: string,
  newKey: string,
): Partial<Record<string, T>> | undefined {
  if (!map || !(oldKey in map)) return map;
  const next = { ...map };
  const val = next[oldKey];
  delete next[oldKey];
  if (newKey && val !== undefined) next[newKey] = val;
  return Object.keys(next).length ? next : undefined;
}

function deleteKeyedMap<T>(
  map: Partial<Record<string, T>> | undefined,
  key: string,
): Partial<Record<string, T>> | undefined {
  if (!map || !(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return Object.keys(next).length ? next : undefined;
}

export interface FieldCardProps {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  selected?: boolean;
  onCopy?: () => void;
  onCut?: () => void;
  onDuplicate?: () => void;
  /** Form-level auto-register target — enables map-layer picker on address/location. */
  registerTo?: RegisterTarget | null;
  /** When the form files to a custom page, that page's id (for map-dot pickers). */
  registerCustomPageId?: string | null;
  /** Form-level custom page layer; when set, hide per-answer layer pickers. */
  registerCustomLayer?: string | null;
  /** Form-level map layer; when set, hide per-answer size pickers. */
  formRegisterLayer?: RegisterLayer | null;
}

export function FieldCard({
  field,
  onChange,
  onRemove,
  selected,
  onCopy,
  onCut,
  onDuplicate,
  registerTo,
  registerCustomPageId,
  registerCustomLayer,
  formRegisterLayer,
}: FieldCardProps) {
  const accent = accentOf(fieldAccent(field.type));
  const isHeading = field.type === 'heading';
  const hasOptions = OPTION_TYPES.includes(field.type);

  const formFilesYs = registerTo === 'yard_signs';
  const formFilesMg = registerTo === 'meet_and_greets';
  const formFilesCustom = registerTo === 'custom';

  const setConnection = (
    value: string,
    target: RegisterTarget | '',
    customPageId?: string | null,
  ) => {
    const map = { ...(field.connectRegister ?? {}) };
    const statusMap = { ...(field.connectYardStatus ?? {}) };
    const volMap = { ...(field.connectVolunteerStatus ?? {}) };
    const layerMap = { ...(field.connectLayer ?? {}) };
    const hostMap = { ...(field.connectHostType ?? {}) };
    const customMap = { ...(field.connectCustomPageId ?? {}) };
    const locMap = { ...(field.connectCustomLocationId ?? {}) };
    const customLayerMap = { ...(field.connectCustomLayer ?? {}) };
    if (target) {
      map[value] = target;
      if (target === 'yard_signs' && !statusMap[value]) {
        statusMap[value] = 'requested';
      }
      if (target === 'volunteers' && !volMap[value]) {
        volMap[value] = 'interested';
      }
      if (target === 'custom' && customPageId) {
        if (customMap[value] !== customPageId) {
          delete locMap[value];
          delete customLayerMap[value];
        }
        customMap[value] = customPageId;
      } else {
        delete customMap[value];
        if (!formFilesCustom) {
          delete locMap[value];
          delete customLayerMap[value];
        }
      }
      if (target !== 'yard_signs' && !formFilesYs) {
        delete statusMap[value];
        delete layerMap[value];
      }
      if (target !== 'volunteers') delete volMap[value];
      if (target !== 'meet_and_greets' && !formFilesMg) delete hostMap[value];
    } else {
      delete map[value];
      if (!formFilesYs) {
        delete statusMap[value];
        delete layerMap[value];
      }
      delete volMap[value];
      if (!formFilesMg) delete hostMap[value];
      delete customMap[value];
      if (!formFilesCustom) {
        delete locMap[value];
        delete customLayerMap[value];
      }
    }
    onChange({
      connectRegister: Object.keys(map).length ? map : undefined,
      connectYardStatus: Object.keys(statusMap).length ? statusMap : undefined,
      connectVolunteerStatus: Object.keys(volMap).length ? volMap : undefined,
      connectLayer: Object.keys(layerMap).length ? layerMap : undefined,
      connectHostType: Object.keys(hostMap).length ? hostMap : undefined,
      connectCustomPageId: Object.keys(customMap).length ? customMap : undefined,
      connectCustomLocationId: Object.keys(locMap).length ? locMap : undefined,
      connectCustomLayer: Object.keys(customLayerMap).length
        ? customLayerMap
        : undefined,
    });
  };

  const setCustomLocation = (value: string, locationId: string | null) => {
    const map = { ...(field.connectCustomLocationId ?? {}) };
    if (locationId) map[value] = locationId;
    else delete map[value];
    onChange({
      connectCustomLocationId: Object.keys(map).length ? map : undefined,
    });
  };

  const setCustomLayer = (value: string, layerKey: string | null) => {
    const map = { ...(field.connectCustomLayer ?? {}) };
    if (layerKey) map[value] = layerKey;
    else delete map[value];
    onChange({
      connectCustomLayer: Object.keys(map).length ? map : undefined,
    });
  };

  const setYardStatus = (value: string, status: YardSignStatus | '') => {
    const map = { ...(field.connectYardStatus ?? {}) };
    if (status) map[value] = status;
    else delete map[value];
    onChange({
      connectYardStatus: Object.keys(map).length ? map : undefined,
    });
  };

  const setVolunteerStatus = (
    value: string,
    status: VolunteerRegisterStatus | '',
  ) => {
    const map = { ...(field.connectVolunteerStatus ?? {}) };
    if (status) map[value] = status;
    else delete map[value];
    onChange({
      connectVolunteerStatus: Object.keys(map).length ? map : undefined,
    });
  };

  const setOptionLayer = (value: string, layer: RegisterLayer | '') => {
    const map = { ...(field.connectLayer ?? {}) };
    if (layer) map[value] = layer;
    else delete map[value];
    onChange({ connectLayer: Object.keys(map).length ? map : undefined });
  };

  const setHostType = (value: string, hostType: MeetAndGreetHostType | '') => {
    const map = { ...(field.connectHostType ?? {}) };
    if (hostType) map[value] = hostType;
    else delete map[value];
    onChange({
      connectHostType: Object.keys(map).length ? map : undefined,
    });
  };

  const setOption = (i: number, val: string) => {
    const options = [...(field.options ?? [])];
    const old = options[i];
    options[i] = val;
    onChange({
      options,
      connectRegister: renameKeyedMap(field.connectRegister, old, val) as
        | Record<string, RegisterTarget>
        | undefined,
      connectYardStatus: renameKeyedMap(field.connectYardStatus, old, val),
      connectVolunteerStatus: renameKeyedMap(
        field.connectVolunteerStatus,
        old,
        val,
      ),
      connectLayer: renameKeyedMap(field.connectLayer, old, val),
      connectHostType: renameKeyedMap(field.connectHostType, old, val),
      connectCustomPageId: renameKeyedMap(field.connectCustomPageId, old, val) as
        | Record<string, string>
        | undefined,
      connectCustomLocationId: renameKeyedMap(
        field.connectCustomLocationId,
        old,
        val,
      ) as Record<string, string> | undefined,
      connectCustomLayer: renameKeyedMap(
        field.connectCustomLayer,
        old,
        val,
      ) as Record<string, string> | undefined,
    });
  };
  const addOption = () => onChange({ options: [...(field.options ?? []), ''] });
  const removeOption = (i: number) => {
    const removed = (field.options ?? [])[i];
    const options = (field.options ?? []).filter((_, j) => j !== i);
    onChange({
      options,
      connectRegister: deleteKeyedMap(field.connectRegister, removed) as
        | Record<string, RegisterTarget>
        | undefined,
      connectYardStatus: deleteKeyedMap(field.connectYardStatus, removed),
      connectVolunteerStatus: deleteKeyedMap(
        field.connectVolunteerStatus,
        removed,
      ),
      connectLayer: deleteKeyedMap(field.connectLayer, removed),
      connectHostType: deleteKeyedMap(field.connectHostType, removed),
      connectCustomPageId: deleteKeyedMap(field.connectCustomPageId, removed) as
        | Record<string, string>
        | undefined,
      connectCustomLocationId: deleteKeyedMap(
        field.connectCustomLocationId,
        removed,
      ) as Record<string, string> | undefined,
      connectCustomLayer: deleteKeyedMap(
        field.connectCustomLayer,
        removed,
      ) as Record<string, string> | undefined,
    });
  };

  return (
    <div
      className={clsx(
        'rounded-xl border-2 bg-gray-50 p-6 transition-all duration-200 hover:shadow-md',
        selected
          ? 'border-brand-500 ring-2 ring-brand-200'
          : 'border-gray-200 hover:border-gray-300',
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <span className={clsx('text-2xl font-bold uppercase tracking-wide', accent.header)}>
            {FIELD_TYPE_LABELS[field.type]}
          </span>
          {!isHeading && (
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={!!field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
              />
              Required
            </label>
          )}
          {!isHeading && (
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={field.width === 'half'}
                onChange={(e) => onChange({ width: e.target.checked ? 'half' : 'full' })}
              />
              Half width
            </label>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onCopy && onCut && onDuplicate && (
            <BlockOverflowMenu
              onCopy={onCopy}
              onCut={onCut}
              onDuplicate={onDuplicate}
            />
          )}
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Question text */}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {isHeading ? 'Section heading / statement' : 'Question Text *'}
          </label>
          {isHeading ? (
            <>
              <RichTextEditor
                value={field.richText ?? field.label ?? ''}
                onChange={(html) =>
                  onChange({ richText: html, label: richTextToPlain(html) })
                }
                ariaLabel="Section heading"
                placeholder="e.g. Thanks for coming! Donate at example.com"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Add bold text or a link — select text and press{' '}
                <span className="font-medium">🔗 Link</span>, or click Link with nothing
                selected to drop in a URL.
              </p>
              <label className="mt-3 block text-sm font-medium text-gray-700">
                Embed page (optional)
              </label>
              <input
                type="url"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                value={field.embedUrl ?? ''}
                onChange={(e) =>
                  onChange({
                    embedUrl: e.target.value.trim()
                      ? sanitizeHref(e.target.value)
                      : undefined,
                  })
                }
                placeholder="https://… — shown in-page (e.g. donate form)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Embeds below the statement so people can donate without leaving
                this form. External sites must allow embedding.
              </p>
            </>
          ) : (
          <div className="flex items-center gap-3">
            <input
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              placeholder={'Enter your question here…'}
            />
            {field.type === 'textarea' && (
              <div className="flex items-center gap-2">
                <label className="whitespace-nowrap text-sm font-medium text-gray-700">
                  Max words:
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  value={field.maxWords ?? ''}
                  onChange={(e) =>
                    onChange({ maxWords: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="none"
                />
              </div>
            )}
          </div>
          )}
        </div>

        {/* Type-specific config */}
        {hasOptions && (
          <OptionsEditor
            field={field}
            registerTo={registerTo}
            formRegisterLayer={formRegisterLayer}
            formCustomPageId={registerCustomPageId}
            formCustomLayer={registerCustomLayer}
            onChange={onChange}
            setOption={setOption}
            addOption={addOption}
            removeOption={removeOption}
            setConnection={setConnection}
            setYardStatus={setYardStatus}
            setVolunteerStatus={setVolunteerStatus}
            setOptionLayer={setOptionLayer}
            setHostType={setHostType}
            setCustomLocation={setCustomLocation}
            setCustomLayer={setCustomLayer}
          />
        )}

        {field.type === 'file' && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              checked={field.allowLink ?? true}
              onChange={(e) => onChange({ allowLink: e.target.checked })}
            />
            Allow URL link submission (Drive, Dropbox, …)
          </label>
        )}

        {field.type === 'headshot' && (
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">Crop shape</span>
            <div className="flex flex-wrap gap-2">
              {HEADSHOT_ASPECT_META.map((a) => {
                const active =
                  (field.headshotAspect ?? HEADSHOT_DEFAULT_ASPECT) === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => onChange({ headshotAspect: a.key })}
                    className={clsx(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                      active
                        ? 'border-rose-400 bg-rose-50 text-rose-900'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <span
                      className={clsx(
                        'block w-4 shrink-0 rounded-sm border-2',
                        active ? 'border-rose-400' : 'border-gray-300',
                      )}
                      style={{ aspectRatio: `${a.w} / ${a.h}` }}
                      aria-hidden
                    />
                    {a.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">
              People upload an image and drag it into this frame. Only the framed
              part is saved, so every one comes back the same shape.
            </p>
          </div>
        )}

        {field.type === 'checkbox' && (
          <div className="space-y-2">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              <span className="mr-2 inline-block h-3.5 w-3.5 -mb-0.5 rounded-sm border-2 border-rose-400" aria-hidden />
              Shown as a single checkbox. If they check it the answer is recorded as
              <span className="font-semibold"> Yes</span>, otherwise
              <span className="font-semibold"> No</span>.
            </div>
            <div className="space-y-2">
              <ConnectRow
                label="When checked"
                current={field.connectRegister?.['true']}
                currentPageId={field.connectCustomPageId?.['true']}
                onSet={(t, pageId) => setConnection('true', t, pageId)}
              />
              <OptionFilingControls
                formRegisterTo={registerTo}
                formRegisterLayer={formRegisterLayer}
                formCustomPageId={registerCustomPageId}
                formCustomLayer={registerCustomLayer}
                target={field.connectRegister?.['true']}
                customPageId={field.connectCustomPageId?.['true']}
                yardStatus={field.connectYardStatus?.['true']}
                volunteerStatus={field.connectVolunteerStatus?.['true']}
                layer={field.connectLayer?.['true'] ?? ''}
                hostType={field.connectHostType?.['true'] ?? ''}
                customLocationId={field.connectCustomLocationId?.['true']}
                customLayer={field.connectCustomLayer?.['true']}
                onYardStatus={(status) => setYardStatus('true', status)}
                onVolunteerStatus={(status) =>
                  setVolunteerStatus('true', status)
                }
                onLayer={(layer) => setOptionLayer('true', layer)}
                onHostType={(hostType) => setHostType('true', hostType)}
                onCustomLocation={(id) => setCustomLocation('true', id)}
                onCustomLayer={(key) => setCustomLayer('true', key)}
              />
            </div>
          </div>
        )}

        {field.type === 'address' && (
          <>
            <AddressPartsEditor field={field} onChange={onChange} />
            {registerTo && REGISTER_LAYERS[registerTo].length > 0 && (
              <MapLayerPicker
                registerTo={registerTo}
                value={field.registerLayer}
                onChange={(registerLayer) => onChange({ registerLayer })}
              />
            )}
          </>
        )}

        {field.type === 'location' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm text-cyan-800">
              <span className="mr-1">📍</span>
              Applicants are asked to share their location. When they allow it, their city &amp;
              region (and coordinates) are filled in automatically. They can also type a location
              manually.
            </div>
            {registerTo && REGISTER_LAYERS[registerTo].length > 0 && (
              <MapLayerPicker
                registerTo={registerTo}
                value={field.registerLayer}
                onChange={(registerLayer) => onChange({ registerLayer })}
              />
            )}
          </div>
        )}

        {field.type === 'waiver' && (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Agreement text</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                rows={4}
                value={field.waiverText ?? ''}
                onChange={(e) => onChange({ waiverText: e.target.value })}
                placeholder="Paste the terms the applicant must read and accept…"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  checked={!!field.requireSignature}
                  onChange={(e) => onChange({ requireSignature: e.target.checked })}
                />
                Require typed signature
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  checked={!!field.requireDate}
                  onChange={(e) => onChange({ requireDate: e.target.checked })}
                />
                Require date
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddressPartsEditor({
  field,
  onChange,
}: {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const selected = new Set<AddressPart>(field.addressFields ?? DEFAULT_ADDRESS_PARTS);
  const toggle = (part: AddressPart) => {
    // Rebuild in canonical order so the rendered layout stays consistent.
    const next = ADDRESS_PART_META.map((m) => m.key).filter((k) =>
      k === part ? !selected.has(k) : selected.has(k),
    );
    onChange({ addressFields: next });
  };

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
      <p className="mb-2 flex items-center gap-1 font-medium">
        <span>🏠</span> Address fields to collect
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ADDRESS_PART_META.map((m) => (
          <label key={m.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
              checked={selected.has(m.key)}
              onChange={() => toggle(m.key)}
            />
            {m.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-teal-700">
        Pick exactly what you need — e.g. just city &amp; county. State defaults to Idaho.
      </p>
    </div>
  );
}

function OptionsEditor({
  field,
  registerTo,
  formRegisterLayer,
  formCustomPageId,
  onChange,
  setOption,
  addOption,
  removeOption,
  setConnection,
  setYardStatus,
  setVolunteerStatus,
  setOptionLayer,
  setHostType,
  setCustomLocation,
  setCustomLayer,
  formCustomLayer,
}: {
  field: FormField;
  registerTo?: RegisterTarget | null;
  formRegisterLayer?: RegisterLayer | null;
  formCustomPageId?: string | null;
  onChange: (patch: Partial<FormField>) => void;
  setOption: (i: number, v: string) => void;
  addOption: () => void;
  removeOption: (i: number) => void;
  setConnection: (
    value: string,
    target: RegisterTarget | '',
    customPageId?: string | null,
  ) => void;
  setYardStatus: (value: string, status: YardSignStatus | '') => void;
  setVolunteerStatus: (
    value: string,
    status: VolunteerRegisterStatus | '',
  ) => void;
  setOptionLayer: (value: string, layer: RegisterLayer | '') => void;
  setHostType: (value: string, hostType: MeetAndGreetHostType | '') => void;
  setCustomLocation: (value: string, locationId: string | null) => void;
  setCustomLayer: (value: string, layerKey: string | null) => void;
  formCustomLayer?: string | null;
}) {
  const multi = field.type === 'radio' && field.allowMultiple;
  const indicator = multi ? 'rounded-sm' : 'rounded-full';
  const formFilesYs = registerTo === 'yard_signs';
  const formFilesMg = registerTo === 'meet_and_greets';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {field.type === 'radio' && (
        <label className="mb-3 flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
            checked={!!field.allowMultiple}
            onChange={(e) => onChange({ allowMultiple: e.target.checked })}
          />
          Allow multiple selections
        </label>
      )}

      <p className="mb-2 text-sm font-medium text-gray-700">Options</p>
      {formFilesYs && (
        <p className="mb-2 text-xs text-amber-800">
          Set yard-sign status (Requested, Installed, Removed) and size per
          answer — or file an answer onto another page.
        </p>
      )}
      {formFilesMg && (
        <p className="mb-2 text-xs text-violet-800">
          Set host type per answer (house party vs public event request). You
          can still auto-file an answer to another page too.
        </p>
      )}
      <div className="space-y-3">
        {(field.options ?? []).map((opt, i) => {
          const target = opt ? field.connectRegister?.[opt] : undefined;
          return (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/80 p-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={clsx('h-4 w-4 shrink-0 border-2 border-gray-300', indicator)}
                  aria-hidden
                />
                <input
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                <ConnectSelect
                  current={target}
                  currentPageId={field.connectCustomPageId?.[opt]}
                  disabled={!opt.trim()}
                  onSet={(t, pageId) => setConnection(opt, t, pageId)}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="rounded px-2 py-1 text-red-500 hover:bg-red-50 disabled:opacity-30"
                  disabled={(field.options ?? []).length <= 1}
                  aria-label="Remove option"
                >
                  ✕
                </button>
              </div>
              {opt.trim() && (
                <OptionFilingControls
                  formRegisterTo={registerTo}
                  formRegisterLayer={formRegisterLayer}
                  formCustomPageId={formCustomPageId}
                  formCustomLayer={formCustomLayer}
                  target={target}
                  customPageId={field.connectCustomPageId?.[opt]}
                  yardStatus={field.connectYardStatus?.[opt]}
                  volunteerStatus={field.connectVolunteerStatus?.[opt]}
                  layer={field.connectLayer?.[opt] ?? ''}
                  hostType={field.connectHostType?.[opt] ?? ''}
                  customLocationId={field.connectCustomLocationId?.[opt]}
                  customLayer={field.connectCustomLayer?.[opt]}
                  onYardStatus={(status) => setYardStatus(opt, status)}
                  onVolunteerStatus={(status) =>
                    setVolunteerStatus(opt, status)
                  }
                  onLayer={(layer) => setOptionLayer(opt, layer)}
                  onHostType={(hostType) => setHostType(opt, hostType)}
                  onCustomLocation={(id) => setCustomLocation(opt, id)}
                  onCustomLayer={(key) => setCustomLayer(opt, key)}
                />
              )}
            </div>
          );
        })}
        {field.allowOther && (
          <div className="flex items-center gap-2">
            <span className={clsx('h-4 w-4 shrink-0 border-2 border-gray-300', indicator)} aria-hidden />
            <span className="shrink-0 text-sm text-gray-500">Other:</span>
            <input
              disabled
              tabIndex={-1}
              className="min-w-0 flex-1 border-0 border-b border-dotted border-gray-400 bg-transparent px-0 py-1 text-sm text-gray-400"
            />
            <button
              type="button"
              onClick={() => onChange({ allowOther: false })}
              className="rounded px-2 py-1 text-red-500 hover:bg-red-50"
              aria-label='Remove "Other" option'
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <button type="button" onClick={addOption} className="font-medium text-blue-600 hover:text-blue-800">
          Add option
        </button>
        {!field.allowOther && (
          <>
            <span>or</span>
            <button
              type="button"
              onClick={() => onChange({ allowOther: true })}
              className="font-medium text-blue-600 hover:text-blue-800"
            >
              add &quot;Other&quot;
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Which map layer this address/location pins onto when the form auto-registers. */
function MapLayerPicker({
  registerTo,
  value,
  onChange,
}: {
  registerTo: RegisterTarget;
  value?: RegisterLayer | null;
  onChange: (layer: RegisterLayer | null) => void;
}) {
  const layers = REGISTER_LAYERS[registerTo];
  return (
    <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-indigo-800">
        Map layer
      </label>
      <select
        className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-sm text-indigo-900 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value ? (e.target.value as RegisterLayer) : null)
        }
      >
        <option value="">
          Use form default ({layers.find((l) => l.value === defaultRegisterLayer(registerTo))?.label})
        </option>
        {layers.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] leading-snug text-indigo-700">
        {registerTo === 'yard_signs'
          ? 'Little = blue dots · Big = red dots on the Yard Signs map.'
          : registerTo === 'volunteers'
            ? 'Volunteer = blue dots · County captain = amber dots on the Volunteers map.'
            : registerTo === 'post_cards'
              ? 'Writer is the default. Choose Leader only for people who should lead post carding.'
              : 'Where this pin lands on the connected page.'}
      </p>
    </div>
  );
}

/** Compact "→ Volunteers / Yard Signs" auto-register picker. */
function ConnectSelect({
  current,
  currentPageId,
  onSet,
  disabled,
}: {
  current?: RegisterTarget;
  currentPageId?: string;
  onSet: (t: RegisterTarget | '', customPageId?: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <RegisterTargetSelect
      compact
      emptyLabel="No auto-register"
      value={current ?? null}
      customPageId={currentPageId ?? null}
      disabled={disabled}
      onChange={(t, pageId) => onSet(t ?? '', pageId)}
    />
  );
}

/** A labelled auto-register row, used for single checkboxes. */
function ConnectRow({
  label,
  current,
  currentPageId,
  onSet,
}: {
  label: string;
  current?: RegisterTarget;
  currentPageId?: string;
  onSet: (t: RegisterTarget | '', customPageId?: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <span className="font-medium">{label}, register to:</span>
      <ConnectSelect
        current={current}
        currentPageId={currentPageId}
        onSet={onSet}
      />
      {current && (
        <span className="text-indigo-600">— files them automatically on submit.</span>
      )}
    </div>
  );
}
