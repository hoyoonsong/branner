// @ts-nocheck — campaign filing props are stubbed.
import { useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TriggerNodeData } from '../../../lib/conditionalFlowGraph';
import { getBlockAtPath } from '../../../lib/conditionalFlowGraph';
import { triggerUsesOptions } from '../../../lib/fieldTypes';
import {
  type MeetAndGreetHostType,
  type RegisterLayer,
  type RegisterTarget,
  type VolunteerRegisterStatus,
  type YardSignStatus,
} from '../../../lib/types';
import InlineOptionsEditor from './InlineOptionsEditor';
import { TRIGGER_TYPES, useFlowEditor } from './FlowEditorContext';
import FlowTextInput from './FlowTextInput';
import { RegisterTargetSelect } from '../RegisterTargetSelect';
import { OptionFilingControls } from '../OptionFilingControls';

export default function TriggerFlowNode({ data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  const {
    block,
    disabled,
    formRegisterTo,
    formRegisterLayer,
    formRegisterCustomPageId,
    formRegisterCustomLayer,
    onUpdateTrigger,
    onUpdateTriggerOptions,
    onRenameTriggerOption,
    onUpdateRootRequired,
    onRemoveField,
  } = useFlowEditor();

  const triggerBlock = getBlockAtPath(block, d.path);
  const isRoot = !d.path;
  const showOptions = triggerUsesOptions(triggerBlock.triggerType);
  const formFilesYs = formRegisterTo === 'yard_signs';
  const formFilesMg = formRegisterTo === 'meet_and_greets';
  const formFilesCustom = formRegisterTo === 'custom';

  // When the whole form files to Yard Signs, seed per-answer status so the
  // form-level fallback can't stamp every branch the same way.
  useEffect(() => {
    if (!formFilesYs || disabled) return;
    const map = { ...(triggerBlock.connectYardStatus ?? {}) };
    let changed = false;
    if (showOptions) {
      for (const opt of triggerBlock.options ?? []) {
        if (!opt.trim() || map[opt]) continue;
        map[opt] = 'requested';
        changed = true;
      }
    } else if (triggerBlock.triggerType === 'checkbox' && !map.true) {
      map.true = 'requested';
      changed = true;
    }
    if (changed) onUpdateTrigger(d.path, { connectYardStatus: map });
  }, [
    formFilesYs,
    disabled,
    showOptions,
    triggerBlock.triggerType,
    triggerBlock.options,
    triggerBlock.connectYardStatus,
    d.path,
    onUpdateTrigger,
  ]);

  const setConnection = (
    value: string,
    target: RegisterTarget | '',
    customPageId?: string | null,
  ) => {
    const map = { ...(triggerBlock.connectRegister ?? {}) };
    const statusMap = { ...(triggerBlock.connectYardStatus ?? {}) };
    const volMap = { ...(triggerBlock.connectVolunteerStatus ?? {}) };
    const layerMap = { ...(triggerBlock.connectLayer ?? {}) };
    const hostMap = { ...(triggerBlock.connectHostType ?? {}) };
    const customMap = { ...(triggerBlock.connectCustomPageId ?? {}) };
    const locMap = { ...(triggerBlock.connectCustomLocationId ?? {}) };
    const customLayerMap = { ...(triggerBlock.connectCustomLayer ?? {}) };
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
      if (target !== 'meet_and_greets' && !formFilesMg) {
        delete hostMap[value];
      }
    } else {
      delete map[value];
      // Keep extras when the form already files everyone to that page.
      if (!formFilesYs) {
        delete statusMap[value];
        delete layerMap[value];
      }
      delete volMap[value];
      if (!formFilesMg) {
        delete hostMap[value];
      }
      delete customMap[value];
      if (!formFilesCustom) {
        delete locMap[value];
        delete customLayerMap[value];
      }
    }
    onUpdateTrigger(d.path, {
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

  const setYardStatus = (value: string, status: YardSignStatus) => {
    const map = { ...(triggerBlock.connectYardStatus ?? {}) };
    map[value] = status;
    onUpdateTrigger(d.path, { connectYardStatus: map });
  };

  const setVolunteerStatus = (
    value: string,
    status: VolunteerRegisterStatus,
  ) => {
    const map = { ...(triggerBlock.connectVolunteerStatus ?? {}) };
    map[value] = status;
    onUpdateTrigger(d.path, { connectVolunteerStatus: map });
  };

  const setOptionLayer = (value: string, layer: RegisterLayer | '') => {
    const map = { ...(triggerBlock.connectLayer ?? {}) };
    if (layer) map[value] = layer;
    else delete map[value];
    onUpdateTrigger(d.path, {
      connectLayer: Object.keys(map).length ? map : undefined,
    });
  };

  const setHostType = (value: string, hostType: MeetAndGreetHostType | '') => {
    const map = { ...(triggerBlock.connectHostType ?? {}) };
    if (hostType) map[value] = hostType;
    else delete map[value];
    onUpdateTrigger(d.path, {
      connectHostType: Object.keys(map).length ? map : undefined,
    });
  };

  const setCustomLocation = (value: string, locationId: string | null) => {
    const map = { ...(triggerBlock.connectCustomLocationId ?? {}) };
    if (locationId) map[value] = locationId;
    else delete map[value];
    onUpdateTrigger(d.path, {
      connectCustomLocationId: Object.keys(map).length ? map : undefined,
    });
  };

  const setCustomLayer = (value: string, layerKey: string | null) => {
    const map = { ...(triggerBlock.connectCustomLayer ?? {}) };
    if (layerKey) map[value] = layerKey;
    else delete map[value];
    onUpdateTrigger(d.path, {
      connectCustomLayer: Object.keys(map).length ? map : undefined,
    });
  };

  const filingFor = (value: string) => (
    <OptionFilingControls
      compact
      disabled={disabled}
      formRegisterTo={formRegisterTo}
      formRegisterLayer={formRegisterLayer}
      formCustomPageId={formRegisterCustomPageId}
      formCustomLayer={formRegisterCustomLayer}
      target={triggerBlock.connectRegister?.[value]}
      customPageId={triggerBlock.connectCustomPageId?.[value]}
      yardStatus={triggerBlock.connectYardStatus?.[value]}
      volunteerStatus={triggerBlock.connectVolunteerStatus?.[value]}
      layer={triggerBlock.connectLayer?.[value] ?? ''}
      hostType={triggerBlock.connectHostType?.[value] ?? ''}
      customLocationId={triggerBlock.connectCustomLocationId?.[value]}
      customLayer={triggerBlock.connectCustomLayer?.[value]}
      onYardStatus={(status) => setYardStatus(value, status)}
      onVolunteerStatus={(status) => setVolunteerStatus(value, status)}
      onLayer={(layer) => setOptionLayer(value, layer)}
      onHostType={(hostType) => setHostType(value, hostType)}
      onCustomLocation={(id) => setCustomLocation(value, id)}
      onCustomLayer={(key) => setCustomLayer(value, key)}
    />
  );

  return (
    <div
      className={`w-[300px] cursor-grab rounded-lg border-2 bg-indigo-50 px-3 py-2.5 shadow-sm active:cursor-grabbing ${
        selected ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-indigo-400'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-500" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">
          If / Then
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-gray-600">
            <input
              type="checkbox"
              checked={!!triggerBlock.required}
              onChange={(e) => {
                if (isRoot) onUpdateRootRequired(e.target.checked);
                else onUpdateTrigger(d.path, { required: e.target.checked });
              }}
              disabled={disabled}
              className="nodrag h-3 w-3 rounded text-indigo-600"
            />
            Required
          </label>
          {!isRoot && (
            <button
              type="button"
              onClick={() => onRemoveField(d.path)}
              disabled={disabled}
              className="nodrag text-[10px] text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <FlowTextInput
        value={triggerBlock.label}
        onChange={(label) => onUpdateTrigger(d.path, { label })}
        disabled={disabled}
        placeholder="e.g. Requesting a yard sign, or reporting its location?"
        className="mt-2 w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm font-medium text-gray-900"
      />

      <select
        value={triggerBlock.triggerType}
        onChange={(e) =>
          onUpdateTrigger(d.path, {
            triggerType: e.target.value as typeof triggerBlock.triggerType,
          })
        }
        onKeyDown={(e) => e.stopPropagation()}
        disabled={disabled}
        className="nodrag nopan mt-2 w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
      >
        {TRIGGER_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {showOptions && (
        <>
          <InlineOptionsEditor
            options={triggerBlock.options ?? []}
            onChange={(options) => onUpdateTriggerOptions(d.path, options)}
            onRename={(index, label) => onRenameTriggerOption(d.path, index, label)}
            disabled={disabled}
            minOptions={1}
          />
          <div className="mt-2 space-y-1.5">
            <p className="text-[10px] font-medium text-gray-500">
              File each answer as…
            </p>
            {(triggerBlock.options ?? []).map((opt) => {
              if (!opt.trim()) return null;
              const target = triggerBlock.connectRegister?.[opt];
              return (
                <div
                  key={opt}
                  className="nodrag nopan rounded border border-indigo-100 bg-white/80 px-1.5 py-1"
                >
                  <p className="truncate text-[10px] font-medium text-gray-700">
                    {opt}
                  </p>
                  <div className="nodrag nopan mt-0.5">
                    <RegisterTargetSelect
                      compact
                      emptyLabel="Don't auto-file"
                      value={target ?? null}
                      customPageId={triggerBlock.connectCustomPageId?.[opt] ?? null}
                      disabled={disabled}
                      onChange={(t, pageId) =>
                        setConnection(opt, t ?? '', pageId)
                      }
                    />
                  </div>
                  {filingFor(opt)}
                </div>
              );
            })}
          </div>
        </>
      )}

      {triggerBlock.triggerType === 'checkbox' && (
        <>
          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
            Follow-ups show when applicant answers Yes.
          </p>
          <div className="nodrag nopan mt-1.5 rounded border border-indigo-100 bg-white/80 px-1.5 py-1">
            <p className="text-[10px] font-medium text-gray-700">
              When Yes, file as…
            </p>
            <RegisterTargetSelect
              compact
              emptyLabel="Don't auto-file"
              value={triggerBlock.connectRegister?.['true'] ?? null}
              customPageId={triggerBlock.connectCustomPageId?.['true'] ?? null}
              disabled={disabled}
              onChange={(t, pageId) =>
                setConnection('true', t ?? '', pageId)
              }
            />
            {filingFor('true')}
          </div>
        </>
      )}

      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
    </div>
  );
}
