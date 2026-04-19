import React from 'react';
import { useEditor } from '@craftjs/core';
import { Card, Tree } from 'antd';
import type { AppSchema, NodeSchema } from '../../schema/types';
import { labelForNode } from '../../schema/helpers';
import { materialMetaMap } from '../../materials/defs';

function buildTreeData(nodes: Record<string, NodeSchema>, nodeId: string): Array<{ key: string; title: string; children: any[] }> {
  const node = nodes[nodeId];
  if (!node) return [];
  const slotChildren = Object.entries(node.slots ?? {}).flatMap(([, ids]) => ids);
  const childIds = [...(node.children ?? []), ...slotChildren];
  return [
    {
      key: node.id,
      title: labelForNode(node, materialMetaMap),
      children: childIds.flatMap((childId) => buildTreeData(nodes, childId)),
    },
  ];
}

export default function OutlinePanel({
  schema,
  selectedNodeId,
}: {
  schema: AppSchema;
  selectedNodeId: string | null;
}) {
  const { actions } = useEditor();
  const page = schema.pages[0];

  return (
    <Card className="outline-card" size="small" title="页面大纲">
      <Tree
        selectedKeys={selectedNodeId ? [selectedNodeId] : []}
        treeData={buildTreeData(page.nodes, page.rootNodeId)}
        onSelect={(keys) => actions.selectNode(String(keys[0] || ''))}
      />
    </Card>
  );
}
