import type { SerializedNode, SerializedNodes } from '@craftjs/core';
import { ROOT_NODE } from '@craftjs/core';
import type {
  ActionNode,
  ApiSchema,
  AppSchema,
  EventFlow,
  MaterialMeta,
  MethodSchema,
  NodeSchema,
  PageSchema,
  ValueSource,
  JsonValue,
} from './types';

export const APP_SCHEMA_VERSION = '0.1.0';
export const APP_LOCAL_STORAGE_KEY = 'craft-antd-designer-schema';
export const ROOT_ID = ROOT_NODE;

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getIn(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').reduce<unknown>((current, part) => {
    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isNaN(index) ? undefined : current[index];
    }
    if (isRecord(current)) {
      return current[part];
    }
    return undefined;
  }, value);
}

export function setIn<T>(source: T, path: string, nextValue: unknown): T {
  const parts = path.split('.');
  const root: any = Array.isArray(source) ? [...source] : { ...(source as any) };
  let current = root;

  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    const nextPart = parts[index + 1];
    const targetIsIndex = Number.isInteger(Number(nextPart));

    if (isLast) {
      current[part] = nextValue;
      return;
    }

    const existing = current[part];
    if (Array.isArray(existing)) {
      current[part] = [...existing];
    } else if (isRecord(existing)) {
      current[part] = { ...existing };
    } else {
      current[part] = targetIsIndex ? [] : {};
    }

    current = current[part];
  });

  return root;
}

export function deleteIn<T>(source: T, path: string): T {
  const parts = path.split('.');
  const root: any = Array.isArray(source) ? [...source] : { ...(source as any) };
  let current = root;

  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    if (isLast) {
      if (Array.isArray(current)) {
        current.splice(Number(part), 1);
      } else if (isRecord(current)) {
        delete current[part];
      }
      return;
    }
    const next = current[part];
    current[part] = Array.isArray(next) ? [...next] : { ...(next as any) };
    current = current[part];
  });

  return root;
}

export function componentNameOf(node: SerializedNode['type']) {
  return typeof node === 'string' ? node : node.resolvedName;
}

export function normalizeEventFlows(nodeId: string, flows: unknown): EventFlow[] {
  if (!Array.isArray(flows)) return [];
  return flows
    .filter((item) => isRecord(item) && typeof item.eventName === 'string' && Array.isArray(item.actions))
    .map((item) => ({
      nodeId,
      eventName: String(item.eventName),
      enabled: item.enabled !== false,
      actions: normalizeActions(item.actions as unknown[]),
    }));
}

export function normalizeActions(actions: unknown[]): ActionNode[] {
  return actions.filter((action) => isRecord(action) && typeof action.type === 'string') as ActionNode[];
}

export function buildAppSchema(
  serializedNodes: SerializedNodes,
  pageState: Record<string, unknown>,
  methods: MethodSchema[],
  apis: ApiSchema[],
): AppSchema {
  const nodes = Object.fromEntries(
    Object.entries(serializedNodes).map(([id, node]) => {
      const eventFlows = normalizeEventFlows(id, node.custom?.eventFlows);
      const schemaNode: NodeSchema = {
        id,
        componentName: componentNameOf(node.type),
        props: deepClone(node.props ?? {}),
        children: node.nodes?.length ? [...node.nodes] : undefined,
        slots: Object.keys(node.linkedNodes ?? {}).length
          ? Object.fromEntries(
              Object.entries(node.linkedNodes).map(([slotName, nodeId]) => [slotName, [nodeId]]),
            )
          : undefined,
        visible: !node.hidden,
        locked: Boolean(node.custom?.locked),
        eventFlows,
        meta: {
          displayName: node.displayName,
        },
      };
      return [id, schemaNode];
    }),
  );

  const page: PageSchema = {
    id: 'page-main',
    name: '主页面',
    rootNodeId: ROOT_ID,
    nodes,
    state: deepClone(pageState),
  };

  return {
    version: APP_SCHEMA_VERSION,
    pages: [page],
    globalState: {},
    methods: deepClone(methods),
    apis: deepClone(apis),
  };
}

