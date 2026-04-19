import type { AppSchema } from '../schema/types';

export const AI_ALLOWED_COMPONENTS = [
  'Container',
  'Row',
  'Col',
  'Flex',
  'SpaceNode',
  'Button',
  'Input',
  'Tabs',
  'Table',
  'FormGroup',
] as const;

export const AI_ALLOWED_ACTIONS = [
  'setState',
  'setNodeProp',
  'toggleNodeProp',
  'showNode',
  'hideNode',
  'if',
  'callMethod',
  'request',
  'message',
] as const;

export const AI_PATCH_TEMPLATE = {
  summary: '用一句话描述业务目标。',
  schemaPatch: {
    pages: [],
  },
  eventFlowPatch: [],
  constraints: {
    allowedComponents: [...AI_ALLOWED_COMPONENTS],
    allowedActions: [...AI_ALLOWED_ACTIONS],
  },
};

export function buildAiPromptContext(schema: AppSchema) {
  return {
    version: schema.version,
    pages: schema.pages.map((page) => ({
      id: page.id,
      name: page.name,
      stateKeys: Object.keys(page.state),
      nodeCount: Object.keys(page.nodes).length,
    })),
    methods: (schema.methods ?? []).map((method) => method.name),
    apis: (schema.apis ?? []).map((api) => api.name),
    allowedComponents: [...AI_ALLOWED_COMPONENTS],
    allowedActions: [...AI_ALLOWED_ACTIONS],
  };
}
