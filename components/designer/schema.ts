import {
  CANVAS_COMPONENT_NAMES,
  CONTAINER_DEFAULT_PROPS,
  TAB_PANE_CANVAS_COMPONENT_NAME,
  TAB_PANE_DEFAULT_PROPS,
  getTabPaneSlotId,
  getMaterialMeta,
} from './materials';

export const ROOT_NODE_ID = 'ROOT';
export const CURRENT_SCHEMA_VERSION = '1.0.0';
export const APP_SCHEMA_STORAGE_KEY = 'craft-landing-designer:app-schema:v2';
export const LEGACY_APP_SCHEMA_STORAGE_KEYS = ['craft-landing-designer:app-schema'];

export type LayoutSchema = {
  width?: string;
  height?: string;
  minHeight?: number;
};

export type NodeSchema = {
  id: string;
  componentName: string;
  props: Record<string, any>;
  children?: string[];
  slots?: Record<string, string | string[]>;
  layout?: LayoutSchema;
  meta?: Record<string, any>;
};

export type PageSchema = {
  id: string;
  name: string;
  rootNodeId: string;
  nodes: Record<string, NodeSchema>;
};

export type AppSchema = {
  version: string;
  pages: PageSchema[];
  globalState?: Record<string, any>;
  methods?: any[];
  apis?: any[];
};

export type CraftSerializedNodes = Record<string, any>;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeSlots = (value: any): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([slotName, slotValue]) => {
      const normalizedValue = Array.isArray(slotValue) ? slotValue[0] : slotValue;

      return typeof normalizedValue === 'string' && normalizedValue
        ? [slotName, normalizedValue]
        : null;
    })
    .filter(Boolean) as [string, string][];

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const COMPACT_BOX_VALUE = [1, 1, 1, 1];

const boxEquals = (value: any, expected: number[]) =>
  Array.isArray(value) &&
  value.length === expected.length &&
  value.every((item, index) => Number(item) === expected[index]);

const replaceBoxIfLegacy = (
  props: Record<string, any>,
  key: string,
  legacyValue: number[]
) => {
  if (boxEquals(props[key], legacyValue)) {
    props[key] = [...COMPACT_BOX_VALUE];
  }
};

const replaceNumberIfLegacy = (
  props: Record<string, any>,
  key: string,
  legacyValue: number
) => {
  if (Number(props[key]) === legacyValue) {
    props[key] = 1;
  }
};

const compactLegacySpacing = (node: NodeSchema) => {
  const props = node.props || {};

  if (node.id === ROOT_NODE_ID) {
    replaceBoxIfLegacy(props, 'padding', [20, 20, 20, 20]);
    replaceNumberIfLegacy(props, 'gap', 16);
  }

  if (node.componentName === 'Container') {
    replaceBoxIfLegacy(props, 'padding', [16, 16, 16, 16]);
    replaceNumberIfLegacy(props, 'gap', 12);
    return;
  }

  if (node.componentName === 'RowMaterial') {
    replaceBoxIfLegacy(props, 'padding', [12, 12, 12, 12]);
    replaceNumberIfLegacy(props, 'gutter', 16);
    return;
  }

  if (
    [
      'ColMaterial',
      'FlexMaterial',
      'SpaceMaterial',
      'TabPaneCanvas',
      'FormGroupMaterial',
    ].includes(node.componentName)
  ) {
    replaceBoxIfLegacy(props, 'padding', [12, 12, 12, 12]);
  }

  if (node.componentName === 'FlexMaterial') {
    replaceNumberIfLegacy(props, 'gap', 12);
  }

  if (node.componentName === 'SpaceMaterial') {
    replaceNumberIfLegacy(props, 'size', 12);
  }
};

const TABS_MIGRATION_CONTAINER_TITLE = '页签迁移内容';
const TABS_MIGRATION_CONTAINER_PROPS = {
  ...clone(CONTAINER_DEFAULT_PROPS),
  title: TABS_MIGRATION_CONTAINER_TITLE,
  margin: [1, 1, 1, 1] as [number, number, number, number],
};