export function appSchemaToSerializedNodes(schema: AppSchema): SerializedNodes {
  const page = schema.pages[0];
  const parentMap = new Map<string, string | null>();

  Object.values(page.nodes).forEach((node) => {
    node.children?.forEach((childId) => {
      parentMap.set(childId, node.id);
    });
    Object.values(node.slots ?? {}).forEach((slotChildren) => {
      slotChildren.forEach((slotChildId) => {
        parentMap.set(slotChildId, node.id);
      });
    });
  });

  return Object.fromEntries(
    Object.values(page.nodes).map((node) => {
      const serialized: SerializedNode = {
        type: { resolvedName: node.componentName },
        isCanvas: Boolean((node.meta as any)?.isCanvas),
        props: deepClone(node.props),
        displayName: ((node.meta as any)?.displayName as string) || node.componentName,
        custom: {
          locked: node.locked ?? false,
          eventFlows: deepClone(node.eventFlows ?? []),
        },
        hidden: node.visible === false,
        nodes: [...(node.children ?? [])],
        linkedNodes: Object.fromEntries(
          Object.entries(node.slots ?? {}).map(([slotName, slotChildren]) => [slotName, slotChildren[0]]),
        ),
        parent: parentMap.get(node.id) ?? null,
      };
      return [node.id, serialized];
    }),
  );
}

export function extractNodeSchema(schema: AppSchema, nodeId: string | null) {
  if (!nodeId) return null;
  return schema.pages[0]?.nodes[nodeId] ?? null;
}

export function labelForNode(node: NodeSchema, metaMap: Record<string, MaterialMeta>) {
  const meta = metaMap[node.componentName];
  return (
    (typeof node.props.title === 'string' && node.props.title) ||
    (typeof node.props.label === 'string' && node.props.label) ||
    (typeof node.props.slotTitle === 'string' && node.props.slotTitle) ||
    meta?.title ||
    node.componentName
  );
}

export function eventFlowsForEvent(node: NodeSchema | null, eventName: string) {
  if (!node) return [];
  return (node.eventFlows ?? []).filter((flow) => flow.eventName === eventName);
}

export function upsertEventFlow(flows: EventFlow[], nextFlow: EventFlow) {
  const next = flows.filter((flow) => flow.eventName !== nextFlow.eventName);
  next.push(nextFlow);
  return next;
}

export function removeEventFlow(flows: EventFlow[], eventName: string) {
  return flows.filter((flow) => flow.eventName !== eventName);
}

export function createLiteralSource(value: JsonValue | string | number | boolean | null): ValueSource {
  return { kind: 'literal', value };
}

export function createEmptyAction(type: ActionNode['type']): ActionNode {
  switch (type) {
    case 'setState':
      return {
        id: createId('action'),
        type,
        key: 'searchText',
        value: { kind: 'literal', value: '' },
      };
    case 'setNodeProp':
      return {
        id: createId('action'),
        type,
        nodeId: ROOT_ID,
        propPath: 'style.backgroundColor',
        value: { kind: 'literal', value: '#ffffff' },
      };
    case 'toggleNodeProp':
      return {
        id: createId('action'),
        type,
        nodeId: ROOT_ID,
        propPath: 'disabled',
      };
    case 'showNode':
      return {
        id: createId('action'),
        type,
        nodeId: ROOT_ID,
      };
    case 'hideNode':
      return {
        id: createId('action'),
        type,
        nodeId: ROOT_ID,
      };
    case 'if':
      return {
        id: createId('action'),
        type,
        condition: {
          left: { kind: 'state', key: 'searchText' },
          operator: 'truthy',
        },
        then: [],
        else: [],
      };
    case 'callMethod':
      return {
        id: createId('action'),
        type,
        methodName: 'logSelection',
      };
    case 'request':
      return {
        id: createId('action'),
        type,
        apiName: 'loadUsers',
      };
    case 'message':
      return {
        id: createId('action'),
        type,
        level: 'info',
        content: { kind: 'literal', value: '操作已完成。' },
      };
  }
}
