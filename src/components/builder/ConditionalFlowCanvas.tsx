import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ConditionalBlock } from '../../types/application';
import {
  blockToFlow,
  layoutFlow,
  parseNodeId,
  type FlowEdge,
  type FlowNode,
} from '../../lib/conditionalFlowGraph';
import TriggerFlowNode from './flow/TriggerFlowNode';
import FieldFlowNode from './flow/FieldFlowNode';
import AddFieldFlowNode from './flow/AddFieldFlowNode';
import { FlowEditorContext, type FlowEditorContextValue } from './flow/FlowEditorContext';

const nodeTypes = {
  trigger: TriggerFlowNode,
  field: FieldFlowNode,
  addField: AddFieldFlowNode,
};

function computeLayout(block: ConditionalBlock) {
  const flow = blockToFlow(block);
  return layoutFlow(flow.nodes, flow.edges, 'LR');
}

function nodeStructureKey(nodes: FlowNode[]): string {
  return nodes.map((n) => n.id).join('|');
}

function mergePositions(
  laid: FlowNode[],
  saved: Map<string, { x: number; y: number }>,
): FlowNode[] {
  return laid.map((node) => {
    const savedPos = saved.get(node.id);
    if (!savedPos) return node;
    return { ...node, position: savedPos };
  });
}

const noop = () => {};

function readOnlyContext(block: ConditionalBlock): FlowEditorContextValue {
  return {
    block,
    disabled: true,
    onUpdateTrigger: noop,
    onUpdateTriggerOptions: noop,
    onRenameTriggerOption: noop,
    onUpdateField: noop,
    onChangeFieldType: noop,
    onRemoveField: noop,
    onUpdateRootRequired: noop,
    onAddFollowUp: noop,
  };
}

type ConditionalFlowCanvasProps = {
  block: ConditionalBlock;
  readOnly?: boolean;
  contextValue?: FlowEditorContextValue;
  onAddFieldClick?: (branchPath: string) => void;
  layoutResetToken?: number;
  className?: string;
  showControls?: boolean;
  fitPadding?: number;
};

export default function ConditionalFlowCanvas({
  block,
  readOnly = false,
  contextValue,
  onAddFieldClick,
  layoutResetToken = 0,
  className = 'h-full min-h-[420px]',
  showControls = true,
  fitPadding = 0.25,
}: ConditionalFlowCanvasProps) {
  const fitViewRef = useRef<
    ((opts?: {
      padding?: number;
      duration?: number;
      minZoom?: number;
      maxZoom?: number;
    }) => void) | null
  >(null);
  const savedPositions = useRef(new Map<string, { x: number; y: number }>());
  const prevResetToken = useRef(layoutResetToken);
  const prevStructureKey = useRef('');
  const isFirstLayout = useRef(true);

  const baseLayout = useMemo(() => computeLayout(block), [block]);
  const editorContext = useMemo(
    () => contextValue ?? readOnlyContext(block),
    [contextValue, block],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  useEffect(() => {
    const forceReset = layoutResetToken !== prevResetToken.current;
    if (forceReset) {
      savedPositions.current.clear();
      prevResetToken.current = layoutResetToken;
    }

    const structure = nodeStructureKey(baseLayout.nodes);
    const structureChanged = structure !== prevStructureKey.current;
    prevStructureKey.current = structure;

    const merged =
      readOnly || forceReset
        ? baseLayout.nodes
        : mergePositions(baseLayout.nodes, savedPositions.current);

    if (forceReset || structureChanged) {
      setNodes(merged);
    } else {
      setNodes((current) =>
        current.map((node) => {
          const fresh = baseLayout.nodes.find((n) => n.id === node.id);
          if (!fresh) return node;
          return { ...node, data: fresh.data, style: fresh.style };
        }),
      );
    }
    setEdges(baseLayout.edges);

    const shouldFit = isFirstLayout.current || forceReset;
    isFirstLayout.current = false;
    if (shouldFit) {
      requestAnimationFrame(() => {
        fitViewRef.current?.({
          padding: fitPadding,
          duration: readOnly ? 0 : 250,
          minZoom: readOnly ? 0.55 : 0.1,
          maxZoom: readOnly ? 0.85 : 2,
        });
      });
    }
  }, [baseLayout, layoutResetToken, readOnly, setNodes, setEdges, fitPadding]);

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: FlowNode) => {
      if (readOnly) return;
      savedPositions.current.set(node.id, { ...node.position });
    },
    [readOnly],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (readOnly || !onAddFieldClick) return;
      const parsed = parseNodeId(node.id);
      if (parsed.kind === 'addField') onAddFieldClick(parsed.path);
    },
    [onAddFieldClick, readOnly],
  );

  return (
    <FlowEditorContext.Provider value={editorContext}>
      <div className={className}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={(instance) => {
            fitViewRef.current = instance.fitView.bind(instance);
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          nodesDraggable={!readOnly}
          nodesConnectable={false}
          elementsSelectable={false}
          panActivationKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          zoomActivationKeyCode={null}
          panOnDrag
          panOnScroll={!readOnly}
          zoomOnScroll={!readOnly}
          zoomOnPinch={!readOnly}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#e2e8f0" />
          {showControls && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </FlowEditorContext.Provider>
  );
}
