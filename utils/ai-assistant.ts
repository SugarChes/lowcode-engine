import {
  AppSchema,
  NodeSchema,
  PageSchema,
  ROOT_NODE_ID,
  createEmptyAppSchema,
  parseAppSchemaText,
} from '../components/designer/schema';
import {
  BUTTON_DEFAULT_PROPS,
  COL_DEFAULT_PROPS,
  CONTAINER_DEFAULT_PROPS,
  FLEX_DEFAULT_PROPS,
  FORM_GROUP_DEFAULT_PROPS,
  INPUT_DEFAULT_PROPS,
  MATERIALS,
  ROW_DEFAULT_PROPS,
  SPACE_DEFAULT_PROPS,
  TABLE_DEFAULT_PROPS,
  TAB_PANE_CANVAS_COMPONENT_NAME,
  TAB_PANE_DEFAULT_PROPS,
  TABS_DEFAULT_PROPS,
  createDefaultFormField,
  createDefaultTableColumn,
  createDefaultTabsItem,
  getTabPaneSlotId,
} from '../components/designer/materials';

export const AI_ASSISTANT_MODEL = 'MiniMax-M2.7' as const;
export const AI_ASSISTANT_TOOL_NAME = 'submit_layout_response' as const;

const SUPPORTED_COMPONENT_NAMES = [
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

type SupportedComponentName = (typeof SUPPORTED_COMPONENT_NAMES)[number];
type InternalComponentName = SupportedComponentName | typeof TAB_PANE_CANVAS_COMPONENT_NAME;
export type AssistantMode = 'reply' | 'preview' | 'clarify';
type AssistantCommandType =
  | 'insert_node'
  | 'replace_node'
  | 'update_props'
  | 'delete_node';
type Placement = 'inside' | 'prepend' | 'append' | 'before' | 'after';

export type AssistantChatRole = 'assistant' | 'user';

export type AssistantRequestMessage = {
  role: AssistantChatRole;
  content: string;
};

export type AssistantRequestBody = {
  messages?: AssistantRequestMessage[];
  schema?: AppSchema;
  activePageId?: string;
  selectedNodeId?: string | null;
};

export type AssistantApiMessage = {
  role: 'assistant';
  content: string;
};

export type AssistantReplyResponse = {
  type: 'reply';
  model: typeof AI_ASSISTANT_MODEL;
  message: AssistantApiMessage;
};

export type AssistantClarifyResponse = {
  type: 'clarify';
  model: typeof AI_ASSISTANT_MODEL;
  message: AssistantApiMessage;
};

export type AssistantPreviewResponse = {
  type: 'preview';
  model: typeof AI_ASSISTANT_MODEL;
  message: AssistantApiMessage;
  targetSummary: string;
  draftSchema: AppSchema;
};

export type AssistantResponse =
  | AssistantReplyResponse
  | AssistantClarifyResponse
  | AssistantPreviewResponse;

export type AssistantTargetQuery = {
  nodeId?: string | null;
  parentNodeId?: string | null;
  componentName?: string | null;
  title?: string | null;
  text?: string | null;
  tabLabel?: string | null;
  positionHint?: string | null;
  ordinal?: string | number | null;
  pathHint?: string | null;
};

export type AssistantNodeBlueprint = {
  componentName?: string | null;
  props?: Record<string, any>;
  children?: AssistantNodeBlueprint[];
  tabs?: Array<{
    label?: string | null;
    children?: AssistantNodeBlueprint[];
  }>;
};

export type AssistantCommand = {
  type?: string | null;
  targetNodeId?: string | null;
  targetParentNodeId?: string | null;
  targetQuery?: AssistantTargetQuery | null;
  placement?: string | null;
  nodeBlueprint?: AssistantNodeBlueprint | null;
  propChanges?: Record<string, any> | null;
  reason?: string | null;
};

export type AssistantModelOutput = {
  mode?: string | null;
  message?: string | null;
  targetSummary?: string | null;
  commands?: AssistantCommand[] | null;
};

type NodeIndexEntry = {
  nodeId: string;
  componentName: string;
  title: string;
  texts: string[];
  parentNodeId: string | null;
  depth: number;
  siblingIndex: number;
  siblingCount: number;
  pathTitles: string[];
  insideTab: string | null;
  positionHints: string[];
  canAcceptChildren: boolean;
};

type ResolveResult = {
  entry: NodeIndexEntry;
  reason: string;
};

const SUPPORTED_COMPONENT_SET = new Set<string>(SUPPORTED_COMPONENT_NAMES);
const CONTAINER_COMPONENT_SET = new Set<string>([
  ...MATERIALS.filter((material) => material.allowChildren).map(
    (material) => material.componentName
  ),
  TAB_PANE_CANVAS_COMPONENT_NAME,
]);

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_PROPS_BY_COMPONENT: Record<InternalComponentName, Record<string, any>> = {
  Container: CONTAINER_DEFAULT_PROPS,
  RowMaterial: ROW_DEFAULT_PROPS,
  ColMaterial: COL_DEFAULT_PROPS,
  FlexMaterial: FLEX_DEFAULT_PROPS,
  SpaceMaterial: SPACE_DEFAULT_PROPS,
  ButtonMaterial: BUTTON_DEFAULT_PROPS,
  InputMaterial: INPUT_DEFAULT_PROPS,
  TabsMaterial: TABS_DEFAULT_PROPS,
  [TAB_PANE_CANVAS_COMPONENT_NAME]: TAB_PANE_DEFAULT_PROPS,
  TableMaterial: TABLE_DEFAULT_PROPS,
  FormGroupMaterial: FORM_GROUP_DEFAULT_PROPS,
};

const COMPONENT_ALIASES: Record<SupportedComponentName, string[]> = {
  Container: ['容器', '区块', '模块', '面板'],
  RowMaterial: ['栅格行', '行容器', '横向行'],
  ColMaterial: ['栅格列', '列容器', '列'],
  FlexMaterial: ['弹性布局', 'flex', '弹性容器'],
  SpaceMaterial: ['间距容器', '间距布局', 'space'],
  ButtonMaterial: ['按钮', '操作按钮'],
  InputMaterial: ['输入框', '文本框', '输入'],
  TabsMaterial: ['页签', '多页签', '标签页', 'tabs'],
  TableMaterial: ['表格', '数据表', '表单表格'],
  FormGroupMaterial: ['分组表单', '表单分组', '表单区块'],
};

const MATERIAL_CATALOG = MATERIALS.filter((material) =>
  SUPPORTED_COMPONENT_SET.has(material.componentName)
).map((material) => ({
  componentName: material.componentName,
  title: material.title,
  allowChildren: material.allowChildren,
  props: material.propsSchema.map((prop) => ({
    key: prop.key,
    title: prop.title,
  })),
}));

const MATERIAL_TITLE_BY_COMPONENT = Object.fromEntries(
  MATERIALS.map((material) => [material.componentName, material.title])
) as Record<string, string>;

const COMPONENT_PROP_KEYS = Object.fromEntries(
  MATERIALS.map((material) => [
    material.componentName,
    new Set([
      ...Object.keys(DEFAULT_PROPS_BY_COMPONENT[material.componentName as InternalComponentName] || {}),
      ...material.propsSchema.map((prop) => prop.key),
    ]),
  ])
) as Record<string, Set<string>>;

COMPONENT_PROP_KEYS[TAB_PANE_CANVAS_COMPONENT_NAME] = new Set(
  Object.keys(TAB_PANE_DEFAULT_PROPS)
);

const stripThinkingContent = (value: string) =>
  value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

const sanitizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const limitText = (value: string, maxLength = 48) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

const normalizeColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();

  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)
    ? normalized
    : fallback;
};

