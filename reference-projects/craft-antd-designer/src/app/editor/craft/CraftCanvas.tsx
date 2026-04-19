import React, { useEffect } from 'react';
import { Frame, useEditor } from '@craftjs/core';
import type { SerializedNodes } from '@craftjs/core';

function SelectionBridge({ onSelectedChange }: { onSelectedChange: (nodeId: string | null) => void }) {
  const { selectedNodeId } = useEditor((state) => {
    const firstSelected = Array.from(state.events.selected)[0];
    return { selectedNodeId: firstSelected ?? null };
  });

  useEffect(() => {
    onSelectedChange(selectedNodeId);
  }, [onSelectedChange, selectedNodeId]);

  return null;
}

export default function CraftCanvas({
  frameData,
  onSelectedChange,
}: {
  frameData: SerializedNodes;
  onSelectedChange: (nodeId: string | null) => void;
}) {
  const { connectors } = useEditor();

  return (
    <div className="workbench-canvas page-container">
      <div
        className="workbench-canvas__renderer craftjs-renderer"
        ref={(ref) => {
          if (!ref) return;
          connectors.select(connectors.hover(ref, null as any), null as any);
        }}
      >
        <div className="workbench-canvas__stage">
          <div className="workbench-canvas__frame">
            <Frame data={frameData}>
              <SelectionBridge onSelectedChange={onSelectedChange} />
            </Frame>
          </div>
        </div>
      </div>
    </div>
  );
}
