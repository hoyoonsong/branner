import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AddFieldNodeData } from '../../../lib/conditionalFlowGraph';

export default function AddFieldFlowNode({ data }: NodeProps) {
  const d = data as AddFieldNodeData;

  if (d.compact) {
    return (
      <div
        className="nodrag flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-indigo-300 bg-white text-lg font-medium text-indigo-600 shadow-sm hover:border-indigo-500 hover:bg-indigo-50"
        title={`Add follow-up for “${d.branchWhen}”`}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!left-0 !top-1/2 !-translate-y-1/2 !bg-indigo-400"
        />
        +
      </div>
    );
  }

  return (
    <div className="flex h-12 w-[280px] cursor-grab items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white active:cursor-grabbing">
      <Handle type="target" position={Position.Left} className="!bg-gray-300" />
      <span className="text-sm font-medium text-gray-600">+ Add question</span>
    </div>
  );
}