const collectParentMap = (nodes: Record<string, NodeSchema>) => {
  const parentMap = new Map<string, string>();

  Object.values(nodes).forEach((node) => {
    (node.children || []).forEach((childId) => {
      parentMap.set(childId, node.id);
    });
  });

  return parentMap;
};

const insertNodeAfter = (
  parentNode: NodeSchema | undefined,
  afterNodeId: string,
  newNodeId: string
) => {
  if (!parentNode) {
    return;
  }

  const children = [...(parentNode.children || [])];
  const existingIndex = children.indexOf(newNodeId);

  if (existingIndex >= 0) {
    children.splice(existingIndex, 1);
  }

  const targetIndex = children.indexOf(afterNodeId);

  if (targetIndex >= 0) {
    children.splice(targetIndex + 1, 0, newNodeId);
  } else {
    children.push(newNodeId);
  }

  parentNode.children = children;
};

const collectStableChildIds = (
  nodeId: string,
  nodes: Record<string, NodeSchema>,
  removedPaneIds: Set<string>,
  visited: Set<string> = new Set()
): string[] => {
  if (!nodeId || visited.has(nodeId) || !nodes[nodeId]) {
    return [];
  }

  visited.add(nodeId);

  const node = nodes[nodeId];

  if (node.componentName === 'TabPaneCanvas') {
    removedPaneIds.add(nodeId);

    return (node.children || []).flatMap((childId) =>
      collectStableChildIds(childId, nodes, removedPaneIds, visited)
    );
  }

  return [nodeId];
};