const normalizeString = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();

  return normalized || fallback;
};

const normalizeNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const nextValue = Number(value.trim());

    if (Number.isFinite(nextValue)) {
      return nextValue;
    }
  }

  return fallback;
};

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }
  }

  return fallback;
};

const normalizeBoxValue = (value: unknown, fallback: number[] = [0, 0, 0, 0]) => {
  if (Array.isArray(value) && value.length === 4) {
    return value.map((item, index) => normalizeNumber(item, fallback[index] || 0));
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return [value, value, value, value];
  }

  if (typeof value === 'string') {
    const tokens = value
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => Number(token));

    if (tokens.length === 1 && Number.isFinite(tokens[0])) {
      return [tokens[0], tokens[0], tokens[0], tokens[0]];
    }

    if (tokens.length === 4 && tokens.every((token) => Number.isFinite(token))) {
      return tokens;
    }
  }

  return [...fallback];
};

const getSafeTabPaneSlotId = (item: any, index = 0) =>
  getTabPaneSlotId(
    {
      key: typeof item?.key === 'string' ? item.key : `tab-${index + 1}`,
      label: typeof item?.label === 'string' ? item.label : `椤电 ${index + 1}`,
      paneId: typeof item?.paneId === 'string' ? item.paneId : undefined,
    },
    index
  );

const normalizeTabsItems = (
  value: unknown,
  existingItems?: Array<Record<string, any>>
) => {
  const source = Array.isArray(value) ? value : [];

  if (!source.length) {
    const fallbackItems =
      existingItems && existingItems.length
        ? existingItems
        : TABS_DEFAULT_PROPS.items || [createDefaultTabsItem()];

    return clone(fallbackItems).map((item: any, index: number) => ({
      key: item.key || `tab-${index + 1}`,
      label: item.label || `椤电 ${index + 1}`,
      paneId: item.paneId || getSafeTabPaneSlotId(item, index),
    }));
  }

  return source.map((item, index) => {
    const existingItem = existingItems?.[index];
    const baseItem = existingItem ? clone(existingItem) : createDefaultTabsItem();

    if (typeof item === 'string') {
      return {
        key: baseItem.key || `tab-${index + 1}`,
        label: item.trim() || baseItem.label,
        paneId: baseItem.paneId || getSafeTabPaneSlotId(baseItem, index),
      };
    }

    const candidate = item && typeof item === 'object' ? (item as Record<string, any>) : {};

    return {
      key: normalizeString(candidate.key, baseItem.key || `tab-${index + 1}`),
      label: normalizeString(candidate.label, baseItem.label || `椤电 ${index + 1}`),
      paneId: normalizeString(
        candidate.paneId,
        baseItem.paneId || getSafeTabPaneSlotId(baseItem, index)
      ),
    };
  });
};

const normalizeTableColumns = (
  value: unknown,
  existingColumns?: Array<Record<string, any>>
) => {
  const source = Array.isArray(value) ? value : [];

  if (!source.length) {
    const fallbackColumns =
      existingColumns && existingColumns.length
        ? existingColumns
        : TABLE_DEFAULT_PROPS.columns || [createDefaultTableColumn()];

    return clone(fallbackColumns);
  }

  return source.map((item, index) => {
    const existingColumn = existingColumns?.[index];
    const baseColumn = existingColumn ? clone(existingColumn) : createDefaultTableColumn();

    if (typeof item === 'string') {
      return {
        ...baseColumn,
        title: item.trim() || baseColumn.title,
      };
    }

    const candidate = item && typeof item === 'object' ? (item as Record<string, any>) : {};

    return {
      key: normalizeString(candidate.key, baseColumn.key),
      title: normalizeString(candidate.title, baseColumn.title),
      dataIndex: normalizeString(candidate.dataIndex, baseColumn.dataIndex),
      width: normalizeNumber(candidate.width, baseColumn.width || 160),
    };
  });
};

const normalizeFormFields = (
  value: unknown,
  existingFields?: Array<Record<string, any>>
) => {
  const source = Array.isArray(value) ? value : [];

  if (!source.length) {
    const fallbackFields =
      existingFields && existingFields.length
        ? existingFields
        : FORM_GROUP_DEFAULT_PROPS.fields || [createDefaultFormField()];

    return clone(fallbackFields);
  }

  return source.map((item, index) => {
    const existingField = existingFields?.[index];
    const baseField = existingField ? clone(existingField) : createDefaultFormField();

    if (typeof item === 'string') {
      return {
        ...baseField,
        label: item.trim() || baseField.label,
      };
    }

    const candidate = item && typeof item === 'object' ? (item as Record<string, any>) : {};

    return {
      key: normalizeString(candidate.key, baseField.key),
      label: normalizeString(candidate.label, baseField.label),
      placeholder: normalizeString(
        candidate.placeholder,
        baseField.placeholder || '请输入'
      ),
      type: normalizeString(candidate.type, baseField.type || 'text'),
    };
  });
};

const normalizeComponentName = (value: unknown): SupportedComponentName | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (SUPPORTED_COMPONENT_SET.has(trimmed)) {
    return trimmed as SupportedComponentName;
  }

  const normalized = normalizeWhitespace(trimmed);

  for (const componentName of SUPPORTED_COMPONENT_NAMES) {
    const materialTitle = normalizeWhitespace(
      MATERIAL_TITLE_BY_COMPONENT[componentName] || componentName
    );
    const aliases = COMPONENT_ALIASES[componentName].map(normalizeWhitespace);

    if (normalized === materialTitle || aliases.includes(normalized)) {
      return componentName;
    }
  }

  return null;
};

const getNodeTitle = (node: NodeSchema) => {
  switch (node.componentName) {
    case 'ButtonMaterial':
      return sanitizeText(node.props?.text) || MATERIAL_TITLE_BY_COMPONENT[node.componentName];
    case 'InputMaterial':
      return (
        sanitizeText(node.props?.label) ||
        sanitizeText(node.props?.placeholder) ||
        MATERIAL_TITLE_BY_COMPONENT[node.componentName]
      );
    case 'TableMaterial':
    case 'FormGroupMaterial':
    case 'Container':
      return sanitizeText(node.props?.title) || MATERIAL_TITLE_BY_COMPONENT[node.componentName];
    case TAB_PANE_CANVAS_COMPONENT_NAME: {
      const tabLabel = sanitizeText(node.props?.tabLabel);
      return tabLabel ? `${tabLabel}鍐呭` : '椤电鍐呭';
    }
    default:
      return (
        sanitizeText(node.meta?.title) ||
        MATERIAL_TITLE_BY_COMPONENT[node.componentName] ||
        node.componentName
      );
  }
};

