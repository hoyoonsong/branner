import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FieldNodeData } from '../../../lib/conditionalFlowGraph';
import { FLOW_WAIVER_NODE_WIDTH } from '../../../lib/conditionalFlowGraph';
import type { StandardAppItem } from '../../../types/application';
import { usesOptionsField } from '../../../lib/fieldTypes';
import { FIELD_TYPES, stopFlowPointer, useFlowEditor } from './FlowEditorContext';
import InlineFieldOptionsEditor from './InlineFieldOptionsEditor';
import FlowTextInput from './FlowTextInput';
import FlowFollowUpAddButton from './FlowFollowUpAddButton';
import { RichTextEditor } from '../../RichTextEditor';
import { richTextToPlain, sanitizeHref } from '../../../lib/richtext';

export default function FieldFlowNode({ data, selected }: NodeProps) {
  const d = data as FieldNodeData;
  const field = d.field as StandardAppItem;
  const { disabled, onUpdateField, onChangeFieldType, onRemoveField } = useFlowEditor();

  const hasOptions = usesOptionsField(field.type);

  return (
    <div
      className={`cursor-grab rounded-lg border bg-white px-3 py-2.5 shadow-sm active:cursor-grabbing ${
        selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200'
      }`}
      style={field.type === 'waiver' ? { width: FLOW_WAIVER_NODE_WIDTH } : { width: 280 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />

      <div className="flex items-center justify-between gap-2">
        <select
          value={field.type}
          onChange={(e) => onChangeFieldType(d.path, e.target.value as StandardAppItem['type'])}
          onKeyDown={(e) => e.stopPropagation()}
          disabled={disabled}
          className="nodrag nopan max-w-[140px] rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-700"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          {field.type !== 'section' && (
            <label className="flex items-center gap-1 text-[10px] text-gray-600">
              <input
                type="checkbox"
                checked={!!field.required}
                onChange={(e) => onUpdateField(d.path, { required: e.target.checked })}
                disabled={disabled}
                className="nodrag h-3 w-3 rounded text-indigo-600"
              />
              Req.
            </label>
          )}
          <button
            type="button"
            onClick={() => onRemoveField(d.path)}
            disabled={disabled}
            className="nodrag text-[10px] text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      {field.type === 'section' ? (
        <div className="mt-2 space-y-2" onPointerDown={stopFlowPointer}>
          <RichTextEditor
            dense
            value={field.richText ?? field.label ?? ''}
            onChange={(html) =>
              onUpdateField(d.path, { richText: html, label: richTextToPlain(html) })
            }
            disabled={disabled}
            placeholder="Statement or heading — add a link with 🔗"
            ariaLabel="Section statement"
          />
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-gray-600">
              Embed page (optional)
            </label>
            <input
              type="url"
              value={field.embedUrl ?? ''}
              onChange={(e) =>
                onUpdateField(d.path, {
                  embedUrl: e.target.value.trim()
                    ? sanitizeHref(e.target.value)
                    : undefined,
                })
              }
              onKeyDown={(e) => e.stopPropagation()}
              disabled={disabled}
              placeholder="https://… donate / external form"
              className="nodrag nopan nowheel w-full rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-950"
            />
            <p className="mt-0.5 text-[9px] leading-snug text-gray-500">
              Shows an in-page frame so people don&apos;t leave this form.
            </p>
          </div>
        </div>
      ) : (
        <FlowTextInput
          value={field.label}
          onChange={(label) => onUpdateField(d.path, { label })}
          disabled={disabled}
          placeholder={'Question...'}
          className="mt-2 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800"
        />
      )}

      {hasOptions && (
        <InlineFieldOptionsEditor
          options={
            field.type === 'select' || field.type === 'multiple_choice'
              ? (field.options ?? [])
              : []
          }
          onChange={(options) => onUpdateField(d.path, { options })}
          disabled={disabled}
          showMultipleChoiceSettings={field.type === 'multiple_choice'}
          allowMultiple={field.type === 'multiple_choice' ? !!field.allowMultiple : false}
          allowOther={field.type === 'multiple_choice' ? !!field.allowOther : false}
          onAllowMultipleChange={
            field.type === 'multiple_choice'
              ? (allowMultiple) => onUpdateField(d.path, { allowMultiple })
              : undefined
          }
          onAllowOtherChange={
            field.type === 'multiple_choice'
              ? (allowOther) => onUpdateField(d.path, { allowOther })
              : undefined
          }
        />
      )}

      {field.type === 'file' && (
        <label className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-600">
          <input
            type="checkbox"
            checked={field.allowLink !== false}
            onChange={(e) => onUpdateField(d.path, { allowLink: e.target.checked })}
            disabled={disabled}
            className="nodrag h-3 w-3 rounded text-indigo-600"
          />
          Allow URL link
        </label>
      )}

      {field.type === 'long_text' && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-600">
          <span>Max words:</span>
          <input
            type="number"
            value={field.maxWords ?? ''}
            onChange={(e) =>
              onUpdateField(d.path, {
                maxWords: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            disabled={disabled}
            className="nodrag w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
          />
        </div>
      )}

      {field.type === 'waiver' && (
        <div className="mt-2 space-y-2" onPointerDown={stopFlowPointer}>
          <textarea
            value={field.waiverText ?? ''}
            onChange={(e) => onUpdateField(d.path, { waiverText: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            disabled={disabled}
            rows={3}
            placeholder="Agreement text the applicant must accept…"
            className="nodrag nopan nowheel w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800"
          />
          <div className="flex flex-wrap gap-3 text-[10px] text-gray-600">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!field.requireSignature}
                onChange={(e) => onUpdateField(d.path, { requireSignature: e.target.checked })}
                disabled={disabled}
                className="nodrag h-3 w-3 rounded text-indigo-600"
              />
              Signature
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!field.requireDate}
                onChange={(e) => onUpdateField(d.path, { requireDate: e.target.checked })}
                disabled={disabled}
                className="nodrag h-3 w-3 rounded text-indigo-600"
              />
              Date
            </label>
          </div>
        </div>
      )}

      {d.addFollowUpBranchPath && (
        <FlowFollowUpAddButton branchPath={d.addFollowUpBranchPath} disabled={disabled} />
      )}

      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  );
}