const dedupeNodeIds = (ids: string[]) => {
  const seen = new Set<string>();

  return ids.filter((id) => {
    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
};

const createTabsMigrationContainer = (
  containerId: string,
  children: string[]
): NodeSchema => ({
  id: containerId,
  componentName: 'Container',
  props: clone(TABS_MIGRATION_CONTAINER_PROPS),
  children,
  layout: {
    width: '100%',
    height: 'auto',
    minHeight:
      typeof TABS_MIGRATION_CONTAINER_PROPS.minHeight === 'number'
        ? TABS_MIGRATION_CONTAINER_PROPS.minHeight
        : 160,
  },
  meta: {
    title: TABS_MIGRATION_CONTAINER_TITLE,
  },
});

const createTabPaneCanvasNode = (
  paneNodeId: string,
  tabLabel: string,
  children: string[] = []
): NodeSchema => ({
  id: paneNodeId,
  componentName: TAB_PANE_CANVAS_COMPONENT_NAME,
  props: {
    ...clone(TAB_PANE_DEFAULT_PROPS),
    tabLabel,
  },
  children,
  layout: {
    width: '100%',
    height: 'auto',
    minHeight:
      typeof TAB_PANE_DEFAULT_PROPS.minHeight === 'number'
        ? TAB_PANE_DEFAULT_PROPS.minHeight
        : 112,
  },
  meta: {
    title: `${tabLabel || '页签'}内容`,
  },
});

const collectReachableNodeIds = (
  nodes: Record<string, NodeSchema>,
  rootNodeId: string
) => {
  const visited = new Set<string>();

  const visit = (nodeId?: string) => {
    if (!nodeId || visited.has(nodeId) || !nodes[nodeId]) {
      return;
    }

    visited.add(nodeId);

    const node = nodes[nodeId];

    (node.children || []).forEach(visit);

    const slots = normalizeSlots(node.slots);
    Object.values(slots || {}).forEach(visit);
  };

  visit(rootNodeId);

  return visited;
};

const migrateExperimentalTabs = (page: PageSchema): PageSchema => {
  const nextNodes = clone(page.nodes);

  Object.values(nextNodes).forEach((node) => {
    if (node.componentName !== 'TabsMaterial') {
      return;
    }

    const items = Array.isArray(node.props?.items) ? node.props.items : [];
    const normalizedItems = items.map((item: any, index: number) => ({
      ...item,
      key: item?.key || `tab-${index + 1}`,
      label: item?.label || `页签 ${index + 1}`,
      paneId: getTabPaneSlotId(item || {}, index),
    }));
    const slots = normalizeSlots(node.slots) || {};
    const nextSlots: Record<string, string> = {};
    const orphanChildren = node.children || [];

    normalizedItems.forEach((item, index) => {
      const paneSlotId = getTabPaneSlotId(item, index);
      const legacyPaneSlotId = `pane-${item.key}`;
      const paneNodeId =
        slots[paneSlotId] || slots[legacyPaneSlotId] || createId('tab-pane');

      nextSlots[paneSlotId] = paneNodeId;

      if (!nextNodes[paneNodeId]) {
        const childrenForPane = index === 0 ? orphanChildren : [];
        nextNodes[paneNodeId] = createTabPaneCanvasNode(
          paneNodeId,
          item.label,
          childrenForPane
        );
      } else {
        nextNodes[paneNodeId] = {
          ...nextNodes[paneNodeId],
          componentName: TAB_PANE_CANVAS_COMPONENT_NAME,
          props: {
            ...clone(TAB_PANE_DEFAULT_PROPS),
            ...(nextNodes[paneNodeId].props || {}),
            tabLabel: item.label,
          },
          meta: {
            ...(nextNodes[paneNodeId].meta || {}),
            title: `${item.label}内容`,
          },
        };
      }
    });

    node.props = {
      ...node.props,
      items: normalizedItems,
    };
    node.children = [];

    if (Object.keys(nextSlots).length > 0) {
      node.slots = nextSlots;
    } else {
      delete node.slots;
    }
  });

  const reachableNodeIds = collectReachableNodeIds(nextNodes, page.rootNodeId);

  return {
    ...page,
    nodes: Object.fromEntries(
      Object.entries(nextNodes).filter(([nodeId]) => reachableNodeIds.has(nodeId))
    ),
  };
};

const DEFAULT_ROOT_PROPS = {
  title: '页面容器',
  width: '100%',
  height: 'auto',
  minHeight: 720,
  margin: [0, 0, 0, 0],
  padding: [1, 1, 1, 1],
  backgroundColor: '#ffffff',
  borderColor: '#d9d9d9',
  borderRadius: 8,
  direction: 'column',
  align: 'stretch',
  justify: 'flex-start',
  gap: 1,
};

const createEmptyPageSchema = (): PageSchema => ({
  id: 'page-1',
  name: '设计页面',
  rootNodeId: ROOT_NODE_ID,
  nodes: {
    [ROOT_NODE_ID]: {
      id: ROOT_NODE_ID,
      componentName: 'Container',
      props: clone(DEFAULT_ROOT_PROPS),
      children: [],
      layout: {
        width: '100%',
        height: 'auto',
        minHeight: 720,
      },
      meta: {
        title: '页面容器',
      },
    },
  },
});

export const createEmptyAppSchema = (): AppSchema => ({
  version: CURRENT_SCHEMA_VERSION,
  pages: [createEmptyPageSchema()],
});

const ensureRootNode = (page: PageSchema): PageSchema => {
  const existingRootId =
    page.rootNodeId && page.nodes[page.rootNodeId]
      ? page.rootNodeId
      : Object.keys(page.nodes).find((id) => page.nodes[id]?.id === ROOT_NODE_ID);

  if (!existingRootId || !page.nodes[existingRootId]) {
    return createEmptyPageSchema();
  }

  if (existingRootId === ROOT_NODE_ID) {
    return page;
  }

  const nextNodes = clone(page.nodes);
  nextNodes[ROOT_NODE_ID] = {
    ...nextNodes[existingRootId],
    id: ROOT_NODE_ID,
  };
  delete nextNodes[existingRootId];

  Object.values(nextNodes).forEach((node) => {
    if (node.children?.length) {
      node.children = node.children.map((childId) =>
        childId === existingRootId ? ROOT_NODE_ID : childId
      );
    }

    const slots = normalizeSlots(node.slots);

    if (slots) {
      node.slots = Object.fromEntries(
        Object.entries(slots).map(([slotName, childId]) => [
          slotName,
          childId === existingRootId ? ROOT_NODE_ID : childId,
        ])
      );
    } else {
      delete node.slots;
    }
  });

  return {
    ...page,
    rootNodeId: ROOT_NODE_ID,
    nodes: nextNodes,
  };
};

export const normalizeAppSchema = (input: any): AppSchema => {
  if (!input || typeof input !== 'object') {
    return createEmptyAppSchema();
  }

  const rawPage =
    Array.isArray(input.pages) && input.pages.length > 0
      ? input.pages[0]
      : createEmptyPageSchema();

  const rawNodes =
    rawPage && rawPage.nodes && typeof rawPage.nodes === 'object'
      ? rawPage.nodes
      : createEmptyPageSchema().nodes;

  const normalizedNodes = Object.fromEntries(
    Object.entries(rawNodes).map(([nodeId, nodeValue]: [string, any]) => {
      const node = nodeValue || {};
      const props =
        node.props && typeof node.props === 'object' ? clone(node.props) : {};
      const children = Array.isArray(node.children)
        ? node.children.filter(Boolean)
        : [];
      const slots = normalizeSlots(node.slots);

      const nextNode: NodeSchema = {
        id: node.id || nodeId,
        componentName: node.componentName || 'Container',
        props,
        children,
        layout:
          node.layout && typeof node.layout === 'object'
            ? clone(node.layout)
            : {
                width: typeof props.width === 'string' ? props.width : undefined,
                height: typeof props.height === 'string' ? props.height : undefined,
                minHeight:
                  typeof props.minHeight === 'number' ? props.minHeight : undefined,
              },
        meta:
          node.meta && typeof node.meta === 'object'
            ? clone(node.meta)
            : undefined,
      };

      if (slots && Object.keys(slots).length > 0) {
        nextNode.slots = slots;
      }

      return [nextNode.id, nextNode];
    })
  );

  const normalizedPage = ensureRootNode({
    id: rawPage.id || 'page-1',
    name: rawPage.name || '设计页面',
    rootNodeId: rawPage.rootNodeId || ROOT_NODE_ID,
    nodes: normalizedNodes,
  });

  Object.values(normalizedPage.nodes).forEach(compactLegacySpacing);

  const page = migrateExperimentalTabs(normalizedPage);

  return {
    version: typeof input.version === 'string' ? input.version : CURRENT_SCHEMA_VERSION,
    pages: [page],
    globalState:
      input.globalState && typeof input.globalState === 'object'
        ? clone(input.globalState)
        : undefined,
    methods: Array.isArray(input.methods) ? clone(input.methods) : undefined,
    apis: Array.isArray(input.apis) ? clone(input.apis) : undefined,
  };
};

export const appSchemaToCraftNodes = (input: AppSchema): CraftSerializedNodes => {
  const schema = normalizeAppSchema(input);
  const page = schema.pages[0];
  const parentMap = new Map<string, string | null>();

  Object.values(page.nodes).forEach((node) => {
    parentMap.set(node.id, parentMap.get(node.id) ?? null);

    node.children?.forEach((childId) => {
      parentMap.set(childId, node.id);
    });

    Object.values(normalizeSlots(node.slots) || {}).forEach((childId) => {
      parentMap.set(childId, node.id);
    });
  });

  return Object.fromEntries(
    Object.values(page.nodes).map((node) => {
      const material = getMaterialMeta(node.componentName);
      const title =
        (node.meta?.title as string) ||
        (node.props?.title as string) ||
        material?.title ||
        node.componentName;

      return [
        node.id,
        {
          type: {
            resolvedName: node.componentName,
          },
          isCanvas: CANVAS_COMPONENT_NAMES.has(node.componentName),
          props: clone(node.props || {}),
          displayName: title,
          custom: {
            displayName: title,
          },
          parent: parentMap.get(node.id) ?? null,
          nodes: clone(node.children || []),
          linkedNodes: normalizeSlots(node.slots) || {},
          hidden: false,
        },
      ];
    })
  );
};

export const craftNodesToAppSchema = (
  serializedNodes: CraftSerializedNodes,
  baseSchema?: AppSchema
): AppSchema => {
  if (!serializedNodes || typeof serializedNodes !== 'object') {
    return normalizeAppSchema(baseSchema || createEmptyAppSchema());
  }

  const fallback = normalizeAppSchema(baseSchema || createEmptyAppSchema());
  const currentPage = fallback.pages[0];

  const nodes = Object.fromEntries(
    Object.entries(serializedNodes).map(([nodeId, nodeValue]: [string, any]) => {
      const componentName =
        typeof nodeValue?.type === 'string'
          ? nodeValue.type
          : nodeValue?.type?.resolvedName || 'Container';
      const title =
        nodeValue?.custom?.displayName ||
        nodeValue?.displayName ||
        getMaterialMeta(componentName)?.title ||
        componentName;
      const props = clone(nodeValue?.props || {});
      const children = Array.isArray(nodeValue?.nodes) ? clone(nodeValue.nodes) : [];
      const linkedSlots = normalizeSlots(nodeValue?.linkedNodes);
      const allowedTabPaneSlotIds =
        componentName === 'TabsMaterial' && Array.isArray(props.items)
          ? props.items.map((item: any, index: number) =>
              getTabPaneSlotId(item || {}, index)
            )
          : null;
      const slots =
        linkedSlots && allowedTabPaneSlotIds
          ? Object.fromEntries(
              Object.entries(linkedSlots).filter(([slotId]) =>
                allowedTabPaneSlotIds.includes(slotId)
              )
            )
          : linkedSlots;

      const nextNode: NodeSchema = {
        id: nodeId,
        componentName,
        props,
        children,
        layout: {
          width: typeof props.width === 'string' ? props.width : undefined,
          height: typeof props.height === 'string' ? props.height : undefined,
          minHeight: typeof props.minHeight === 'number' ? props.minHeight : undefined,
        },
        meta: {
          title,
        },
      };

      if (slots && Object.keys(slots).length > 0) {
        nextNode.slots = slots;
      }

      return [nodeId, nextNode];
    })
  );

  return normalizeAppSchema({
    version: fallback.version,
    pages: [
      {
        id: currentPage.id,
        name: currentPage.name,
        rootNodeId: ROOT_NODE_ID,
        nodes,
      },
    ],
    globalState: fallback.globalState,
    methods: fallback.methods,
    apis: fallback.apis,
  });
};

export const parseAppSchemaText = (jsonText: string): AppSchema => {
  let parsed: any;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error('页面配置 JSON 格式不正确。');
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.pages)) {
    throw new Error('导入内容不是有效的页面配置。');
  }

  return normalizeAppSchema(parsed);
};

