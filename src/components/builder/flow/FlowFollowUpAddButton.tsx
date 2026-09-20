import { stopFlowPointer, useFlowEditor } from './FlowEditorContext';

type FlowFollowUpAddButtonProps = {
  branchPath: string;
  disabled?: boolean;
};

export default function FlowFollowUpAddButton({
  branchPath,
  disabled = false,
}: FlowFollowUpAddButtonProps) {
  const { onAddFollowUp } = useFlowEditor();

  return (
    <button
      type="button"
      onClick={() => onAddFollowUp(branchPath)}
      onPointerDown={stopFlowPointer}
      disabled={disabled}
      className="nodrag nopan mt-2.5 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-indigo-300 bg-indigo-50/50 py-1.5 text-[11px] font-medium text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
    >
      + Add follow-up question
    </button>
  );
}