const getNodeTexts = (node: NodeSchema) => {
  const values = new Set<string>();
  const push = (value: unknown) => {
    const text = sanitizeText(value);

    if (text) {
      values.add(limitText(text));
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

  if (Array.isArray(node.props?.fields)) {
    node.props.fields.forEach((field: any) => push(field?.label));
  }

  return Array.from(values);
};

const getParentOrientation = (node?: NodeSchema | null): 'row' | 'column' => {
  if (!node) {
    return 'column';
  }

  if (node.componentName === 'RowMaterial') {
    return 'row';
  }

  if (node.componentName === 'SpaceMaterial') {
    return node.props?.direction === 'vertical' ? 'column' : 'row';
  }

  if (node.componentName === 'Container' || node.componentName === 'FlexMaterial') {
    return node.props?.direction === 'row' ? 'row' : 'column';
  }

  return 'column';
};

const getOrderedChildRefs = (node: NodeSchema) => {
  const refs: Array<{ childId: string; slotName?: string }> = [];

  (node.children || []).forEach((childId) => {
    if (typeof childId === 'string' && childId) {
      refs.push({ childId });
    }
  });

  if (node.componentName === 'TabsMaterial' && Array.isArray(node.props?.items)) {
    node.props.items.forEach((item: any, index: number) => {
      const slotName = getTabPaneSlotId(item, index);
      const childId = node.slots?.[slotName];

      if (typeof childId === 'string' && childId) {
        refs.push({ childId, slotName });
      }
    });

    return refs;
  }

  Object.entries(node.slots || {}).forEach(([slotName, childId]) => {
    if (typeof childId === 'string' && childId) {
      refs.push({ childId, slotName });
    }
  });

  return refs;
};

const getTabLabelBySlotName = (node: NodeSchema, slotName?: string) => {
  if (!slotName || !Array.isArray(node.props?.items)) {
    return null;
  }

  const matchedItem = node.props.items.find((item: any, index: number) => {
    return getTabPaneSlotId(item, index) === slotName;
  });

  return sanitizeText(matchedItem?.label);
};

const buildPositionHints = (
  entry: {
    parentNode: NodeSchema | null;
    siblingIndex: number;
    siblingCount: number;
    depth: number;
    insideTab: string | null;
  }
) => {
  const hints = new Set<string>();

  if (entry.depth === 0) {
    hints.add('root');
  }

  if (entry.insideTab) {
    hints.add('inside');
  }

  if (entry.siblingCount > 0) {
    if (entry.siblingIndex === 0) {
      hints.add('first');
    }

    if (entry.siblingIndex === 1) {
      hints.add('second');
    }

    if (entry.siblingIndex === 2) {
      hints.add('third');
    }

    if (entry.siblingIndex === entry.siblingCount - 1) {
      hints.add('last');
    }
  }

  if (entry.parentNode && entry.siblingCount > 1) {
    const orientation = getParentOrientation(entry.parentNode);

    if (orientation === 'row') {
      if (entry.siblingIndex === 0) {
        hints.add('left');
      }

      if (entry.siblingIndex === entry.siblingCount - 1) {
        hints.add('right');
      }
    } else {
      if (entry.siblingIndex === 0) {
        hints.add('top');
      }

      if (entry.siblingIndex === entry.siblingCount - 1) {
        hints.add('bottom');
      }
    }
  }

  if (hints.has('top') && hints.has('right')) {
    hints.add('top_right');
  }

  if (hints.has('top') && hints.has('left')) {
    hints.add('top_left');
  }

  return Array.from(hints);
};

const getActivePage = (schema: AppSchema, activePageId?: string) =>
  schema.pages.find((page) => page.id === activePageId) || schema.pages[0];

const buildNodeIndex = (page: PageSchema) => {
  const entries: NodeIndexEntry[] = [];

  const walk = (
    nodeId: string,
    parentNodeId: string | null,
    depth: number,
    pathTitles: string[],
    insideTab: string | null,
    siblingIndex: number,
    siblingCount: number
  ) => {
    const node = page.nodes[nodeId];

    if (!node) {
      return;
    }

    const parentNode = parentNodeId ? page.nodes[parentNodeId] || null : null;
    const title = getNodeTitle(node);
    const nextPathTitles = [...pathTitles, title];
    const positionHints = buildPositionHints({
      parentNode,
      siblingIndex,
      siblingCount,
      depth,
      insideTab,
    });

    entries.push({
      nodeId,
      componentName: node.componentName,
      title,
      texts: getNodeTexts(node),
      parentNodeId,
      depth,
      siblingIndex,
      siblingCount,
      pathTitles: nextPathTitles,
      insideTab,
      positionHints,
      canAcceptChildren: CONTAINER_COMPONENT_SET.has(node.componentName),
    });

    const childRefs = getOrderedChildRefs(node);

    childRefs.forEach((childRef, index) => {
      const nextInsideTab =
        getTabLabelBySlotName(node, childRef.slotName) || insideTab;

      walk(
        childRef.childId,
        nodeId,
        depth + 1,
        nextPathTitles,
        nextInsideTab,
        index,
        childRefs.length
      );
    });
  };

  walk(page.rootNodeId || ROOT_NODE_ID, null, 0, [], null, 0, 1);

  return entries;
};

const getSelectedNodeContext = (
  nodeIndex: NodeIndexEntry[],
  selectedNodeId?: string | null
) => {
  if (!selectedNodeId) {
    return null;
  }

  return nodeIndex.find((entry) => entry.nodeId === selectedNodeId) || null;
};

export const normalizeAssistantSchema = (value: unknown) => {
  try {
    return parseAppSchemaText(JSON.stringify(value || createEmptyAppSchema()));
  } catch {
    return createEmptyAppSchema();
  }
};

export const buildAssistantSystemPrompt = ({
  schema,
  activePageId,
  selectedNodeId,
}: {
  schema: AppSchema;
  activePageId?: string;
  selectedNodeId?: string | null;
}) => {
  const page = getActivePage(schema, activePageId);
  const nodeIndex = buildNodeIndex(page);
  const selectedNode = getSelectedNodeContext(nodeIndex, selectedNodeId);

  return [
    '你是中文低代码设计器里的 AI 布局助手。',
    '你的目标是在三种模式中选择一种：reply、preview、clarify。',
    'reply：用户只是咨询布局建议，不需要直接改画布。',
    'preview：用户要求新增、替换、删除组件，或者通过自然语言修改组件属性。',
    'clarify：只有在你确实无法定位目标，或者缺少关键条件时才使用。默认优先 preview。',
    '你必须只返回一个 JSON 对象。',
    '不要输出 markdown，不要输出代码块，不要在 JSON 前后补充解释。',
    '顶层字段只能使用 mode、message、targetSummary、commands。',
    '不要把组件配置 JSON 再包进 message 字符串里。',
    '当用户明确要求新增、替换、删除控件或修改属性时，mode 必须是 preview。',
    '当 mode 是 preview 时，commands 必须是非空数组。',
    '你只能使用给定的 componentName 和属性 key。',
    '修改已有组件时优先给出 targetNodeId；新增组件时优先给出 targetParentNodeId。',
    '如果你能高概率判断“右上角按钮”“第一个容器”“页签里的表格”等目标，请直接给 preview。',
    '“把按钮换成文本框”使用 replace_node。',
    '“加一个两页签，里面各放一张表”使用 insert_node，并在 nodeBlueprint 里用 TabsMaterial 的 tabs 数组表达。',
    '“把按钮文案改成保存”或“把容器内边距改成 24”使用 update_props。',
    '允许的 placement：inside、prepend、append、before、after。',
    '结构化结果示例：',
    JSON.stringify(
      {
        mode: 'preview',
        message: '我准备把页面右上角的按钮替换成文本框。',
        targetSummary: '页面右上角按钮',
        commands: [
          {
            type: 'replace_node',
            targetNodeId: 'button-abc123',
            placement: 'after',
            targetQuery: {
              componentName: 'ButtonMaterial',
              text: '提交',
              positionHint: 'top_right',
            },
            nodeBlueprint: {
              componentName: 'InputMaterial',
              props: {
                label: '关键词',
                placeholder: '请输入',
                width: '240px',
              },
            },
            reason: '把按钮替换为输入框',
          },
        ],
      },
      null,
      2
    ),
    '新增页签示例：',
    JSON.stringify(
      {
        mode: 'preview',
        message: '我准备在当前页面追加一个两页签组件，并在每个页签里放一张表格。',
        targetSummary: '当前页面中的新页签组件',
        commands: [
          {
            type: 'insert_node',
            targetParentNodeId: 'page-root-node',
            placement: 'append',
            targetQuery: {
              positionHint: 'inside',
            },
            nodeBlueprint: {
              componentName: 'TabsMaterial',
              tabs: [
                {
                  label: '单据',
                  children: [
                    {
                      componentName: 'TableMaterial',
                      props: {
                        title: '单据表',
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
                        title: '单表表',
                      },
                    },
                  ],
                },
              ],
            },
            reason: '追加一个两页签布局',
          },
        ],
      },
      null,
      2
    ),
    '纯建议示例：',
    JSON.stringify(
      {
        mode: 'reply',
        message: '这个界面更适合采用上中下三段式布局，上方放标题和筛选，中间放核心内容，下方放操作区。',
      },
      null,
      2
    ),
    '澄清示例：',
    JSON.stringify(
      {
        mode: 'clarify',
        message: '我暂时无法确定你说的是哪个按钮，请补充按钮文字或所在区域。',
      },
      null,
      2
    ),
    `当前页面：${page.name}`,
    `当前选中提示：${
      selectedNode
        ? `${selectedNode.title} (${selectedNode.componentName})`
        : '无，用户不会特意先选中组件'
    }`,
    '可用组件目录：',
    JSON.stringify(MATERIAL_CATALOG, null, 2),
    '当前页面节点索引：',
    JSON.stringify(nodeIndex, null, 2),
  ].join('\n');
};

export const buildAssistantToolDefinition = () => ({
  type: 'function' as const,
  function: {
    name: AI_ASSISTANT_TOOL_NAME,
    description:
      'Return a structured low-code layout assistant result for the current user request.',
    parameters: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          description:
            'A JSON string with keys: mode, message, optional targetSummary, optional commands.',
        },
      },
      required: ['result'],
    },
  },
});

