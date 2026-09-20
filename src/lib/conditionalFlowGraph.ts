import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { AppItem, ConditionalBlock, StandardAppItem } from '../types/application';
import {
  createConditionalBlock,
  createNestedField,
  isConditionalBlock,
  normalizeConditionalBlock,
  renameConditionalOption,
  syncConditionalBranches,
} from './conditionalFields';
import { triggerUsesOptions, usesOptionsField } from './fieldTypes';

export type FlowNodeKind = 'trigger' | 'field' | 'addField';

export type TriggerNodeData = {
  kind: 'trigger';
  path: string;
  blockKey: string;
  label: string;
  triggerType: ConditionalBlock['triggerType'];
  optionCount: number;
  addFollowUpBranchPath?: string;
  selected?: boolean;
};

export type FieldNodeData = {
  kind: 'field';
  path: string;
  field: AppItem;
  addFollowUpBranchPath?: string;
  selected?: boolean;
};

export type AddFieldNodeData = {
  kind: 'addField';
  path: string;
  branchWhen: string;
  compact?: boolean;
  selected?: boolean;
};

export type FlowNodeData = TriggerNodeData | FieldNodeData | AddFieldNodeData;

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

const NODE_WIDTH = 280;
const WAIVER_NODE_WIDTH = 320;
const NODE_BASE_HEIGHT = 100;
const TRIGGER_BASE_HEIGHT = 130;
const ADD_HEIGHT = 72;
const ADD_COMPACT_SIZE = 40;

export const FLOW_WAIVER_NODE_WIDTH = WAIVER_NODE_WIDTH;

function optionsOf(field: AppItem): string[] {
  if (field.type === 'select' || field.type === 'multiple_choice') return field.options ?? [];
  return [];
}

function estimateTriggerHeight(block: ConditionalBlock): number {
  let h = TRIGGER_BASE_HEIGHT;
  if (triggerUsesOptions(block.triggerType)) {
    h += (block.options ?? []).length * 36 + 48;
  }
  if (block.triggerType === 'checkbox') h += 32;
  return h + 32;
}

function estimateFieldHeight(field: AppItem): number {
  if (isConditionalBlock(field)) return TRIGGER_BASE_HEIGHT + 32;
  let h = NODE_BASE_HEIGHT;
  const std = field as StandardAppItem;
  if (usesOptionsField(std.type)) {
    h += optionsOf(field).length * 32 + 44;
  }
  if (std.type === 'file') h += 28;
  if (std.type === 'long_text') h += 32;
  if (std.type === 'waiver') return 220;
  return h + 28;
}

function fieldNodeWidth(field: AppItem): number {
  if (isConditionalBlock(field)) return NODE_WIDTH;
  return field.type === 'waiver' ? WAIVER_NODE_WIDTH : NODE_WIDTH;
}

function encodeBranch(whenValue: string): string {
  return encodeURIComponent(whenValue);
}

function decodeBranch(encoded: string): string {
  return decodeURIComponent(encoded);
}

export function triggerNodeId(blockKey: string, pathPrefix: string): string {
  return pathPrefix ? `${pathPrefix}/trigger` : `trigger:${blockKey}`;
}

export function parseNodeId(nodeId: string): { kind: FlowNodeKind; path: string } {
  if (nodeId.startsWith('trigger:')) return { kind: 'trigger', path: '' };
  if (nodeId.endsWith('/trigger')) {
    return { kind: 'trigger', path: nodeId.slice(0, -'/trigger'.length) };
  }
  if (nodeId.endsWith('/add')) {
    return { kind: 'addField', path: nodeId.slice(0, -'/add'.length) };
  }
  return { kind: 'field', path: nodeId };
}

export function branchPath(parentPath: string, whenValue: string): string {
  const segment = `b:${encodeBranch(whenValue)}`;
  return parentPath ? `${parentPath}/${segment}` : segment;
}

export function fieldNodeId(branchPathStr: string, index: number): string {
  return `${branchPathStr}/f:${index}`;
}

function collectDescendantIds(startId: string, edges: FlowEdge[]): Set<string> {
  const visited = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === id && !visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return visited;
}

function nodeHeight(node: FlowNode): number {
  return (node.style?.height as number) ?? NODE_BASE_HEIGHT;
}

