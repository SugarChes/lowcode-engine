export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ValueSource =
  | { kind: 'literal'; value: JsonValue | string | number | boolean | null }
  | { kind: 'state'; key: string }
  | { kind: 'nodeProp'; nodeId: string; propPath: string }
  | { kind: 'eventParam'; path: string }
  | { kind: 'apiResult'; path: string };

export interface ConditionExpression {
  left: ValueSource;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'truthy' | 'falsy';
  right?: ValueSource;
}

export interface SetStateAction {
  id: string;
  type: 'setState';
  key: string;
  value: ValueSource;
}

export interface SetNodePropAction {
  id: string;
  type: 'setNodeProp';
  nodeId: string;
  propPath: string;
  value: ValueSource;
}

export interface ToggleNodePropAction {
  id: string;
  type: 'toggleNodeProp';
  nodeId: string;
  propPath: string;
}

export interface ShowNodeAction {
  id: string;
  type: 'showNode';
  nodeId: string;
}

export interface HideNodeAction {
  id: string;
  type: 'hideNode';
  nodeId: string;
}

export interface IfAction {
  id: string;
  type: 'if';
  condition: ConditionExpression;
  then: ActionNode[];
  else: ActionNode[];
}

export interface CallMethodAction {
  id: string;
  type: 'callMethod';
  methodName: string;
}

export interface RequestAction {
  id: string;
  type: 'request';
  apiName: string;
}

export interface MessageAction {
  id: string;
  type: 'message';
  level: 'success' | 'info' | 'warning' | 'error';
  content: ValueSource;
}

export type ActionNode =
  | SetStateAction
  | SetNodePropAction
  | ToggleNodePropAction
  | ShowNodeAction
  | HideNodeAction
  | IfAction
  | CallMethodAction
  | RequestAction
  | MessageAction;

export interface EventFlow {
  nodeId: string;
  eventName: string;
  actions: ActionNode[];
  enabled?: boolean;
}

export interface LayoutSchema {
  mode?: 'flow' | 'flex' | 'grid';
  [key: string]: unknown;
}

export interface NodeSchema {
  id: string;
  componentName: string;
  props: Record<string, unknown>;
  children?: string[];
  slots?: Record<string, string[]>;
  layout?: LayoutSchema;
  meta?: Record<string, unknown>;
  visible?: boolean;
  locked?: boolean;
  eventFlows?: EventFlow[];
}

export interface PageSchema {
  id: string;
  name: string;
  rootNodeId: string;
  nodes: Record<string, NodeSchema>;
  state: Record<string, unknown>;
}

export interface MethodSchema {
  id: string;
  name: string;
  description?: string;
}

export interface ApiSchema {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  mockResponse?: JsonValue | Record<string, unknown>;
}

export interface AppSchema {
  version: string;
  pages: PageSchema[];
  globalState?: Record<string, unknown>;
  methods?: MethodSchema[];
  apis?: ApiSchema[];
}

export type PropFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'bool'
  | 'select'
  | 'json'
  | 'color';

export interface PropFieldOption {
  label: string;
  value: string | number | boolean;
}

export interface PropFieldConfig {
  path: string;
  label: string;
  type: PropFieldType;
  section: 'props' | 'style' | 'advanced';
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: PropFieldOption[];
}

export interface MaterialEventMeta {
  name: string;
  label: string;
  params: string[];
}

export interface MaterialMeta {
  componentName: string;
  title: string;
  group: string;
  icon: string;
  snippetTitle: string;
  propsSchema: PropFieldConfig[];
  events: MaterialEventMeta[];
  isCanvas?: boolean;
  nestingRule?: {
    allowedChildren?: string[];
    allowedParents?: string[];
  };
}