const extractJsonPayload = (value: string) => {
  const trimmed = stripThinkingContent(value)
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

export const parseAssistantModelOutput = (value: string) => {
  const raw = extractJsonPayload(value) as AssistantModelOutput;
  return normalizeAssistantModelOutput(raw);
};

export const normalizeAssistantModelOutput = (raw: AssistantModelOutput) => {
  const mode = sanitizeText(raw.mode)?.toLowerCase() as AssistantMode | undefined;

  if (mode !== 'reply' && mode !== 'preview' && mode !== 'clarify') {
    throw new Error('AI 返回了不支持的模式');
  }

  return {
    mode,
    message: sanitizeText(raw.message) || '',
    targetSummary: sanitizeText(raw.targetSummary),
    commands: Array.isArray(raw.commands) ? raw.commands : [],
  };
};

export const parseAssistantToolArguments = (value: unknown) => {
  if (typeof value === 'string') {
    return parseAssistantModelOutput(value);
  }

  if (value && typeof value === 'object') {
    const payload = value as { result?: unknown };

    if (typeof payload.result === 'string') {
      return parseAssistantModelOutput(payload.result);
    }

    return normalizeAssistantModelOutput(value as AssistantModelOutput);
  }

  throw new Error('AI 返回的工具参数为空');
};

const inferPositionHintFromPrompt = (value: string) => {
  if (value.includes('右上')) {
    return 'top_right';
  }

  if (value.includes('左上')) {
    return 'top_left';
  }

  if (value.includes('右下')) {
    return 'bottom_right';
  }

  if (value.includes('左下')) {
    return 'bottom_left';
  }

  if (value.includes('上方') || value.includes('顶部')) {
    return 'top';
  }

  if (value.includes('下方') || value.includes('底部')) {
    return 'bottom';
  }

  if (value.includes('左侧') || value.includes('左边')) {
    return 'left';
  }

  if (value.includes('右侧') || value.includes('右边')) {
    return 'right';
  }

  return null;
};

const collectTabLabelsFromPrompt = (value: string) => {
  const orderedLabels: string[] = [];
  const ordinalPatterns = [
    /第(?:一|1)个(?:子)?(?:页签)?(?:的)?(?:名字|名称)?(?:是|为)\s*([^\s，。、“”"'`]+)/,
    /第(?:二|2)个(?:子)?(?:页签)?(?:的)?(?:名字|名称)?(?:是|为)\s*([^\s，。、“”"'`]+)/,
    /第(?:三|3)个(?:子)?(?:页签)?(?:的)?(?:名字|名称)?(?:是|为)\s*([^\s，。、“”"'`]+)/,
  ];

  ordinalPatterns.forEach((pattern, index) => {
    const match = value.match(pattern);
    const label = match?.[1]?.trim();

    if (label) {
      orderedLabels[index] = label;
    }
  });

  if (orderedLabels.filter(Boolean).length > 0) {
    return orderedLabels.filter(Boolean);
  }

  const labels: string[] = [];
  const patterns = [
    /(?:名字是|名字为|名称是|名称为|名为|叫)\s*([^\s，。、“”"'`]+)/g,
    /(?:页签|标签页)\s*[：:]\s*([^\s，。、“”"'`]+)/g,
  ];

  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null = null;

    while ((match = pattern.exec(value))) {
      const label = match[1]?.trim();

      if (label && !labels.includes(label)) {
        labels.push(label);
      }
    }
  });

  if (labels.length > 0) {
    return labels;
  }

  if (/两页签|两个页签|两个子页签|两标签页/.test(value)) {
    return ['页签1', '页签2'];
  }

  return [];
};

const getReferencedTabCount = (value: string) => {
  let count = 0;

  if (/第(?:一|1)个(?:子)?(?:页签)?/.test(value)) {
    count = Math.max(count, 1);
  }

  if (/第(?:二|2)个(?:子)?(?:页签)?/.test(value)) {
    count = Math.max(count, 2);
  }

  if (/第(?:三|3)个(?:子)?(?:页签)?/.test(value)) {
    count = Math.max(count, 3);
  }

  if (/三页签|三个页签|三个子页签|三标签页/.test(value)) {
    count = Math.max(count, 3);
  }

  if (/两页签|两个页签|两个子页签|两标签页/.test(value)) {
    count = Math.max(count, 2);
  }

  return count;
};

const extractButtonTextFromPrompt = (value: string) => {
  const patterns = [
    /按钮(?:的)?(?:文本|文字|文案)(?:是|为|改成)\s*([^\s，。；、“”"'`]+)/,
    /按钮(?:上)?(?:写着|显示)\s*([^\s，。；、“”"'`]+)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    const text = match?.[1]?.trim();

    if (text) {
      return text;
    }
  }

  return null;
};

const createHeuristicNodeBlueprint = ({
  componentName,
  prompt,
  tabLabel,
}: {
  componentName: SupportedComponentName;
  prompt: string;
  tabLabel?: string;
}): AssistantNodeBlueprint => {
  if (componentName === 'ButtonMaterial') {
    return {
      componentName,
      props: {
        text: extractButtonTextFromPrompt(prompt) || '按钮',
      },
    };
  }

  if (componentName === 'TableMaterial') {
    return {
      componentName,
      props: {
        title: tabLabel ? `${tabLabel}表` : '数据表',
      },
    };
  }

  return {
    componentName,
  };
};

const extractTabChildrenFromPrompt = (value: string, tabLabels: string[]) => {
  const componentPattern =
    '(按钮|输入框|文本框|表格|数据表|分组表单|表单分组|容器|栅格行|栅格列|弹性布局|间距容器)';
  const childBlueprints = tabLabels.map(() => [] as AssistantNodeBlueprint[]);
  const ordinalPatterns = [
    new RegExp(`第(?:一|1)个(?:子)?(?:页签)?[^，。；]*?${componentPattern}`),
    new RegExp(`第(?:二|2)个(?:子)?(?:页签)?[^，。；]*?${componentPattern}`),
    new RegExp(`第(?:三|3)个(?:子)?(?:页签)?[^，。；]*?${componentPattern}`),
  ];

  ordinalPatterns.forEach((pattern, index) => {
    const match = value.match(pattern);
    const componentName = normalizeComponentName(match?.[1]);

    if (!componentName || !tabLabels[index]) {
      return;
    }

    childBlueprints[index].push(
      createHeuristicNodeBlueprint({
        componentName,
        prompt: value,
        tabLabel: tabLabels[index],
      })
    );
  });

  if (/分别[^，。；]*(表格|数据表)/.test(value)) {
    childBlueprints.forEach((children, index) => {
      if (!children.length) {
        children.push(
          createHeuristicNodeBlueprint({
            componentName: 'TableMaterial',
            prompt: value,
            tabLabel: tabLabels[index],
          })
        );
      }
    });
  }

  return childBlueprints;
};

const buildTabsBlueprintFromPrompt = (value: string): AssistantNodeBlueprint => {
  const requestedCount = getReferencedTabCount(value);
  const collectedLabels = collectTabLabelsFromPrompt(value);
  const tabCount = Math.max(collectedLabels.length, requestedCount || 0, 2);
  const tabLabels =
    collectedLabels.length >= tabCount
      ? collectedLabels.slice(0, tabCount)
      : Array.from({ length: tabCount }, (_, index) => collectedLabels[index] || `页签${index + 1}`);
  const tabChildren = extractTabChildrenFromPrompt(value, tabLabels);

  return {
    componentName: 'TabsMaterial',
    tabs: tabLabels.map((label, index) => ({
      label,
      children: tabChildren[index] || [],
    })),
  };
};

const buildHeuristicPreviewOutput = ({
  latestPrompt,
  schema,
  activePageId,
}: {
  latestPrompt: string;
  schema: AppSchema;
  activePageId?: string;
}): AssistantModelOutput | null => {
  const page = getActivePage(schema, activePageId);

  if (!page) {
    return null;
  }

  const normalizedPrompt = latestPrompt.trim();

  if (!normalizedPrompt) {
    return null;
  }

  const tabsInsertIntent = /(添加|新增|加一个|加个|放一个|放上|插入|创建).*?(页签|多页签|标签页)/.test(
    normalizedPrompt
  );

  if (tabsInsertIntent) {
    const tabsBlueprint = buildTabsBlueprintFromPrompt(normalizedPrompt);
    const tabs = Array.isArray(tabsBlueprint.tabs) ? tabsBlueprint.tabs : [];
    const hasNestedChildren = tabs.some((tab) => (tab.children || []).length > 0);

    return {
      mode: 'preview',
      message: `我准备在当前页面新增一个页签组件${
        hasNestedChildren ? '，并按你的描述放入子组件' : ''
      }。`,
      targetSummary: '当前页面中的新页签组件',
      commands: [
        {
          type: 'insert_node',
          targetParentNodeId: page.rootNodeId,
          placement: 'append',
          targetQuery: {
            positionHint: 'inside',
          },
          nodeBlueprint: tabsBlueprint,
          reason: '根据自然语言要求新增页签组件及其子内容',
        },
      ],
    };
  }

  const insertMatch = normalizedPrompt.match(
    /(添加|新增|加一个|加个|放一个|放上|插入|创建).*?(按钮|输入框|文本框|页签|多页签|标签页|表格|数据表|分组表单|表单分组|容器|栅格行|栅格列|弹性布局|间距容器)/
  );

  if (insertMatch) {
    const componentName = normalizeComponentName(insertMatch[2]);

    if (!componentName) {
      return null;
    }

    if (componentName === 'TabsMaterial') {
      const tabLabels = collectTabLabelsFromPrompt(normalizedPrompt);
      const hasTableChildren = /表格|数据表/.test(normalizedPrompt);
      const tabs = (tabLabels.length > 0 ? tabLabels : ['页签1', '页签2']).map((label) => ({
        label,
        children: hasTableChildren
          ? [
              {
                componentName: 'TableMaterial',
                props: {
                  title: `${label}表`,
                },
              },
            ]
          : [],
      }));

      return {
        mode: 'preview',
        message: `我准备在当前页面新增一个页签组件${hasTableChildren ? '，并在页签里放入表格' : ''}。`,
        targetSummary: '当前页面中的新页签组件',
        commands: [
          {
            type: 'insert_node',
            targetParentNodeId: page.rootNodeId,
            placement: 'append',
            targetQuery: {
              positionHint: 'inside',
            },
            nodeBlueprint: {
              componentName: 'TabsMaterial',
              tabs,
            },
            reason: '根据自然语言要求新增页签组件',
          },
        ],
      };
    }

    return {
      mode: 'preview',
      message: `我准备在当前页面新增一个${MATERIAL_TITLE_BY_COMPONENT[componentName] || '组件'}。`,
      targetSummary: `当前页面中的新${MATERIAL_TITLE_BY_COMPONENT[componentName] || '组件'}`,
      commands: [
        {
          type: 'insert_node',
          targetParentNodeId: page.rootNodeId,
          placement: 'append',
          targetQuery: {
            positionHint: 'inside',
          },
          nodeBlueprint: {
            ...createHeuristicNodeBlueprint({
              componentName,
              prompt: normalizedPrompt,
            }),
          },
          reason: '根据自然语言要求新增组件',
        },
      ],
    };
  }

  const replaceMatch = normalizedPrompt.match(/把(.+?)换成(.+)/);

  if (replaceMatch) {
    const targetPart = replaceMatch[1].trim();
    const replacementPart = replaceMatch[2].trim();
    const replacementComponentName = normalizeComponentName(replacementPart);

    if (!replacementComponentName) {
      return null;
    }

    const targetComponentName = normalizeComponentName(targetPart);
    const positionHint = inferPositionHintFromPrompt(targetPart);

    return {
      mode: 'preview',
      message: `我准备把你提到的目标组件替换成${MATERIAL_TITLE_BY_COMPONENT[replacementComponentName] || '新组件'}。`,
      targetSummary: sanitizeText(targetPart) || '目标组件',
      commands: [
        {
          type: 'replace_node',
          targetQuery: {
            componentName: targetComponentName,
            positionHint,
            text: sanitizeText(targetPart),
            pathHint: sanitizeText(targetPart),
          },
          nodeBlueprint: {
            componentName: replacementComponentName,
          },
          reason: '根据自然语言要求替换组件',
        },
      ],
    };
  }

  return null;
};

export const buildAssistantHeuristicOutput = ({
  messages,
  schema,
  activePageId,
}: {
  messages: AssistantRequestMessage[];
  schema: AppSchema;
  activePageId?: string;
}) => {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content;

  if (!latestUserMessage) {
    return null;
  }

  if (/你是什么模型|什么模型|什么大模型|model/i.test(latestUserMessage)) {
    return {
      mode: 'reply',
      message:
        '我当前接入的是 MiniMax-M2.7。需要我继续帮你生成布局预览的话，直接描述你想怎么改界面就行。',
      targetSummary: null,
      commands: [],
    } satisfies AssistantModelOutput;
  }

  return buildHeuristicPreviewOutput({
    latestPrompt: latestUserMessage,
    schema,
    activePageId,
  });
};

const normalizePositionHint = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return normalized || null;
};

const normalizeOrdinal = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === 'first') {
    return 0;
  }

  if (normalized === 'second') {
    return 1;
  }

  if (normalized === 'third') {
    return 2;
  }

  if (normalized === 'last') {
    return 'last';
  }

  const asNumber = Number(normalized);

  return Number.isFinite(asNumber) ? asNumber : null;
};

const matchesFuzzyText = (source: string, candidate: string) => {
  const normalizedSource = normalizeWhitespace(source);
  const normalizedCandidate = normalizeWhitespace(candidate);

  if (!normalizedSource || !normalizedCandidate) {
    return false;
  }

  return (
    normalizedSource.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedSource)
  );
};

const scoreEntryAgainstQuery = (entry: NodeIndexEntry, query: AssistantTargetQuery) => {
  let score = 0;

  const requestedComponentName = normalizeComponentName(query.componentName);

  if (requestedComponentName) {
    if (entry.componentName === requestedComponentName) {
      score += 18;
    } else {
      score -= 8;
    }
  }

  const textTokens = [
    sanitizeText(query.title),
    sanitizeText(query.text),
    sanitizeText(query.pathHint),
  ].filter(Boolean) as string[];

  textTokens.forEach((token) => {
    const matched =
      matchesFuzzyText(entry.title, token) ||
      entry.texts.some((text) => matchesFuzzyText(text, token)) ||
      entry.pathTitles.some((title) => matchesFuzzyText(title, token));

    if (matched) {
      score += 12;
    }
  });

  const tabLabel = sanitizeText(query.tabLabel);

  if (tabLabel && entry.insideTab && matchesFuzzyText(entry.insideTab, tabLabel)) {
    score += 10;
  }

  const positionHint = normalizePositionHint(query.positionHint);

  if (positionHint && entry.positionHints.includes(positionHint)) {
    score += 8;
  }

  const ordinal = normalizeOrdinal(query.ordinal);

  if (ordinal === 'last' && entry.positionHints.includes('last')) {
    score += 8;
  } else if (typeof ordinal === 'number' && entry.siblingIndex === ordinal) {
    score += 8;
  }

  if (entry.nodeId === query.nodeId) {
    score += 40;
  }

  return score;
};

const resolveEntryByQuery = (
  nodeIndex: NodeIndexEntry[],
  query?: AssistantTargetQuery | null
) => {
  if (!query) {
    return null;
  }

  const requestedNodeId = sanitizeText(query.nodeId);

  if (requestedNodeId) {
    const directMatch = nodeIndex.find((entry) => entry.nodeId === requestedNodeId);

    if (directMatch) {
      return {
        entry: directMatch,
        reason: `閫氳繃鑺傜偣 ID ${requestedNodeId} 瀹氫綅`,
      } satisfies ResolveResult;
    }
  }

  const scoredEntries = nodeIndex
    .map((entry) => ({
      entry,
      score: scoreEntryAgainstQuery(entry, query),
    }))
    .sort((left, right) => right.score - left.score);

  const bestMatch = scoredEntries[0];
  const secondMatch = scoredEntries[1];

  if (!bestMatch || bestMatch.score < 12) {
    return null;
  }

  if (secondMatch && bestMatch.score - secondMatch.score < 3) {
    return null;
  }

  return {
    entry: bestMatch.entry,
    reason: '閫氳繃鑷劧璇█鎻忚堪瀹氫綅',
  } satisfies ResolveResult;
};

const findParentReference = (page: PageSchema, nodeId: string) => {
  for (const node of Object.values(page.nodes)) {
    const childIndex = (node.children || []).indexOf(nodeId);

    if (childIndex >= 0) {
      return {
        parentNodeId: node.id,
        type: 'children' as const,
        childIndex,
      };
    }

    for (const [slotName, slotNodeId] of Object.entries(node.slots || {})) {
      if (slotNodeId === nodeId) {
        return {
          parentNodeId: node.id,
          type: 'slot' as const,
          slotName,
        };
      }
    }
  }

  return null;
};

const collectSubtreeIds = (page: PageSchema, nodeId: string, visited = new Set<string>()) => {
  const node = page.nodes[nodeId];

  if (!node || visited.has(nodeId)) {
    return visited;
  }

  visited.add(nodeId);

  (node.children || []).forEach((childId) => {
    collectSubtreeIds(page, childId, visited);
  });

  Object.values(node.slots || {}).forEach((childId) => {
    if (typeof childId === 'string' && childId) {
      collectSubtreeIds(page, childId, visited);
    }
  });

  return visited;
};

const syncNodeLayout = (node: NodeSchema) => {
  node.layout = {
    width: typeof node.props?.width === 'string' ? node.props.width : undefined,
    height: typeof node.props?.height === 'string' ? node.props.height : undefined,
    minHeight:
      typeof node.props?.minHeight === 'number' ? node.props.minHeight : undefined,
  };
};

const syncNodeMetaTitle = (node: NodeSchema) => {
  node.meta = {
    ...(node.meta || {}),
    title: getNodeTitle(node),
  };
};

const sanitizeProps = (
  componentName: InternalComponentName,
  props: Record<string, any>,
  existingProps?: Record<string, any>
) => {
  const defaultProps = clone(DEFAULT_PROPS_BY_COMPONENT[componentName] || {});
  const allowedKeys = COMPONENT_PROP_KEYS[componentName] || new Set<string>();
  const nextProps = clone(existingProps || defaultProps);

  Object.entries(props || {}).forEach(([key, rawValue]) => {
    if (!allowedKeys.has(key)) {
      return;
    }

    const fallbackValue =
      existingProps && key in existingProps ? existingProps[key] : defaultProps[key];

    if (key === 'padding' || key === 'margin') {
      nextProps[key] = normalizeBoxValue(rawValue, fallbackValue || [0, 0, 0, 0]);
      return;
    }

    if (key === 'items' && componentName === 'TabsMaterial') {
      nextProps[key] = normalizeTabsItems(rawValue, nextProps[key]);
      return;
    }

    if (key === 'columns' && componentName === 'TableMaterial') {
      nextProps[key] = normalizeTableColumns(rawValue, nextProps[key]);
      return;
    }

    if (key === 'fields' && componentName === 'FormGroupMaterial') {
      nextProps[key] = normalizeFormFields(rawValue, nextProps[key]);
      return;
    }

    if (typeof fallbackValue === 'boolean') {
      nextProps[key] = normalizeBoolean(rawValue, fallbackValue);
      return;
    }

    if (typeof fallbackValue === 'number') {
      nextProps[key] = normalizeNumber(rawValue, fallbackValue);
      return;
    }

    if (typeof fallbackValue === 'string') {
      if (key.toLowerCase().includes('color')) {
        nextProps[key] = normalizeColor(rawValue, fallbackValue);
        return;
      }

      nextProps[key] = normalizeString(rawValue, fallbackValue);
      return;
    }

    nextProps[key] = rawValue;
  });

  if (componentName === 'TabsMaterial') {
    nextProps.items = normalizeTabsItems(nextProps.items);
  }

  if (componentName === 'TableMaterial') {
    nextProps.columns = normalizeTableColumns(nextProps.columns);
  }

  if (componentName === 'FormGroupMaterial') {
    nextProps.fields = normalizeFormFields(nextProps.fields);
  }

  return nextProps;
};

const createNodeIdForComponent = (componentName: InternalComponentName) => {
  const prefixMap: Record<InternalComponentName, string> = {
    Container: 'container',
    RowMaterial: 'row',
    ColMaterial: 'col',
    FlexMaterial: 'flex',
    SpaceMaterial: 'space',
    ButtonMaterial: 'button',
    InputMaterial: 'input',
    TabsMaterial: 'tabs',
    [TAB_PANE_CANVAS_COMPONENT_NAME]: 'pane',
    TableMaterial: 'table',
    FormGroupMaterial: 'form-group',
  };

  return createId(prefixMap[componentName]);
};

const createNodeFromBlueprint = (
  blueprint: AssistantNodeBlueprint
): { rootNodeId: string; nodes: Record<string, NodeSchema> } => {
  const componentName = normalizeComponentName(blueprint.componentName);

  if (!componentName) {
    throw new Error('AI 返回了不支持的组件类型');
  }

  if (componentName === 'TabsMaterial') {
    const tabs = Array.isArray(blueprint.tabs) ? blueprint.tabs : [];
    const itemSource =
      tabs.length > 0
        ? tabs.map((tab) => ({ label: sanitizeText(tab.label) || '新页签' }))
        : blueprint.props?.items;
    const items = normalizeTabsItems(itemSource);
    const props = sanitizeProps(componentName, {
      ...(blueprint.props || {}),
      items,
    });
    const nodeId = createNodeIdForComponent(componentName);
    const nodes: Record<string, NodeSchema> = {};
    const slots: Record<string, string> = {};

    const tabNode: NodeSchema = {
      id: nodeId,
      componentName,
      props,
      children: [],
      slots,
    };

    syncNodeLayout(tabNode);
    syncNodeMetaTitle(tabNode);
    nodes[nodeId] = tabNode;

    props.items.forEach((item: any, index: number) => {
      const paneId = normalizeString(item.paneId, createId('pane'));
      const paneNode: NodeSchema = {
        id: paneId,
        componentName: TAB_PANE_CANVAS_COMPONENT_NAME,
        props: sanitizeProps(TAB_PANE_CANVAS_COMPONENT_NAME, {
          ...TAB_PANE_DEFAULT_PROPS,
          tabLabel: item.label,
        }),
        children: [],
      };

      syncNodeLayout(paneNode);
      syncNodeMetaTitle(paneNode);
      nodes[paneId] = paneNode;

      slots[getTabPaneSlotId({ ...item, paneId }, index)] = paneId;

      const tabChildren = tabs[index]?.children || [];

      tabChildren.forEach((childBlueprint) => {
        const childTree = createNodeFromBlueprint(childBlueprint);

        paneNode.children = [...(paneNode.children || []), childTree.rootNodeId];
        Object.assign(nodes, childTree.nodes);
      });
    });

    return { rootNodeId: nodeId, nodes };
  }

  const nodeId = createNodeIdForComponent(componentName);
  const props = sanitizeProps(componentName, blueprint.props || {});
  const node: NodeSchema = {
    id: nodeId,
    componentName,
    props,
    children: [],
  };

  syncNodeLayout(node);
  syncNodeMetaTitle(node);

  const nodes: Record<string, NodeSchema> = {
    [nodeId]: node,
  };

  const childBlueprints = Array.isArray(blueprint.children) ? blueprint.children : [];

  if (CONTAINER_COMPONENT_SET.has(componentName)) {
    childBlueprints.forEach((childBlueprint) => {
      const childTree = createNodeFromBlueprint(childBlueprint);

      node.children = [...(node.children || []), childTree.rootNodeId];
      Object.assign(nodes, childTree.nodes);
    });
  } else {
    delete node.children;
  }

  return { rootNodeId: nodeId, nodes };
};

const deleteNodeSubtree = (page: PageSchema, nodeId: string) => {
  const parentReference = findParentReference(page, nodeId);

  if (parentReference) {
    const parentNode = page.nodes[parentReference.parentNodeId];

    if (parentReference.type === 'children') {
      parentNode.children = (parentNode.children || []).filter((childId) => childId !== nodeId);
    }

    if (parentReference.type === 'slot' && parentReference.slotName) {
      delete parentNode.slots?.[parentReference.slotName];
    }
  }

  collectSubtreeIds(page, nodeId).forEach((subtreeId) => {
    delete page.nodes[subtreeId];
  });
};

const insertNodeIntoPage = ({
  page,
  parentNodeId,
  relativeNodeId,
  placement,
  newNodeId,
}: {
  page: PageSchema;
  parentNodeId: string;
  relativeNodeId?: string | null;
  placement: Placement;
  newNodeId: string;
}) => {
  const parentNode = page.nodes[parentNodeId];

  if (!parentNode || !CONTAINER_COMPONENT_SET.has(parentNode.componentName)) {
    throw new Error('目标位置不支持插入子组件');
  }

  const children = [...(parentNode.children || [])];

  if (placement === 'prepend') {
    parentNode.children = [newNodeId, ...children];
    return;
  }

  if (placement === 'append' || placement === 'inside') {
    parentNode.children = [...children, newNodeId];
    return;
  }

  if (!relativeNodeId) {
    parentNode.children = [...children, newNodeId];
    return;
  }

  const relativeIndex = children.indexOf(relativeNodeId);

  if (relativeIndex < 0) {
    parentNode.children = [...children, newNodeId];
    return;
  }

  const nextChildren = [...children];
  const insertIndex = placement === 'before' ? relativeIndex : relativeIndex + 1;
  nextChildren.splice(insertIndex, 0, newNodeId);
  parentNode.children = nextChildren;
};

const syncTabsNodeStructure = (page: PageSchema, node: NodeSchema, incomingItems: unknown) => {
  const previousItems = Array.isArray(node.props?.items) ? node.props.items : [];
  const nextItems = normalizeTabsItems(incomingItems, previousItems);
  const nextSlots: Record<string, string> = {};
  const usedPaneIds = new Set<string>();

  nextItems.forEach((item: any, index: number) => {
    const previousItem = previousItems[index];
    const paneId = normalizeString(
      item.paneId,
      previousItem?.paneId || createId('pane')
    );
    const slotName = getTabPaneSlotId({ ...item, paneId }, index);
    const existingPaneNode = page.nodes[paneId];

    if (existingPaneNode) {
      existingPaneNode.props = sanitizeProps(TAB_PANE_CANVAS_COMPONENT_NAME, {
        ...existingPaneNode.props,
        tabLabel: item.label,
      });
      syncNodeLayout(existingPaneNode);
      syncNodeMetaTitle(existingPaneNode);
    } else {
      const paneNode: NodeSchema = {
        id: paneId,
        componentName: TAB_PANE_CANVAS_COMPONENT_NAME,
        props: sanitizeProps(TAB_PANE_CANVAS_COMPONENT_NAME, {
          ...TAB_PANE_DEFAULT_PROPS,
          tabLabel: item.label,
        }),
        children: [],
      };

      syncNodeLayout(paneNode);
      syncNodeMetaTitle(paneNode);
      page.nodes[paneId] = paneNode;
    }

    nextSlots[slotName] = paneId;
    usedPaneIds.add(paneId);
  });

  previousItems.forEach((item: any, index: number) => {
    const paneId = item?.paneId || getTabPaneSlotId(item, index);

    if (paneId && !usedPaneIds.has(paneId) && page.nodes[paneId]) {
      deleteNodeSubtree(page, paneId);
    }
  });

  node.props.items = nextItems;
  node.slots = nextSlots;
};

const applyPropChangesToNode = (
  page: PageSchema,
  nodeId: string,
  propChanges: Record<string, any>
) => {
  const node = page.nodes[nodeId];

  if (!node) {
    throw new Error('找不到要修改的组件');
  }

  if (node.componentName === 'TabsMaterial' && 'items' in propChanges) {
    syncTabsNodeStructure(page, node, propChanges.items);
  }

  node.props = sanitizeProps(node.componentName as InternalComponentName, propChanges, node.props);
  syncNodeLayout(node);
  syncNodeMetaTitle(node);
};

const resolveCommandTarget = ({
  nodeIndex,
  command,
  preferParent,
}: {
  nodeIndex: NodeIndexEntry[];
  command: AssistantCommand;
  preferParent?: boolean;
}) => {
  const directId = sanitizeText(
    preferParent ? command.targetParentNodeId : command.targetNodeId
  );

  if (directId) {
    const matchedEntry = nodeIndex.find((entry) => entry.nodeId === directId);

    if (matchedEntry) {
      return {
        entry: matchedEntry,
        reason: `閫氳繃鏄惧紡鑺傜偣 ID ${directId} 瀹氫綅`,
      } satisfies ResolveResult;
    }
  }

  const query = command.targetQuery || undefined;
  const queryResult = resolveEntryByQuery(nodeIndex, query);

  if (queryResult) {
    return queryResult;
  }

  return null;
};

const normalizePlacement = (value: unknown): Placement => {
  if (typeof value !== 'string') {
    return 'append';
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === 'inside' ||
    normalized === 'prepend' ||
    normalized === 'append' ||
    normalized === 'before' ||
    normalized === 'after'
  ) {
    return normalized;
  }

  return 'append';
};

const resolveInsertLocation = (
  page: PageSchema,
  nodeIndex: NodeIndexEntry[],
  command: AssistantCommand
): {
  parentNodeId: string;
  placement: Placement;
  relativeNodeId: string | null;
  summary: string;
} | null => {
  const placement = normalizePlacement(command.placement);
  const parentResult = resolveCommandTarget({
    nodeIndex,
    command,
    preferParent: true,
  });

  if (parentResult && CONTAINER_COMPONENT_SET.has(parentResult.entry.componentName)) {
    return {
      parentNodeId: parentResult.entry.nodeId,
      placement:
        placement === 'before' || placement === 'after' ? 'append' : placement,
      relativeNodeId: null,
      summary: parentResult.entry.title,
    };
  }

  const targetResult = resolveCommandTarget({
    nodeIndex,
    command,
  });

  if (!targetResult) {
    return {
      parentNodeId: page.rootNodeId || ROOT_NODE_ID,
      placement: 'append' as Placement,
      relativeNodeId: null,
      summary: '页面根容器',
    };
  }

  if (
    (placement === 'inside' || placement === 'prepend' || placement === 'append') &&
    CONTAINER_COMPONENT_SET.has(targetResult.entry.componentName)
  ) {
    return {
      parentNodeId: targetResult.entry.nodeId,
      placement,
      relativeNodeId: null,
      summary: targetResult.entry.title,
    };
  }

  const parentReference = findParentReference(page, targetResult.entry.nodeId);

  if (!parentReference) {
    return null;
  }

  return {
    parentNodeId: parentReference.parentNodeId,
    placement: placement === 'before' ? 'before' : 'after',
    relativeNodeId: targetResult.entry.nodeId,
    summary: targetResult.entry.title,
  };
};

type ApplyPreviewResult =
  | {
      ok: true;
      draftSchema: AppSchema;
      targetSummary: string;
    }
  | {
      ok: false;
      clarifyMessage: string;
    };

export const applyAssistantPreview = ({
  schema,
  activePageId,
  commands,
  fallbackTargetSummary,
}: {
  schema: AppSchema;
  activePageId?: string;
  commands: AssistantCommand[];
  fallbackTargetSummary?: string | null;
}): ApplyPreviewResult => {
  const nextSchema = clone(schema);
  const page = getActivePage(nextSchema, activePageId);
  const resolvedTargetSummaries: string[] = [];

  if (!page) {
    return {
      ok: false,
      clarifyMessage: '当前页面不存在，暂时无法生成预览。',
    };
  }

  for (const command of commands) {
    const commandType = sanitizeText(command.type) as AssistantCommandType | null;

    if (
      commandType !== 'insert_node' &&
      commandType !== 'replace_node' &&
      commandType !== 'update_props' &&
      commandType !== 'delete_node'
    ) {
      continue;
    }

    const nodeIndex = buildNodeIndex(page);

    if (commandType === 'insert_node') {
      if (!command.nodeBlueprint) {
        continue;
      }

      const insertLocation = resolveInsertLocation(page, nodeIndex, command);

      if (!insertLocation) {
        return {
          ok: false,
          clarifyMessage: '我暂时无法稳定判断新增组件应该放到哪里，请再描述一下位置。',
        };
      }

      const newTree = createNodeFromBlueprint(command.nodeBlueprint);

      Object.assign(page.nodes, newTree.nodes);
      insertNodeIntoPage({
        page,
        parentNodeId: insertLocation.parentNodeId,
        relativeNodeId: insertLocation.relativeNodeId,
        placement: insertLocation.placement,
        newNodeId: newTree.rootNodeId,
      });
      resolvedTargetSummaries.push(insertLocation.summary);
      continue;
    }

    const targetResult = resolveCommandTarget({
      nodeIndex,
      command,
    });

    if (!targetResult) {
      return {
        ok: false,
        clarifyMessage: '我暂时无法稳定定位要修改的组件，请补充一下它的文字或所在区域。',
      };
    }

    if (targetResult.entry.nodeId === page.rootNodeId && commandType !== 'update_props') {
      return {
        ok: false,
        clarifyMessage: '这个操作会直接破坏页面根容器，请换一种描述，比如让我在页面里新增或替换具体组件。',
      };
    }

    if (commandType === 'replace_node') {
      if (!command.nodeBlueprint) {
        continue;
      }

      const parentReference = findParentReference(page, targetResult.entry.nodeId);

      if (!parentReference) {
        return {
          ok: false,
          clarifyMessage: '我定位到了目标，但还不能安全地替换它。',
        };
      }

      const newTree = createNodeFromBlueprint(command.nodeBlueprint);

      Object.assign(page.nodes, newTree.nodes);

      const parentNode = page.nodes[parentReference.parentNodeId];

      if (parentReference.type === 'children') {
        const nextChildren = [...(parentNode.children || [])];
        nextChildren[parentReference.childIndex] = newTree.rootNodeId;
        parentNode.children = nextChildren;
      }

      if (parentReference.type === 'slot' && parentReference.slotName) {
        parentNode.slots = {
          ...(parentNode.slots || {}),
          [parentReference.slotName]: newTree.rootNodeId,
        };
      }

      collectSubtreeIds(page, targetResult.entry.nodeId).forEach((nodeId) => {
        delete page.nodes[nodeId];
      });
      resolvedTargetSummaries.push(targetResult.entry.title);
      continue;
    }

    if (commandType === 'update_props') {
      applyPropChangesToNode(page, targetResult.entry.nodeId, command.propChanges || {});
      resolvedTargetSummaries.push(targetResult.entry.title);
      continue;
    }

    if (commandType === 'delete_node') {
      deleteNodeSubtree(page, targetResult.entry.nodeId);
      resolvedTargetSummaries.push(targetResult.entry.title);
    }
  }

  const normalizedDraftSchema = parseAppSchemaText(JSON.stringify(nextSchema));
  const uniqueTargetSummaries = Array.from(
    new Set(
      [
        ...(fallbackTargetSummary ? [fallbackTargetSummary] : []),
        ...resolvedTargetSummaries,
      ].filter(Boolean)
    )
  );

  return {
    ok: true,
    draftSchema: normalizedDraftSchema,
    targetSummary: uniqueTargetSummaries.join('、') || '当前页面',
  };
};