/** Dagre LR layout often reverses sibling branch order — restore options top-to-bottom */
function reorderBranchesTopToBottom(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const nodeById = new Map(nodes.map((n) => [n.id, { ...n, position: { ...n.position } }]));
  const triggers = nodes.filter((n) => n.type === 'trigger');

  for (const trigger of triggers) {
    const branchEdges = edges.filter(
      (e) =>
        e.source === trigger.id &&
        e.label &&
        typeof (e.data as { branchIndex?: number } | undefined)?.branchIndex === 'number',
    );
    if (branchEdges.length <= 1) continue;

    const subgraphs = branchEdges.map((edge) => {
      const branchIndex = (edge.data as { branchIndex: number }).branchIndex;
      const nodeIds = collectDescendantIds(edge.target, edges);
      const anchor = nodeById.get(edge.target);
      const anchorY = anchor ? anchor.position.y + nodeHeight(anchor) / 2 : 0;
      return { branchIndex, nodeIds, anchorY };
    });

    subgraphs.sort((a, b) => a.branchIndex - b.branchIndex);
    const targetYs = subgraphs.map((s) => s.anchorY).sort((a, b) => a - b);

    subgraphs.forEach((sg, i) => {
      const delta = targetYs[i] - sg.anchorY;
      if (Math.abs(delta) < 1) return;
      for (const id of sg.nodeIds) {
        const node = nodeById.get(id);
        if (node) node.position = { ...node.position, y: node.position.y + delta };
      }
    });
  }

  return Array.from(nodeById.values());
}

function stripLabelHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim() || 'Untitled question';
}

function editableBranches(block: ConditionalBlock) {
  if (block.triggerType === 'checkbox') {
    return (block.branches ?? []).filter((b) => b.whenValue === 'true');
  }
  return block.branches ?? [];
}

function branchLabel(block: ConditionalBlock, whenValue: string): string {
  if (block.triggerType === 'checkbox') return whenValue === 'true' ? 'Yes' : 'No';
  return whenValue;
}

const EDGE_STYLE = {
  type: 'smoothstep' as const,
  style: { stroke: '#6366f1', strokeWidth: 2 },
  labelStyle: { fill: '#4338ca', fontWeight: 600, fontSize: 11 },
  labelBgStyle: { fill: '#eef2ff', fillOpacity: 0.95 },
  labelBgPadding: [6, 4] as [number, number],
  labelBgBorderRadius: 4,
};

function emitBlockGraph(
  block: ConditionalBlock,
  pathPrefix: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): void {
  const normalized = normalizeConditionalBlock(block);
  const blockKey = normalized.key ?? 'conditional';
  const triggerId = triggerNodeId(blockKey, pathPrefix);

  const optionCount =
    normalized.triggerType === 'checkbox' ? 2 : (normalized.options ?? []).length;

  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: 0, y: 0 },
    data: {
      kind: 'trigger',
      path: pathPrefix,
      blockKey,
      label: stripLabelHtml(normalized.label),
      triggerType: normalized.triggerType,
      optionCount,
    },
    style: { width: NODE_WIDTH, height: estimateTriggerHeight(normalized) },
  });

  const branches = editableBranches(normalized);
  for (let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
    const branch = branches[branchIndex];
    const whenValue = branch.whenValue;
    const bPath = branchPath(pathPrefix, whenValue);
    const fields = branch.fields ?? [];
    let prevId = triggerId;
    let isFirst = true;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const fPath = fieldNodeId(bPath, i);
      const fId = fPath;
      const isLastInBranch = i === fields.length - 1;

      if (isConditionalBlock(field)) {
        const nested = normalizeConditionalBlock(field);
        const nestedTriggerId = triggerNodeId(nested.key ?? `nested-${i}`, fPath);
        edges.push({
          id: `e:${prevId}->${nestedTriggerId}`,
          source: prevId,
          target: nestedTriggerId,
          label: isFirst ? branchLabel(normalized, whenValue) : undefined,
          data: isFirst ? { branchIndex } : undefined,
          ...EDGE_STYLE,
        });
        emitBlockGraph(nested, fPath, nodes, edges);
        const nestedNode = nodes.find((n) => n.id === nestedTriggerId);
        if (nestedNode?.type === 'trigger' && isLastInBranch) {
          nestedNode.data = {
            ...(nestedNode.data as TriggerNodeData),
            addFollowUpBranchPath: bPath,
          };
        }
        prevId = nestedTriggerId;
      } else {
        nodes.push({
          id: fId,
          type: 'field',
          position: { x: 0, y: 0 },
          data: {
            kind: 'field',
            path: fPath,
            field,
            addFollowUpBranchPath: isLastInBranch ? bPath : undefined,
          },
          style: { width: fieldNodeWidth(field), height: estimateFieldHeight(field) },
        });
        edges.push({
          id: `e:${prevId}->${fId}`,
          source: prevId,
          target: fId,
          label: isFirst ? branchLabel(normalized, whenValue) : undefined,
          data: isFirst ? { branchIndex } : undefined,
          ...EDGE_STYLE,
        });
        prevId = fId;
      }
      isFirst = false;
    }

    if (fields.length === 0) {
      const addId = `${bPath}/add`;
      nodes.push({
        id: addId,
        type: 'addField',
        position: { x: 0, y: 0 },
        data: { kind: 'addField', path: bPath, branchWhen: whenValue, compact: true },
        style: { width: ADD_COMPACT_SIZE, height: ADD_COMPACT_SIZE },
      });
      edges.push({
        id: `e:${prevId}->${addId}`,
        source: prevId,
        target: addId,
        label: branchLabel(normalized, whenValue),
        data: { branchIndex },
        ...EDGE_STYLE,
      });
    }
  }
}

