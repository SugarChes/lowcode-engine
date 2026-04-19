import { describe, expect, it } from 'vitest';
import { runActions } from '../app/runtime/actions';
import type { ActionNode, NodeSchema } from '../app/schema/types';

describe('runtime action runner', () => {
  it('updates page state and node props from structured actions', async () => {
    const nodes: Record<string, NodeSchema> = {
      target: {
        id: 'target',
        componentName: 'Button',
        props: { label: 'Original' },
        visible: true,
      },
    };
    const pageState: Record<string, unknown> = { searchText: '' };
    const actions: ActionNode[] = [
      {
        id: 'a1',
        type: 'setState',
        key: 'searchText',
        value: { kind: 'literal', value: 'hello' },
      },
      {
        id: 'a2',
        type: 'setNodeProp',
        nodeId: 'target',
        propPath: 'label',
        value: { kind: 'state', key: 'searchText' },
      },
    ];

    await runActions(actions, {
      pageState,
      getNode: (nodeId) => nodes[nodeId],
      setPageState: (key, value) => {
        pageState[key] = value;
      },
      updateNodeProp: (nodeId, propPath, value) => {
        nodes[nodeId].props[propPath] = value;
      },
      toggleNodeProp: () => undefined,
      setNodeVisibility: (nodeId, visible) => {
        nodes[nodeId].visible = visible;
      },
      notify: () => undefined,
      apis: {},
      methods: {},
      eventParams: {},
    });

    expect(pageState.searchText).toBe('hello');
    expect(nodes.target.props.label).toBe('hello');
  });
});