export const stringifyAppSchema = (schema: AppSchema) =>
  JSON.stringify(normalizeAppSchema(schema), null, 2);

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const ALL_APP_SCHEMA_STORAGE_KEYS = [
  APP_SCHEMA_STORAGE_KEY,
  ...LEGACY_APP_SCHEMA_STORAGE_KEYS,
];

export type StoredAppSchemaResult =
  | {
      schema: AppSchema;
      sourceKey: string | null;
      reset: boolean;
    }
  | null;

export const clearStoredAppSchema = (storage: StorageLike) => {
  ALL_APP_SCHEMA_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
};

export const writeStoredAppSchema = (storage: StorageLike, schema: AppSchema) => {
  storage.setItem(APP_SCHEMA_STORAGE_KEY, stringifyAppSchema(schema));
  LEGACY_APP_SCHEMA_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
};

export const readStoredAppSchema = (storage: StorageLike): StoredAppSchemaResult => {
  let hasStoredDraft = false;

  for (const key of ALL_APP_SCHEMA_STORAGE_KEYS) {
    const schemaText = storage.getItem(key);

    if (!schemaText) {
      continue;
    }

    hasStoredDraft = true;

    try {
      return {
        schema: parseAppSchemaText(schemaText),
        sourceKey: key,
        reset: false,
      };
    } catch (error) {
      storage.removeItem(key);
    }
  }

  if (!hasStoredDraft) {
    return null;
  }

  return {
    schema: createEmptyAppSchema(),
    sourceKey: null,
    reset: true,
  };
};