export function blockToFlow(block: ConditionalBlock): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  emitBlockGraph(block, '', nodes, edges);
  return { nodes, edges };
}

export function layoutFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: 'LR' | 'TB' = 'LR',
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 120,
    ranksep: 240,
    marginx: 48,
    marginy: 48,
    edgesep: 40,
  });

  const sizeOf = (node: FlowNode) => {
    const isCompactAdd =
      node.type === 'addField' && (node.data as AddFieldNodeData).compact === true;
    const width = isCompactAdd ? ADD_COMPACT_SIZE : ((node.style?.width as number) ?? NODE_WIDTH);
    const height = isCompactAdd
      ? ADD_COMPACT_SIZE
      : ((node.style?.height as number) ??
        (node.type === 'addField'
          ? ADD_HEIGHT
          : node.type === 'trigger'
            ? TRIGGER_BASE_HEIGHT
            : NODE_BASE_HEIGHT));
    return { width, height };
  };

  nodes.forEach((node) => g.setNode(node.id, sizeOf(node)));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    const { width, height } = sizeOf(node);
    return { ...node, position: { x: pos.x - width / 2, y: pos.y - height / 2 } };
  });

  return { nodes: reorderBranchesTopToBottom(layoutedNodes, edges), edges };
}

export function countFollowUpFields(block: ConditionalBlock): number {
  let count = 0;
  function walk(fields: AppItem[]) {
    for (const field of fields) {
      if (isConditionalBlock(field)) {
        for (const branch of field.branches ?? []) walk(branch.fields ?? []);
      } else {
        count += 1;
      }
    }
  }
  for (const branch of block.branches ?? []) walk(branch.fields ?? []);
  return count;
}

export function countBranches(block: ConditionalBlock): number {
  if (block.triggerType === 'checkbox') return 2;
  return (block.options ?? []).length;
}

type PathSegment = { type: 'branch'; when: string } | { type: 'field'; index: number };

function parsePath(path: string): PathSegment[] {
  if (!path) return [];
  const segments: PathSegment[] = [];
  for (const part of path.split('/').filter(Boolean)) {
    if (part.startsWith('b:')) {
      segments.push({ type: 'branch', when: decodeBranch(part.slice(2)) });
    } else if (part.startsWith('f:')) {
      segments.push({ type: 'field', index: Number(part.slice(2)) });
    }
  }
  return segments;
}

function getFieldsAtBranchPath(block: ConditionalBlock, branchPathStr: string): AppItem[] {
  const segments = parsePath(branchPathStr);
  let current = normalizeConditionalBlock(block);
  let fields: AppItem[] = [];

  for (const seg of segments) {
    if (seg.type === 'branch') {
      const branch = (current.branches ?? []).find((b) => b.whenValue === seg.when);
      fields = [...(branch?.fields ?? [])];
    } else if (seg.type === 'field') {
      if (seg.index < 0 || seg.index >= fields.length) return [];
      const field = fields[seg.index];
      if (!isConditionalBlock(field)) return [];
      current = normalizeConditionalBlock(field);
      fields = [];
    }
  }
  return fields;
}

