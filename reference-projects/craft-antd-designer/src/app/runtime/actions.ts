import type { ActionNode, ApiSchema, ConditionExpression, NodeSchema, ValueSource } from '../schema/types';
import { getIn, setIn } from '../schema/helpers';

export interface RuntimeMethodContext {
  pageState: Record<string, unknown>;
  selectedNodeId?: string | null;
}

export interface RuntimeExecutionContext {
  pageState: Record<string, unknown>;
  getNode: (nodeId: string) => NodeSchema | undefined;
  setPageState: (key: string, value: unknown) => void;
  updateNodeProp: (nodeId: string, propPath: string, value: unknown) => void;
  toggleNodeProp: (nodeId: string, propPath: string) => void;
  setNodeVisibility: (nodeId: string, visible: boolean) => void;
  notify: (level: 'success' | 'info' | 'warning' | 'error', content: string) => void;
  apis: Record<string, ApiSchema>;
  methods: Record<string, (context: RuntimeMethodContext) => void | Promise<void>>;
  eventParams: Record<string, unknown>;
  lastApiResult?: unknown;
}

export function resolveValueSource(source: ValueSource, context: RuntimeExecutionContext): unknown {
  switch (source.kind) {
    case 'literal':
      return source.value;
    case 'state':
      return context.pageState[source.key];
    case 'nodeProp': {
      const node = context.getNode(source.nodeId);
      return getIn(node?.props, source.propPath);
    }
    case 'eventParam':
      return getIn(context.eventParams, source.path);
    case 'apiResult':
      return getIn(context.lastApiResult, source.path);
  }
}

export function evaluateCondition(condition: ConditionExpression, context: RuntimeExecutionContext): boolean {
  const left = resolveValueSource(condition.left, context);
  const right = condition.right ? resolveValueSource(condition.right, context) : undefined;
  switch (condition.operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'contains':
      return Array.isArray(left) ? left.includes(right) : String(left ?? '').includes(String(right ?? ''));
    case 'gt':
      return Number(left ?? 0) > Number(right ?? 0);
    case 'lt':
      return Number(left ?? 0) < Number(right ?? 0);
    case 'truthy':
      return Boolean(left);
    case 'falsy':
      return !left;
  }
}

async function executeRequest(api: ApiSchema): Promise<unknown> {
  if (api.mockResponse !== undefined) {
    return api.mockResponse;
  }
  const response = await fetch(api.url, { method: api.method });
  return response.json();
}

export async function runActions(actions: ActionNode[], context: RuntimeExecutionContext): Promise<unknown> {
  let lastApiResult = context.lastApiResult;

  for (const action of actions) {
    switch (action.type) {
      case 'setState': {
        const nextValue = resolveValueSource(action.value, { ...context, lastApiResult });
        context.setPageState(action.key, nextValue);
        break;
      }
      case 'setNodeProp': {
        const nextValue = resolveValueSource(action.value, { ...context, lastApiResult });
        context.updateNodeProp(action.nodeId, action.propPath, nextValue);
        break;
      }
      case 'toggleNodeProp':
        context.toggleNodeProp(action.nodeId, action.propPath);
        break;
      case 'showNode':
        context.setNodeVisibility(action.nodeId, true);
        break;
      case 'hideNode':
        context.setNodeVisibility(action.nodeId, false);
        break;
      case 'if': {
        const passed = evaluateCondition(action.condition, { ...context, lastApiResult });
        await runActions(passed ? action.then : action.else, {
          ...context,
          lastApiResult,
        });
        break;
      }
      case 'callMethod': {
        const method = context.methods[action.methodName];
        if (method) {
          await method({
            pageState: context.pageState,
            selectedNodeId: null,
          });
        }
        break;
      }
      case 'request': {
        const api = context.apis[action.apiName];
        if (!api) {
          context.notify('error', `未知接口：${action.apiName}`);
          break;
        }
        lastApiResult = await executeRequest(api);
        break;
      }
      case 'message': {
        const content = resolveValueSource(action.content, { ...context, lastApiResult });
        context.notify(action.level, String(content ?? ''));
        break;
      }
    }
  }

  return lastApiResult;
}

export function updateNodePropRecord(node: NodeSchema, propPath: string, value: unknown): NodeSchema {
  return {
    ...node,
    props: setIn(node.props, propPath, value),
  };
}
