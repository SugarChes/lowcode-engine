import type { AppSchema, PageSchema, NodeSchema } from '../components/designer/schema';

import type {
  AssistantCommand,
  AssistantMode,
  AssistantRequestMessage,
} from './ai-assistant';

export type AssistantPlanStage =
  | 'analyze'
  | 'locate'
  | 'insert'
  | 'replace'
  | 'update_props'
  | 'delete_node'
  | 'verify';

export type AssistantPlanStep = {
  id?: string | null;
  stage?: AssistantPlanStage | null;
  title?: string | null;
  detail?: string | null;
};

export type AssistantPlannerOutput = {
  mode?: AssistantMode | null;
  message?: string | null;
  targetSummary?: string | null;
  plan?: AssistantPlanStep[] | null;
};

export type AssistantExecutorOutput = {
  mode?: AssistantMode | null;
  message?: string | null;
  targetSummary?: string | null;
  commands?: AssistantCommand[] | null;
};

const sanitizeText = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeMode = (value: unknown): AssistantMode | null => {
  if (value !== 'reply' && value !== 'preview' && value !== 'clarify') {
    return null;
  }

  return value;
};

const extractJsonPayload = (value: string) => {
  const trimmed = value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!trimmed) {
    throw new Error('AI 返回为空');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const startIndex = trimmed.indexOf('{');
    const endIndex = trimmed.lastIndexOf('}');

    if (startIndex >= 0 && endIndex > startIndex) {
      return JSON.parse(trimmed.slice(startIndex, endIndex + 1));
    }

    throw new Error('AI 返回的结果不是有效 JSON');
  }
};

const getActivePage = (schema: AppSchema, activePageId?: string) =>
  schema.pages.find((page) => page.id === activePageId) || schema.pages[0];

const getNodeTitle = (node: NodeSchema) => {
  const props = node.props || {};

  return (
    sanitizeText(props.title) ||
    sanitizeText(props.text) ||
    sanitizeText(props.label) ||
    sanitizeText(props.placeholder) ||
    sanitizeText(props.tabLabel) ||
    sanitizeText(node.meta?.title) ||
    node.componentName
  );
};

const collectNodeTexts = (node: NodeSchema) => {
  const values = new Set<string>();
  const push = (value: unknown) => {
    const text = sanitizeText(value);

    if (text) {
      values.add(text);
    }
  };

  push(node.meta?.title);
  push(node.props?.title);
  push(node.props?.text);
  push(node.props?.label);
  push(node.props?.placeholder);
  push(node.props?.tabLabel);

  if (Array.isArray(node.props?.items)) {
    node.props.items.forEach((item: any) => push(item?.label));
  }

  if (Array.isArray(node.props?.columns)) {
    node.props.columns.forEach((column: any) => push(column?.title));
  }

  return Array.from(values);
};

const buildPageSnapshot = (page?: PageSchema | null) => {
  if (!page) {
    return {
      pageName: '未命名页面',
      rootNodeId: null,
      nodes: [],
    };
  }

  return {
    pageName: page.name,
    rootNodeId: page.rootNodeId,
    nodes: Object.values(page.nodes || {}).map((node) => ({
      nodeId: node.id,
      componentName: node.componentName,
      title: getNodeTitle(node),
      parentHints: {
        children: Array.isArray(node.children) ? node.children.length : 0,
        slots: Object.keys(node.slots || {}),
      },
      texts: collectNodeTexts(node),
    })),
  };
};

export const buildAssistantPlannerPrompt = ({
  schema,
  activePageId,
  selectedNodeId,
}: {
  schema: AppSchema;
  activePageId?: string;
  selectedNodeId?: string | null;
}) => {
  const page = getActivePage(schema, activePageId);
  const snapshot = buildPageSnapshot(page);

  return [
    '你是低代码设计器中的任务规划智能体。',
    '你的职责不是直接输出组件配置，而是先把用户意图拆成一组清晰、可执行的步骤。',
    '你必须只返回一个 JSON 对象，不要 markdown，不要代码块，不要解释。',
    'JSON 结构必须是：',
    JSON.stringify(
      {
        mode: 'preview',
        message: '我会先新增一个页签，再分别往两个页签里放内容。',
        targetSummary: '当前页面中的新页签组件',
        plan: [
          {
            id: 'step-1',
            stage: 'insert',
            title: '新增页签组件',
            detail: '在当前页面追加一个两页签组件',
          },
          {
            id: 'step-2',
            stage: 'insert',
            title: '补齐页签内容',
            detail: '在单据页签放按钮，在单表页签放表格',
          },
          {
            id: 'step-3',
            stage: 'verify',
            title: '检查结果',
            detail: '确认页签名称和子组件都符合要求',
          },
        ],
      },
      null,
      2
    ),
    '规则：',
    '1. mode 只能是 reply、preview、clarify。',
    '2. 用户只是在问建议时用 reply。',
    '3. 用户要求改画布、加控件、替换控件、改属性时优先用 preview。',
    '4. 只有目标真的无法确定时才用 clarify。',
    '5. plan 必须是按执行顺序排列的原子步骤。',
    '6. 如果用户一句话里包含多层结构，比如“先加页签，再在第一个里放按钮，第二个里放表格”，必须拆成多个步骤。',
    `当前页面：${snapshot.pageName}`,
    `当前选中提示：${selectedNodeId || '无'}`,
    '当前页面快照：',
    JSON.stringify(snapshot, null, 2),
  ].join('\n');
};

export const buildAssistantExecutorPrompt = ({
  basePrompt,
  plan,
}: {
  basePrompt: string;
  plan: AssistantPlanStep[];
}) => {
  return [
    basePrompt,
    '',
    '你现在处于执行阶段。',
    '请严格按照下面的计划生成最终可执行命令。',
    '你必须只返回一个 JSON 对象，不要 markdown，不要代码块，不要解释。',
    '顶层字段只能使用：mode、message、targetSummary、commands。',
    '当 mode 是 preview 时，commands 必须是非空数组。',
    'commands 中只允许使用 insert_node、replace_node、update_props、delete_node。',
    '如果用户要求的是复合结构，请把它拆成多条命令，顺序要能直接执行。',
    '执行计划：',
    JSON.stringify(plan, null, 2),
  ].join('\n');
};

export const parseAssistantPlannerOutput = (value: string) => {
  const raw = extractJsonPayload(value) as AssistantPlannerOutput;
  const mode = normalizeMode(raw.mode);

  if (!mode) {
    throw new Error('AI 返回了不支持的规划模式');
  }

  const plan = Array.isArray(raw.plan)
    ? raw.plan
        .map((item, index) => ({
          id: sanitizeText(item?.id) || `step-${index + 1}`,
          stage:
            item?.stage === 'analyze' ||
            item?.stage === 'locate' ||
            item?.stage === 'insert' ||
            item?.stage === 'replace' ||
            item?.stage === 'update_props' ||
            item?.stage === 'delete_node' ||
            item?.stage === 'verify'
              ? item.stage
              : 'analyze',
          title: sanitizeText(item?.title) || `步骤 ${index + 1}`,
          detail: sanitizeText(item?.detail),
        }))
        .filter((item) => item.title)
    : [];

  return {
    mode,
    message: sanitizeText(raw.message) || '',
    targetSummary: sanitizeText(raw.targetSummary),
    plan,
  };
};

export const summarizeAssistantPlan = (plan: AssistantPlanStep[]) => {
  if (!plan.length) {
    return '';
  }

  return plan
    .map((step, index) => `${index + 1}. ${sanitizeText(step.title) || `步骤 ${index + 1}`}`)
    .join('\n');
};