function setBranchFields(
  root: ConditionalBlock,
  branchPathStr: string,
  newFields: AppItem[],
): ConditionalBlock {
  const segments = parsePath(branchPathStr);

  function apply(block: ConditionalBlock, segIdx: number): ConditionalBlock {
    const current = normalizeConditionalBlock(block);
    if (segIdx >= segments.length) return current;

    const seg = segments[segIdx];
    if (seg.type !== 'branch') return current;

    if (segIdx === segments.length - 1) {
      if (current.triggerType === 'checkbox') {
        return normalizeConditionalBlock({
          ...current,
          branches: (current.branches ?? []).map((b) =>
            b.whenValue === 'true'
              ? { ...b, fields: newFields }
              : { whenValue: 'false', fields: [] },
          ),
        });
      }
      return normalizeConditionalBlock({
        ...current,
        branches: (current.branches ?? []).map((b) =>
          b.whenValue === seg.when ? { ...b, fields: newFields } : b,
        ),
      });
    }

    const branch = (current.branches ?? []).find((b) => b.whenValue === seg.when);
    const fields = [...(branch?.fields ?? [])];
    const nextSeg = segments[segIdx + 1];
    if (nextSeg?.type !== 'field') return current;
    if (nextSeg.index < 0 || nextSeg.index >= fields.length) return current;

    const field = fields[nextSeg.index];
    if (!isConditionalBlock(field)) return current;

    fields[nextSeg.index] = apply(field, segIdx + 2);
    return normalizeConditionalBlock({
      ...current,
      branches: (current.branches ?? []).map((b) =>
        b.whenValue === seg.when ? { ...b, fields } : b,
      ),
    });
  }

  return apply(root, 0);
}

export function getBlockAtPath(root: ConditionalBlock, path: string): ConditionalBlock {
  if (!path) return normalizeConditionalBlock(root);
  const located = getFieldAtPath(root, path);
  if (located && isConditionalBlock(located.field)) {
    return normalizeConditionalBlock(located.field);
  }
  return normalizeConditionalBlock(root);
}

export function getFieldAtPath(
  root: ConditionalBlock,
  path: string,
): { block: ConditionalBlock; branchPath: string; fieldIndex: number; field: AppItem } | null {
  const segments = parsePath(path);
  if (segments.length === 0) return null;

  let current = normalizeConditionalBlock(root);
  let fields: AppItem[] = [];
  let branchPathAcc = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type === 'branch') {
      branchPathAcc = branchPathAcc
        ? `${branchPathAcc}/b:${encodeBranch(seg.when)}`
        : `b:${encodeBranch(seg.when)}`;
      const branch = (current.branches ?? []).find((b) => b.whenValue === seg.when);
      fields = [...(branch?.fields ?? [])];
      continue;
    }
    if (seg.type === 'field') {
      if (seg.index < 0 || seg.index >= fields.length) return null;
      if (i === segments.length - 1) {
        return {
          block: current,
          branchPath: branchPathAcc,
          fieldIndex: seg.index,
          field: fields[seg.index],
        };
      }
      const field = fields[seg.index];
      if (!isConditionalBlock(field)) return null;
      current = normalizeConditionalBlock(field);
      fields = [];
      branchPathAcc = `${branchPathAcc}/f:${seg.index}`;
    }
  }
  return null;
}

export function addFieldAtBranch(
  root: ConditionalBlock,
  branchPathStr: string,
  type: StandardAppItem['type'],
): ConditionalBlock {
  const fields = getFieldsAtBranchPath(root, branchPathStr);
  return setBranchFields(root, branchPathStr, [...fields, createNestedField(type)]);
}

export function addConditionalAtBranch(
  root: ConditionalBlock,
  branchPathStr: string,
): ConditionalBlock {
  const fields = getFieldsAtBranchPath(root, branchPathStr);
  return setBranchFields(root, branchPathStr, [...fields, createConditionalBlock()]);
}

