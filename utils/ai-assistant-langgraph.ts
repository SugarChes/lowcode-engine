import { ChatOpenAI } from '@langchain/openai';
import {
  END,
  START,
  StateGraph,
  StateSchema,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';
import { z } from 'zod';

import type { AppSchema, NodeSchema, PageSchema } from '../components/designer/schema';
import { parseAppSchemaText } from '../components/designer/schema';
import {
  AI_ASSISTANT_MODEL,
  applyAssistantPreview,
  buildAssistantHeuristicOutput,
  normalizeAssistantSchema,
  parseAssistantModelOutput,
  type AssistantCommand,
  type AssistantMode,
  type AssistantModelOutput,
  type AssistantRequestMessage,
  type AssistantTargetQuery,
} from './ai-assistant';
import {
  parseAssistantPlannerOutput,
  type AssistantPlanStage,
  type AssistantPlanStep,
} from './ai-assistant-agent';
import type {
  AssistantStreamEvent,
  AssistantTraceEvent,
  DeleteNodeInput,
  FindNodesInput,
  InsertNodeInput,
  ReplaceNodeInput,
  UpdatePropsInput,
} from './ai-assistant-stream';

const DEFAULT_BASE_URL = 'https://api.minimaxi.com/v1';
const DEFAULT_MODEL = AI_ASSISTANT_MODEL;
const REQUEST_TIMEOUT_MS = 60000;
const SUPPORTED_COMPONENTS = [
  'Container',
  'RowMaterial',
  'ColMaterial',
  'FlexMaterial',
  'SpaceMaterial',
  'ButtonMaterial',
  'InputMaterial',
  'TabsMaterial',
  'TableMaterial',
  'FormGroupMaterial',
] as const;

type PageIndexEntry = {
  nodeId: string;
  componentName: string;
  title: string;
  texts: string[];
  parentNodeId: string | null;
  depth: number;
  siblingIndex: number;
  siblingCount: number;
  pathTitles: string[];
  positionHints: string[];
};

type AssistantValidation = {
  ok: boolean;
  warnings: string[];
};

type AssistantHeuristicResult = ReturnType<typeof buildAssistantHeuristicOutput>;

type AssistantGraphState = {
  messages: AssistantRequestMessage[];
  activePageId: string;
  selectedNodeId: string | null;
  sourceSchema: AppSchema;
  draftSchema: AppSchema;
  pageIndex: PageIndexEntry[];
  pageSnapshot: Record<string, unknown> | null;
  planSteps: AssistantPlanStep[];
  commands: AssistantCommand[];
  targetSummary: string;
  finalMessage: string;
  mode: AssistantMode;
  validation: AssistantValidation;
  plannerMessage: string;
  executorMessage: string;
  heuristicOutput: AssistantHeuristicResult;
};

type AssistantRuntimeDependencies = {
  apiKey: string;
  baseUrl: string;
  model: string;
  signal?: AbortSignal;
};

type AssistantToolRuntime = {
  draftSchema: AppSchema;
  activePageId: string;
  pageIndex: PageIndexEntry[];
};

const AssistantState = new StateSchema({
  messages: z.array(
    z.object({
      role: z.enum(['assistant', 'user']),
      content: z.string(),
    })
  ),
  activePageId: z.string(),
  selectedNodeId: z.string().nullable(),
  sourceSchema: z.any(),
  draftSchema: z.any(),
  pageIndex: z.array(z.any()).default([]),
  pageSnapshot: z.any().nullable().default(null),
  planSteps: z.array(z.any()).default([]),
  commands: z.array(z.any()).default([]),
  targetSummary: z.string().default('当前页面'),
  finalMessage: z.string().default(''),
  mode: z.enum(['reply', 'preview', 'clarify']).default('reply'),
  validation: z
    .object({
      ok: z.boolean(),
      warnings: z.array(z.string()),
    })
    .default({ ok: true, warnings: [] }),
  plannerMessage: z.string().default(''),
  executorMessage: z.string().default(''),
  heuristicOutput: z.any().nullable().default(null),
});

const normalizeBaseUrl = (value?: string) =>
  (value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');

const sanitizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const stripThinkingContent = (value: string) =>
  value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

const extractTextContent = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      if (!item || typeof item !== 'object') {
        return '';
      }

      const text = (item as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .join('');
};

const normalizeMessages = (messages: AssistantRequestMessage[]) =>
  messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content);

const getNodeTitle = (node: NodeSchema) => {
  return (
    sanitizeText(node.props?.title) ||
    sanitizeText(node.props?.text) ||
    sanitizeText(node.props?.label) ||
    sanitizeText(node.props?.placeholder) ||
    sanitizeText(node.props?.tabLabel) ||
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

const collectChildNodeIds = (node: NodeSchema) => {
  const childIds = [...(node.children || [])];
  const slotValues = Object.values(node.slots || {});

  slotValues.forEach((slotValue) => {
    if (typeof slotValue === 'string' && slotValue) {
      childIds.push(slotValue);
      return;
    }

    if (Array.isArray(slotValue)) {
      slotValue.forEach((item) => {
        if (typeof item === 'string' && item) {
          childIds.push(item);
        }
      });
    }
  });

  return childIds;
};

const buildPositionHints = ({
  depth,
  siblingIndex,
  siblingCount,
}: {
  depth: number;
  siblingIndex: number;
  siblingCount: number;
}) => {
  const hints = new Set<string>();

  if (depth === 0) {
    hints.add('root');
  }

  if (siblingIndex === 0) {
    hints.add('first');
    hints.add('top');
    hints.add('left');
  }

  if (siblingIndex === siblingCount - 1) {
    hints.add('last');
    hints.add('bottom');
    hints.add('right');
  }

  if (siblingIndex === 0 && siblingCount > 1) {
    hints.add('top_left');
  }

  if (siblingIndex === siblingCount - 1 && siblingCount > 1) {
    hints.add('top_right');
    hints.add('bottom_right');
  }

  return Array.from(hints);
};

const buildPageIndex = (page?: PageSchema | null) => {
  if (!page || !page.nodes[page.rootNodeId]) {
    return [];
  }

  const entries: PageIndexEntry[] = [];
  const visited = new Set<string>();

  const visit = (
    nodeId: string,
    parentNodeId: string | null,
    depth: number,
    siblingIndex: number,
    siblingCount: number,
    pathTitles: string[]
  ) => {
    if (!nodeId || visited.has(nodeId)) {
      return;
    }

    const node = page.nodes[nodeId];

    if (!node) {
      return;
    }

    visited.add(nodeId);

    const title = getNodeTitle(node);
    const nextPathTitles = [...pathTitles, title];
    const childIds = collectChildNodeIds(node);

    entries.push({
      nodeId,
      componentName: node.componentName,
      title,
      texts: collectNodeTexts(node),
      parentNodeId,
      depth,
      siblingIndex,
      siblingCount,
      pathTitles: nextPathTitles,
      positionHints: buildPositionHints({ depth, siblingIndex, siblingCount }),
    });

    childIds.forEach((childId, index) => {
      visit(childId, nodeId, depth + 1, index, childIds.length || 1, nextPathTitles);
    });
  };

  visit(page.rootNodeId, null, 0, 0, 1, []);
  return entries;
};

const buildPageSnapshot = (schema: AppSchema, activePageId: string, selectedNodeId: string | null) => {
  const page = schema.pages.find((item) => item.id === activePageId) || schema.pages[0];
  const pageIndex = buildPageIndex(page);
  const selectedNode = selectedNodeId
    ? pageIndex.find((entry) => entry.nodeId === selectedNodeId) || null
    : null;

  return {
    page,
    pageIndex,
    snapshot: {
      pageId: page?.id || null,
      pageName: page?.name || '未命名页面',
      rootNodeId: page?.rootNodeId || null,
      selectedNode: selectedNode
        ? {
            nodeId: selectedNode.nodeId,
            componentName: selectedNode.componentName,
            title: selectedNode.title,
          }
        : null,
      nodes: pageIndex.map((entry) => ({
        nodeId: entry.nodeId,
        componentName: entry.componentName,
        title: entry.title,
        texts: entry.texts,
        parentNodeId: entry.parentNodeId,
        depth: entry.depth,
        siblingIndex: entry.siblingIndex,
        siblingCount: entry.siblingCount,
        pathTitles: entry.pathTitles,
        positionHints: entry.positionHints,
      })),
    },
  };
};

const summarizePlan = (steps: AssistantPlanStep[]) => {
  const titles = steps
    .map((step) => sanitizeText(step.title))
    .filter(Boolean)
    .slice(0, 4);

  if (!titles.length) {
    return '已完成任务拆解';
  }

  return titles.join(' -> ');
};

const translateStage = (stage?: AssistantPlanStage | null) => {
  switch (stage) {
    case 'analyze':
      return '分析';
    case 'locate':
      return '定位';
    case 'insert':
      return '新增';
    case 'replace':
      return '替换';
    case 'update_props':
      return '改属性';
    case 'delete_node':
      return '删除';
    case 'verify':
      return '校验';
    default:
      return '步骤';
  }
};

const chunkTextForStream = (value: string) => {
  const chars = Array.from(value);
  const chunks: string[] = [];

  for (let index = 0; index < chars.length; index += 4) {
    chunks.push(chars.slice(index, index + 4).join(''));
  }

  return chunks;
};

const emitEvent = (
  config: LangGraphRunnableConfig,
  event: AssistantStreamEvent
) => {
  config.writer?.(event);
};

const emitTrace = (
  config: LangGraphRunnableConfig,
  trace: AssistantTraceEvent
) => {
  emitEvent(config, {
    type: 'trace',
    ...trace,
  });
};

const createMiniMaxModel = ({
  apiKey,
  baseUrl,
  model,
}: AssistantRuntimeDependencies) =>
  new ChatOpenAI({
    apiKey,
    model,
    streamUsage: false,
    maxRetries: 0,
    configuration: {
      baseURL: baseUrl,
    },
    modelKwargs: {
      reasoning_split: false,
    },
  });

const requestMiniMaxFallback = async ({
  apiKey,
  baseUrl,
  model,
  systemPrompt,
  messages,
  signal,
}: AssistantRuntimeDependencies & {
  systemPrompt: string;
  messages: AssistantRequestMessage[];
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortListener = () => controller.abort();

  try {
    signal?.addEventListener('abort', abortListener, { once: true });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        reasoning_split: false,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...messages,
        ],
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    const rawJson = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
      const upstreamMessage =
        rawJson?.error?.message ||
        rawJson?.message ||
        rawJson?.base_resp?.status_msg ||
        'MiniMax 服务暂时不可用。';
      throw new Error(upstreamMessage);
    }

    return stripThinkingContent(
      extractTextContent(rawJson?.choices?.[0]?.message?.content)
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortListener);
  }
};

const callMiniMaxText = async ({
  deps,
  systemPrompt,
  messages,
}: {
  deps: AssistantRuntimeDependencies;
  systemPrompt: string;
  messages: AssistantRequestMessage[];
}) => {
  try {
    const model = createMiniMaxModel(deps);
    const response = await model.invoke(
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      {
        signal: deps.signal,
      }
    );

    const content = stripThinkingContent(extractTextContent(response.content));

    if (content) {
      return content;
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw error;
    }
  }

  return requestMiniMaxFallback({
    ...deps,
    systemPrompt,
    messages,
  });
};

const findNodes = (input: FindNodesInput, runtime: AssistantToolRuntime) => {
  const query = input.query.trim().toLowerCase();

  if (!query) {
    return [];
  }

  return runtime.pageIndex
    .map((entry) => {
      const haystack = [
        entry.componentName,
        entry.title,
        ...entry.texts,
        ...entry.pathTitles,
        ...entry.positionHints,
      ]
        .join(' ')
        .toLowerCase();

      let score = 0;

      if (entry.nodeId.toLowerCase() === query) {
        score += 12;
      }

      if (entry.title.toLowerCase().includes(query)) {
        score += 8;
      }

      if (entry.texts.some((text) => text.toLowerCase().includes(query))) {
        score += 6;
      }

      if (entry.componentName.toLowerCase().includes(query)) {
        score += 4;
      }

      if (entry.positionHints.some((hint) => hint.includes(query))) {
        score += 3;
      }

      if (haystack.includes(query)) {
        score += 1;
      }

      return {
        entry,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item) => item.entry);
};

const inspectNode = (nodeId: string, runtime: AssistantToolRuntime) =>
  runtime.pageIndex.find((entry) => entry.nodeId === nodeId) || null;

const applySingleCommand = (
  runtime: AssistantToolRuntime,
  command: AssistantCommand
) => {
  const result = applyAssistantPreview({
    schema: runtime.draftSchema,
    activePageId: runtime.activePageId,
    commands: [command],
  });

  if (!result.ok) {
    return result;
  }

  runtime.draftSchema = result.draftSchema;
  const pageSnapshot = buildPageSnapshot(
    result.draftSchema,
    runtime.activePageId,
    null
  );
  runtime.pageIndex = pageSnapshot.pageIndex;

  return result;
};

const insertNode = (input: InsertNodeInput, runtime: AssistantToolRuntime) =>
  applySingleCommand(runtime, input.command as AssistantCommand);

const replaceNode = (input: ReplaceNodeInput, runtime: AssistantToolRuntime) =>
  applySingleCommand(runtime, input.command as AssistantCommand);

const updateProps = (input: UpdatePropsInput, runtime: AssistantToolRuntime) =>
  applySingleCommand(runtime, input.command as AssistantCommand);

const deleteNode = (input: DeleteNodeInput, runtime: AssistantToolRuntime) =>
  applySingleCommand(runtime, input.command as AssistantCommand);

const validateDraft = (runtime: AssistantToolRuntime): AssistantValidation => {
  const warnings: string[] = [];

  try {
    const parsed = parseAppSchemaText(JSON.stringify(runtime.draftSchema));
    const page = parsed.pages.find((item) => item.id === runtime.activePageId) || parsed.pages[0];

    if (!page) {
      warnings.push('当前页面不存在。');
    } else if (!page.nodes[page.rootNodeId]) {
      warnings.push('页面根容器缺失。');
    }
  } catch (error) {
    return {
      ok: false,
      warnings: [error instanceof Error ? error.message : '草稿校验失败。'],
    };
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
};

const summarizeDraft = (runtime: AssistantToolRuntime) => {
  const page = runtime.draftSchema.pages.find((item) => item.id === runtime.activePageId) ||
    runtime.draftSchema.pages[0];

  if (!page) {
    return '当前草稿为空';
  }

  return `当前页面共有 ${Object.keys(page.nodes || {}).length} 个节点`;
};

const describeTargetQuery = (query?: AssistantTargetQuery | null) => {
  if (!query) {
    return '当前页面';
  }

  const parts = [
    sanitizeText(query.title),
    sanitizeText(query.text),
    sanitizeText(query.tabLabel),
    sanitizeText(query.positionHint),
    sanitizeText(query.componentName),
    sanitizeText(query.pathHint),
  ].filter(Boolean);

  return parts[0] || '目标组件';
};

const hasNestedTabsBlueprint = (output?: AssistantHeuristicResult | AssistantModelOutput | null) => {
  if (!output || !Array.isArray(output.commands)) {
    return false;
  }

  return output.commands.some((command) => {
    const blueprint = command?.nodeBlueprint;
    const tabs = Array.isArray(blueprint?.tabs) ? blueprint.tabs : [];

    if (blueprint?.componentName !== 'TabsMaterial' || !tabs.length) {
      return false;
    }

    return tabs.some((tab) => Array.isArray(tab?.children) && tab.children.length > 0);
  });
};

const isGenericTargetSummary = (value?: string | null) => {
  const normalized = sanitizeText(value);

  if (!normalized) {
    return true;
  }

  return (
    normalized === '当前页面' ||
    normalized === '页面根容器' ||
    normalized === '当前页' ||
    /页面根容器/.test(normalized)
  );
};

const pickReadableTargetSummary = ({
  targetSummary,
  heuristicOutput,
}: {
  targetSummary?: string | null;
  heuristicOutput?: AssistantHeuristicResult;
}) => {
  const primary = sanitizeText(targetSummary);
  const heuristicTarget = sanitizeText(
    (heuristicOutput as AssistantModelOutput | null)?.targetSummary
  );

  if (!isGenericTargetSummary(primary)) {
    return primary || '当前页面';
  }

  if (!isGenericTargetSummary(heuristicTarget)) {
    return heuristicTarget || '当前页面';
  }

  return primary || heuristicTarget || '当前页面';
};

const buildPlannerPrompt = (snapshot: Record<string, unknown>, selectedNodeId: string | null) => {
  return [
    'You are a planning assistant for a low-code page designer.',
    'Decide whether the user wants a direct answer, a draft preview of schema edits, or needs clarification.',
    'Return strict JSON only. No markdown. No code fences.',
    'JSON shape:',
    JSON.stringify(
      {
        mode: 'preview',
        message: 'I will first add the requested tabs, then place the child components into each tab.',
        targetSummary: 'A new tabs component on the current page',
        plan: [
          {
            id: 'step-1',
            stage: 'insert',
            title: 'Insert the tabs component',
            detail: 'Add a two-tab container to the current page root.',
          },
          {
            id: 'step-2',
            stage: 'insert',
            title: 'Fill each tab',
            detail: 'Put the requested button in the first tab and the requested table in the second tab.',
          },
          {
            id: 'step-3',
            stage: 'verify',
            title: 'Validate the draft',
            detail: 'Check tab labels and nested components.',
          },
        ],
      },
      null,
      2
    ),
    'Rules:',
    '1. Use mode="reply" only for advice or general questions.',
    '2. Use mode="preview" for any request that changes the canvas, inserts components, replaces components, deletes nodes, or edits props.',
    '3. Use mode="clarify" only if the target is too ambiguous to act on safely.',
    '4. Break complex requests into multiple atomic plan steps.',
    `5. selectedNodeId is only a weak hint: ${selectedNodeId || 'none'}.`,
    'Current page snapshot:',
    JSON.stringify(snapshot, null, 2),
  ].join('\n');
};

const buildExecutorPrompt = ({
  snapshot,
  planSteps,
  selectedNodeId,
}: {
  snapshot: Record<string, unknown>;
  planSteps: AssistantPlanStep[];
  selectedNodeId: string | null;
}) => {
  return [
    'You are an execution assistant for a low-code page designer.',
    'Return strict JSON only. No markdown. No code fences.',
    'Supported component names:',
    SUPPORTED_COMPONENTS.join(', '),
    'Allowed command types: insert_node, replace_node, update_props, delete_node.',
    'Allowed placement values: inside, prepend, append, before, after.',
    'You must use exact component names from the supported list.',
    'When the request includes nested structures such as tabs containing children, emit multiple commands in executable order.',
    'If the user asks to rename tabs or button text, use update_props when possible.',
    'JSON shape:',
    JSON.stringify(
      {
        mode: 'preview',
        message: 'I prepared a draft for the requested layout changes.',
        targetSummary: 'The tabs area on the current page',
        commands: [
          {
            type: 'insert_node',
            targetQuery: {
              positionHint: 'inside',
            },
            placement: 'append',
            nodeBlueprint: {
              componentName: 'TabsMaterial',
              tabs: [
                {
                  label: '单据',
                  children: [
                    {
                      componentName: 'ButtonMaterial',
                      props: {
                        text: '点击',
                      },
                    },
                  ],
                },
                {
                  label: '单表',
                  children: [
                    {
                      componentName: 'TableMaterial',
                      props: {
                        title: '单表',
                      },
                    },
                  ],
                },
              ],
            },
            reason: 'Insert a two-tab layout and fill the child content.',
          },
        ],
      },
      null,
      2
    ),
    `selectedNodeId is only a weak hint: ${selectedNodeId || 'none'}.`,
    'Current page snapshot:',
    JSON.stringify(snapshot, null, 2),
    'Execution plan:',
    JSON.stringify(planSteps, null, 2),
  ].join('\n');
};

const getExecutorOutput = async ({
  deps,
  messages,
  snapshot,
  planSteps,
  selectedNodeId,
  heuristicOutput,
}: {
  deps: AssistantRuntimeDependencies;
  messages: AssistantRequestMessage[];
  snapshot: Record<string, unknown>;
  planSteps: AssistantPlanStep[];
  selectedNodeId: string | null;
  heuristicOutput: AssistantHeuristicResult;
}) => {
  try {
    const rawContent = await callMiniMaxText({
      deps,
      systemPrompt: buildExecutorPrompt({
        snapshot,
        planSteps,
        selectedNodeId,
      }),
      messages,
    });

    const parsed = parseAssistantModelOutput(rawContent);

    if (parsed.mode === 'preview' && !(parsed.commands || []).length) {
      throw new Error('AI 没有返回可执行命令。');
    }

    if (hasNestedTabsBlueprint(heuristicOutput) && !hasNestedTabsBlueprint(parsed)) {
      return heuristicOutput as AssistantModelOutput;
    }

    return parsed;
  } catch (error) {
    if (heuristicOutput) {
      return heuristicOutput as AssistantModelOutput;
    }

    throw error;
  }
};

const createAssistantGraph = (deps: AssistantRuntimeDependencies) => {
  const bootstrapNode = async (
    state: AssistantGraphState,
    config: LangGraphRunnableConfig
  ) => {
    const sourceSchema = normalizeAssistantSchema(state.sourceSchema);
    const messages = normalizeMessages(state.messages);
    const activePageId =
      sanitizeText(state.activePageId) || sourceSchema.pages[0]?.id || 'page-1';
    const selectedNodeId = sanitizeText(state.selectedNodeId) || null;

    emitEvent(config, {
      type: 'run_started',
      model: deps.model,
    });
    emitTrace(config, {
      phase: 'plan',
      status: 'start',
      title: '开始分析你的需求',
    });

    return {
      messages,
      activePageId,
      selectedNodeId,
      sourceSchema,
      draftSchema: sourceSchema,
      mode: 'reply' as AssistantMode,
      targetSummary: '当前页面',
      validation: {
        ok: true,
        warnings: [],
      },
      heuristicOutput: buildAssistantHeuristicOutput({
        messages,
        schema: sourceSchema,
        activePageId,
      }),
    };
  };

  const indexSchemaNode = async (
    state: AssistantGraphState,
    config: LangGraphRunnableConfig
  ) => {
    const { pageIndex, snapshot } = buildPageSnapshot(
      state.sourceSchema,
      state.activePageId,
      state.selectedNodeId
    );

    emitTrace(config, {
      phase: 'locate',
      status: 'progress',
      title: '已建立当前页面索引',
      detail: `当前页共索引 ${pageIndex.length} 个节点`,
    });

    return {
      pageIndex,
      pageSnapshot: snapshot,
    };
  };

  const planRequestNode = async (
    state: AssistantGraphState,
    config: LangGraphRunnableConfig
  ) => {
    try {
      const rawContent = await callMiniMaxText({
        deps,
        systemPrompt: buildPlannerPrompt(
          state.pageSnapshot || {},
          state.selectedNodeId
        ),
        messages: state.messages,
      });
      const plannerOutput = parseAssistantPlannerOutput(rawContent);
      const planSteps = Array.isArray(plannerOutput.plan) ? plannerOutput.plan : [];
      const planSummary = summarizePlan(planSteps);

      emitTrace(config, {
        phase: 'plan',
        status: 'end',
        title: planSummary,
        detail:
          planSteps.length > 0
            ? planSteps
                .map((step, index) => `${index + 1}. ${translateStage(step.stage)} ${step.title || ''}`)
                .join('\n')
            : undefined,
      });

      return {
        planSteps,
        mode: plannerOutput.mode || ('reply' as AssistantMode),
        plannerMessage: sanitizeText(plannerOutput.message) || '',
        targetSummary: sanitizeText(plannerOutput.targetSummary) || state.targetSummary,
      };
    } catch (error) {
      const heuristicMode = ((state.heuristicOutput as AssistantModelOutput | null)?.mode ||
        'clarify') as AssistantMode;

      emitTrace(config, {
        phase: 'plan',
        status: 'error',
        title: '任务拆解改用保底策略',
        detail: error instanceof Error ? error.message : '计划生成失败',
      });

      return {
        planSteps: [],
        mode: heuristicMode,
        plannerMessage:
          sanitizeText((state.heuristicOutput as AssistantModelOutput | null)?.message) ||
          '我先按当前页面信息为你生成一个稳定的草稿。',
        targetSummary:
          sanitizeText((state.heuristicOutput as AssistantModelOutput | null)?.targetSummary) ||
          state.targetSummary,
      };
    }
  };

  const agentActNode = async (
    state: AssistantGraphState,
    config: LangGraphRunnableConfig
  ) => {
    if (state.mode === 'reply') {
      const heuristicReply =
        (state.heuristicOutput as AssistantModelOutput | null)?.mode === 'reply'
          ? sanitizeText((state.heuristicOutput as AssistantModelOutput | null)?.message)
          : null;

      return {
        finalMessage:
          heuristicReply ||
          state.plannerMessage ||
          '我是 MiniMax-M2.7 布局助手，可以先给你建议，也可以先生成预览草稿。',
      };
    }

    if (state.mode === 'clarify') {
      return {
        finalMessage:
          state.plannerMessage || '我还需要你补充一下目标位置或组件信息。',
      };
    }

    emitTrace(config, {
      phase: 'tool',
      status: 'start',
      title: '开始生成可执行命令',
    });

    const executorOutput = await getExecutorOutput({
      deps,
      messages: state.messages,
      snapshot: state.pageSnapshot || {},
      planSteps: state.planSteps,
      selectedNodeId: state.selectedNodeId,
      heuristicOutput: state.heuristicOutput,
    });

    if (executorOutput.mode === 'reply') {
      return {
        mode: 'reply' as AssistantMode,
        executorMessage: executorOutput.message || '',
        finalMessage: executorOutput.message || state.plannerMessage,
      };
    }

    if (executorOutput.mode === 'clarify') {
      return {
        mode: 'clarify' as AssistantMode,
        executorMessage: executorOutput.message || '',
        finalMessage:
          executorOutput.message || '我还不能稳定定位目标，请再补一句位置描述。',
      };
    }

    const runtime: AssistantToolRuntime = {
      draftSchema: state.draftSchema,
      activePageId: state.activePageId,
      pageIndex: state.pageIndex,
    };

    const commands = Array.isArray(executorOutput.commands)
      ? executorOutput.commands
      : [];
    const appliedCommands: AssistantCommand[] = [];
    let targetSummary =
      sanitizeText(executorOutput.targetSummary) || state.targetSummary || '当前页面';

    for (const command of commands) {
      const reason = sanitizeText(command.reason) || '执行草稿改动';
      const locateQuery =
        sanitizeText(command.targetNodeId) ||
        sanitizeText(command.targetParentNodeId) ||
        describeTargetQuery(command.targetQuery);
      const candidates = findNodes(
        {
          query: locateQuery,
        },
        runtime
      );

      if (locateQuery && locateQuery !== '当前页面') {
        emitTrace(config, {
          phase: 'locate',
          status: 'progress',
          title: `定位目标：${reason}`,
          detail:
            candidates.length > 0
              ? `优先命中：${candidates
                  .slice(0, 3)
                  .map((entry) => entry.title)
                  .join('、')}`
              : `目标提示：${locateQuery}`,
        });
      }

      emitTrace(config, {
        phase: 'tool',
        status: 'progress',
        title: reason,
      });

      let result:
        | ReturnType<typeof insertNode>
        | ReturnType<typeof replaceNode>
        | ReturnType<typeof updateProps>
        | ReturnType<typeof deleteNode>;

      switch (command.type) {
        case 'insert_node':
          result = insertNode({ command } as InsertNodeInput, runtime);
          break;
        case 'replace_node':
          result = replaceNode({ command } as ReplaceNodeInput, runtime);
          break;
        case 'update_props':
          result = updateProps({ command } as UpdatePropsInput, runtime);
          break;
        case 'delete_node':
          result = deleteNode({ command } as DeleteNodeInput, runtime);
          break;
        default:
          continue;
      }

      if (result.ok === false) {
        emitTrace(config, {
          phase: 'tool',
          status: 'error',
          title: `执行失败：${reason}`,
          detail: result.clarifyMessage,
        });

        return {
          mode: 'clarify' as AssistantMode,
          commands: appliedCommands,
          draftSchema: runtime.draftSchema,
          targetSummary,
          executorMessage: executorOutput.message || '',
          finalMessage: result.clarifyMessage,
        };
      }

      if (!targetSummary || targetSummary === '当前页面') {
        targetSummary = result.targetSummary || targetSummary;
      }
      appliedCommands.push(command);

      emitTrace(config, {
        phase: 'tool',
        status: 'end',
        title: `已完成：${reason}`,
        detail: summarizeDraft(runtime),
      });
    }

    return {
      mode: 'preview' as AssistantMode,
      draftSchema: runtime.draftSchema,
      commands: appliedCommands,
      targetSummary,
      executorMessage: executorOutput.message || '',
      finalMessage:
        executorOutput.message ||
        `我已经为你准备好一个预览草稿，目标是：${targetSummary}。`,
    };
  };

  const validateDraftNode = async (
    state: AssistantGraphState,
    config: LangGraphRunnableConfig
  ) => {
    if (state.mode !== 'preview') {
      return {
        validation: {
          ok: true,
          warnings: [],
        },
      };
    }

    emitTrace(config, {
      phase: 'validate',
      status: 'start',
      title: '正在校验预览草稿',
    });

    const runtime: AssistantToolRuntime = {
      draftSchema: state.draftSchema,
      activePageId: state.activePageId,
      pageIndex: state.pageIndex,
    };
    const validation = validateDraft(runtime);

    emitTrace(config, {
      phase: 'validate',
      status: validation.ok ? 'end' : 'error',
      title: validation.ok ? '草稿校验通过' : '草稿校验未通过',
      detail: validation.warnings.join('\n') || summarizeDraft(runtime),
    });

    if (!validation.ok) {
      return {
        mode: 'clarify' as AssistantMode,
        validation,
        finalMessage: validation.warnings[0] || '草稿校验失败，请换一种描述再试。',
      };
    }

    return {
      validation,
    };
  };

  const finalizeResponseNode = async (
    state: AssistantGraphState,
    config: LangGraphRunnableConfig
  ) => {
    emitTrace(config, {
      phase: 'finalize',
      status: 'start',
      title: '正在整理结果',
    });

    const readableTargetSummary = pickReadableTargetSummary({
      targetSummary: state.targetSummary,
      heuristicOutput: state.heuristicOutput,
    });

    const finalMessage =
      sanitizeText(state.finalMessage) ||
      sanitizeText(state.executorMessage) ||
      sanitizeText(state.plannerMessage) ||
      (state.mode === 'preview'
        ? `我已经为你准备好一个预览草稿，目标是：${readableTargetSummary}。`
        : state.mode === 'clarify'
          ? '我还需要你补充一点信息。'
          : '我已经整理好答案了。');

    chunkTextForStream(finalMessage).forEach((token) => {
      emitEvent(config, {
        type: 'message_token',
        token,
      });
    });

    if (state.mode === 'preview') {
      emitEvent(config, {
        type: 'preview_ready',
        message: finalMessage,
        targetSummary: readableTargetSummary,
        draftSchema: state.draftSchema,
      });
    } else if (state.mode === 'clarify') {
      emitEvent(config, {
        type: 'clarify_ready',
        message: finalMessage,
      });
    } else {
      emitEvent(config, {
        type: 'reply_ready',
        message: finalMessage,
      });
    }

    emitTrace(config, {
      phase: 'finalize',
      status: 'end',
      title:
        state.mode === 'preview'
          ? '预览草稿已生成'
          : state.mode === 'clarify'
            ? '需要你补充一点信息'
            : '已完成回复',
    });

    return {
      finalMessage,
    };
  };

  return new StateGraph(AssistantState)
    .addNode('bootstrap', bootstrapNode)
    .addNode('index_schema', indexSchemaNode)
    .addNode('plan_request', planRequestNode)
    .addNode('agent_act', agentActNode)
    .addNode('validate_draft', validateDraftNode)
    .addNode('finalize_response', finalizeResponseNode)
    .addEdge(START, 'bootstrap')
    .addEdge('bootstrap', 'index_schema')
    .addEdge('index_schema', 'plan_request')
    .addEdge('plan_request', 'agent_act')
    .addEdge('agent_act', 'validate_draft')
    .addEdge('validate_draft', 'finalize_response')
    .addEdge('finalize_response', END)
    .compile();
};

const isAssistantStreamEvent = (value: unknown): value is AssistantStreamEvent => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const type = (value as { type?: unknown }).type;
  return typeof type === 'string';
};

export const runAssistantGraphStream = async ({
  messages,
  schema,
  activePageId,
  selectedNodeId,
  signal,
  onEvent,
}: {
  messages: AssistantRequestMessage[];
  schema: AppSchema;
  activePageId?: string;
  selectedNodeId?: string | null;
  signal?: AbortSignal;
  onEvent: (event: AssistantStreamEvent) => void;
}) => {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('AI 服务未配置，请先在服务端设置 MINIMAX_API_KEY。');
  }

  const deps: AssistantRuntimeDependencies = {
    apiKey,
    baseUrl: normalizeBaseUrl(process.env.MINIMAX_BASE_URL),
    model: sanitizeText(process.env.MINIMAX_MODEL) || DEFAULT_MODEL,
    signal,
  };
  const normalizedSchema = normalizeAssistantSchema(schema);
  const resolvedActivePageId =
    sanitizeText(activePageId) || normalizedSchema.pages[0]?.id || 'page-1';
  const graph = createAssistantGraph(deps);
  const stream = await graph.stream(
    {
      messages: normalizeMessages(messages),
      activePageId: resolvedActivePageId,
      selectedNodeId: sanitizeText(selectedNodeId) || null,
      sourceSchema: normalizedSchema,
      draftSchema: normalizedSchema,
      pageIndex: [],
      pageSnapshot: null,
      planSteps: [],
      commands: [],
      targetSummary: '当前页面',
      finalMessage: '',
      mode: 'reply',
      validation: {
        ok: true,
        warnings: [],
      },
      plannerMessage: '',
      executorMessage: '',
      heuristicOutput: null,
    } satisfies AssistantGraphState,
    {
      streamMode: 'custom',
      signal,
    }
  );

  for await (const chunk of stream) {
    if (signal?.aborted) {
      break;
    }

    if (isAssistantStreamEvent(chunk)) {
      onEvent(chunk);
    }
  }
};