export function removeFieldAtPath(root: ConditionalBlock, fieldPath: string): ConditionalBlock {
  const located = getFieldAtPath(root, fieldPath);
  if (!located) return root;
  const fields = getFieldsAtBranchPath(root, located.branchPath);
  const next = fields.filter((_, i) => i !== located.fieldIndex);
  return setBranchFields(root, located.branchPath, next);
}

export function updateFieldAtPath(
  root: ConditionalBlock,
  fieldPath: string,
  updates: Partial<AppItem>,
): ConditionalBlock {
  const located = getFieldAtPath(root, fieldPath);
  if (!located) return root;
  const fields = getFieldsAtBranchPath(root, located.branchPath);
  const next = fields.map((f, i) =>
    i === located.fieldIndex ? ({ ...f, ...updates } as AppItem) : f,
  );
  return setBranchFields(root, located.branchPath, next);
}

export function changeFieldTypeAtPath(
  root: ConditionalBlock,
  fieldPath: string,
  newType: StandardAppItem['type'],
): ConditionalBlock {
  const located = getFieldAtPath(root, fieldPath);
  if (!located || isConditionalBlock(located.field)) return root;
  const existing = located.field as StandardAppItem;
  const replacement = createNestedField(newType);
  const merged = {
    ...replacement,
    key: existing.key,
    label: existing.label,
    required: 'required' in existing ? existing.required : false,
  } as StandardAppItem;
  return updateFieldAtPath(root, fieldPath, merged);
}

export function updateTriggerAtPath(
  root: ConditionalBlock,
  path: string,
  updates: Partial<ConditionalBlock>,
): ConditionalBlock {
  if (!path) {
    return normalizeConditionalBlock({ ...root, ...updates, type: 'conditional' });
  }

  const located = getFieldAtPath(root, path);
  if (!located || !isConditionalBlock(located.field)) return root;

  const updated = normalizeConditionalBlock({
    ...located.field,
    ...updates,
    type: 'conditional',
  });

  const fields = getFieldsAtBranchPath(root, located.branchPath);
  const next = fields.map((f, i) => (i === located.fieldIndex ? updated : f));
  return setBranchFields(root, located.branchPath, next);
}

export function renameTriggerOptionAtPath(
  root: ConditionalBlock,
  path: string,
  index: number,
  newLabel: string,
): ConditionalBlock {
  const trimmed = newLabel.trim();
  if (!trimmed) return root;
  const block = getBlockAtPath(root, path);
  const updated = renameConditionalOption(block, index, trimmed);
  return updateTriggerAtPath(root, path, updated);
}

export function updateTriggerOptions(
  root: ConditionalBlock,
  path: string,
  nextOptions: string[],
): ConditionalBlock {
  const block = getBlockAtPath(root, path);
  const keep = new Set(nextOptions);
  const prune = <T,>(map: Partial<Record<string, T>> | undefined) => {
    if (!map) return undefined;
    const next: Partial<Record<string, T>> = {};
    for (const [k, v] of Object.entries(map)) {
      if (keep.has(k) && v !== undefined) next[k] = v as T;
    }
    return Object.keys(next).length ? next : undefined;
  };
  const updated = normalizeConditionalBlock({
    ...block,
    options: nextOptions,
    branches: syncConditionalBranches(block, nextOptions),
    connectRegister: prune(block.connectRegister) as ConditionalBlock['connectRegister'],
    connectYardStatus: prune(block.connectYardStatus),
    connectLayer: prune(block.connectLayer),
    connectHostType: prune(block.connectHostType),
    connectCustomPageId: prune(block.connectCustomPageId) as ConditionalBlock['connectCustomPageId'],
    connectCustomLocationId: prune(
      block.connectCustomLocationId,
    ) as ConditionalBlock['connectCustomLocationId'],
    connectCustomLayer: prune(
      block.connectCustomLayer,
    ) as ConditionalBlock['connectCustomLayer'],
  });
  return updateTriggerAtPath(root, path, updated);
}

export function triggerTypeLabel(type: ConditionalBlock['triggerType']): string {
  switch (type) {
    case 'select':
      return 'Dropdown';
    case 'multiple_choice':
      return 'Multiple Choice';
    case 'checkbox':
      return 'Yes / No';
    default:
      return type;
  }
}

export { decodeBranch };
