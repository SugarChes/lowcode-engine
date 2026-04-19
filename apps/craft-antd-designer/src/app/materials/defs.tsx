import React from 'react';
import { Element, useEditor, useNode } from '@craftjs/core';
import { Button, Card, Col as AntdCol, Flex as AntdFlex, Input, Row as AntdRow, Space, Table, Tabs, Typography } from 'antd';
import type { MaterialMeta, PropFieldConfig } from '../schema/types';

type NodeFrameProps = {
  title: string;
  children?: React.ReactNode;
  canvas?: boolean;
  slot?: boolean;
  suppressDrag?: boolean;
  compact?: boolean;
  tight?: boolean;
  inline?: boolean;
};

export const MATERIAL_DND_TYPE = 'application/x-craft-antd-material';

function NodeFrame({ title, children, canvas, slot, suppressDrag, compact, tight, inline }: NodeFrameProps) {
  const { id, connectors, hidden, hovered, isRoot } = useNode((node) => ({
    hovered: node.events.hovered,
    hidden: node.data.hidden,
    isRoot: !node.data.parent,
  }));
  const { actions, query } = useEditor();
  const [isMaterialOver, setIsMaterialOver] = React.useState(false);
  const shellClassName = [
    'node-shell',
    canvas ? 'node-shell--canvas' : '',
    slot ? 'node-shell--slot' : '',
    isRoot ? 'node-shell--root' : '',
    tight ? 'node-shell--tight' : '',
    inline ? 'node-shell--inline' : '',
    hovered ? 'node-shell--hovered' : '',
    isMaterialOver ? 'node-shell--drop-target' : '',
    hidden ? 'node-shell--hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isExternalMaterialDrag = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => Array.from(event.dataTransfer?.types || []).includes(MATERIAL_DND_TYPE),
    [],
  );

  const insertDroppedSnippet = React.useCallback(
    (componentName: string) => {
      if (!canvas) return;
      const targetNode = query.node(id).get();
      const nextIndex = targetNode.data.nodes.length;
      const tree = query.parseReactElement(createSnippet(componentName)).toNodeTree();

      actions.addNodeTree(tree, id, nextIndex);
      actions.selectNode(tree.rootNodeId);
    },
    [actions, canvas, id, query],
  );

  return (
    <div
      ref={(dom) => {
        if (!dom) return;
        connectors.connect(dom);
      }}
      className={shellClassName}
      data-node-title={title}
      data-node-draggable={suppressDrag ? 'false' : 'true'}
      onDragEnter={(event) => {
        if (!canvas || !isExternalMaterialDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setIsMaterialOver(true);
      }}
      onDragOver={(event) => {
        if (!canvas || !isExternalMaterialDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        setIsMaterialOver(true);
      }}
      onDragLeave={(event) => {
        if (!canvas || !isExternalMaterialDrag(event)) return;
        event.stopPropagation();
        setIsMaterialOver(false);
      }}
      onDrop={(event) => {
        if (!canvas || !isExternalMaterialDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setIsMaterialOver(false);

        const componentName = event.dataTransfer.getData(MATERIAL_DND_TYPE);
        if (!componentName) return;

        insertDroppedSnippet(componentName);
      }}
    >
      <div
        className={`node-shell__content ${
          tight ? 'node-shell__content--tight' : compact ? 'node-shell__content--compact' : 'node-shell__content--regular'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function EmptyCanvasHint({ label }: { label: string }) {
  return <div className="empty-canvas-hint">{label}</div>;
}

type BaseProps = {
  style?: React.CSSProperties;
  children?: React.ReactNode;
  title?: string;
};

export function CanvasRoot(props: BaseProps) {
  const children = React.Children.count(props.children) ? props.children : <EmptyCanvasHint label="请将布局组件拖到这里" />;
  return (
    <NodeFrame title={props.title || '画布'} canvas suppressDrag>
      <div className="canvas-root" style={props.style}>
        <div className="canvas-root__inner">{children}</div>
      </div>
    </NodeFrame>
  );
}

CanvasRoot.craft = {
  displayName: 'CanvasRoot',
  isCanvas: true,
  props: {
    title: '页面画布',
    style: {
      minHeight: '65vh',
      padding: '8px',
    },
  },
  custom: {
    locked: true,
    eventFlows: [],
  },
  rules: {
    canDrag: () => false,
  },
};

export function SlotCanvas(props: BaseProps & { slotTitle?: string }) {
  const children = React.Children.count(props.children) ? props.children : <EmptyCanvasHint label="请将标签页内容拖到这里" />;
  return (
    <NodeFrame title={props.slotTitle || '插槽'} canvas slot suppressDrag compact>
      <div className="slot-canvas">{children}</div>
    </NodeFrame>
  );
}

SlotCanvas.craft = {
  displayName: 'SlotCanvas',
  isCanvas: true,
  props: {
    slotTitle: '插槽',
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

export function Container(props: BaseProps) {
  const children = React.Children.count(props.children) ? props.children : <EmptyCanvasHint label="请将组件拖入这个容器" />;
  return (
    <NodeFrame title={props.title || '容器'} canvas>
      <div style={props.style}>{children}</div>
    </NodeFrame>
  );
}

Container.craft = {
  displayName: 'Container',
  isCanvas: true,
  props: {
    title: '容器',
    style: {
      padding: '16px',
      backgroundColor: '#ffffff',
      borderRadius: '6px',
      minHeight: '120px',
    },
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

export function Row(props: BaseProps & { gutter?: number }) {
  const children = React.Children.count(props.children) ? props.children : <EmptyCanvasHint label="请将列拖到这里" />;
  return (
    <NodeFrame title="行布局" canvas>
      <AntdRow gutter={props.gutter || 16} style={props.style}>
        {children}
      </AntdRow>
    </NodeFrame>
  );
}

Row.craft = {
  displayName: 'Row',
  isCanvas: true,
  props: {
    gutter: 16,
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
  rules: {
    canMoveIn: (incomingNodes: any[]) => incomingNodes.every((node) => node.data.name === 'Col'),
  },
};

export function Col(props: BaseProps & { span?: number }) {
  const children = React.Children.count(props.children) ? props.children : <EmptyCanvasHint label="请将内容拖到这里" />;
  return (
    <NodeFrame title={`列 ${props.span || 24}`} canvas compact>
      <AntdCol span={props.span || 24} style={props.style}>
        {children}
      </AntdCol>
    </NodeFrame>
  );
}

Col.craft = {
  displayName: 'Col',
  isCanvas: true,
  props: {
    span: 12,
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

export function Flex(props: BaseProps & { gap?: number; justify?: React.CSSProperties['justifyContent']; align?: React.CSSProperties['alignItems']; vertical?: boolean }) {
  const children = React.Children.count(props.children) ? props.children : <EmptyCanvasHint label="请将内容拖入这个弹性布局" />;
  return (
    <NodeFrame title="寮规€у竷灞€" canvas>
      <AntdFlex gap={props.gap || 12} justify={props.justify} align={props.align} vertical={props.vertical} style={props.style}>
        {children}
      </AntdFlex>
    </NodeFrame>
  );
}

Flex.craft = {
  displayName: 'Flex',
  isCanvas: true,
  props: {
    gap: 12,
    justify: 'flex-start',
    align: 'stretch',
    vertical: false,
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

export function SpaceNode(props: BaseProps & { size?: number; direction?: 'horizontal' | 'vertical' }) {
  const children = React.Children.count(props.children) ? props.children : <EmptyCanvasHint label="请将内容拖入这个间距布局" />;
  return (
    <NodeFrame title="闂磋窛甯冨眬" canvas>
      <Space size={props.size || 12} direction={props.direction || 'horizontal'} style={props.style}>
        {children}
      </Space>
    </NodeFrame>
  );
}

SpaceNode.craft = {
  displayName: 'SpaceNode',
  isCanvas: true,
  props: {
    size: 12,
    direction: 'horizontal',
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

export function FormGroup(props: BaseProps & { showSubmitButton?: boolean; submitText?: string }) {
  const children = React.Children.count(props.children) ? props.children : <EmptyCanvasHint label="请将表单字段拖到这里" />;
  return (
    <NodeFrame title={props.title || '琛ㄥ崟鍒嗙粍'} canvas>
      <Card size="small" bordered={false} styles={{ body: { padding: 0 } }}>
        <Space direction="vertical" size={12} style={{ width: '100%', ...(props.style || {}) }}>
          {children}
          {props.showSubmitButton ? <Button type="primary">{props.submitText || '提交'}</Button> : null}
        </Space>
      </Card>
    </NodeFrame>
  );
}

FormGroup.craft = {
  displayName: 'FormGroup',
  isCanvas: true,
  props: {
    title: '琛ㄥ崟鍒嗙粍',
    showSubmitButton: true,
    submitText: '鎻愪氦',
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

export function ButtonNode(props: { label?: string; buttonType?: 'default' | 'primary' | 'dashed' | 'link' | 'text'; size?: 'small' | 'middle' | 'large'; block?: boolean; danger?: boolean; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <NodeFrame title="按钮" tight inline>
      <Button
        type={props.buttonType || 'default'}
        size={props.size || 'middle'}
        block={props.block}
        danger={props.danger}
        disabled={props.disabled}
        style={props.style}
      >
        {props.label || '鎸夐挳'}
      </Button>
    </NodeFrame>
  );
}

ButtonNode.craft = {
  displayName: 'Button',
  props: {
    label: '鎸夐挳',
    buttonType: 'default',
    size: 'middle',
    block: false,
    danger: false,
    disabled: false,
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

export function InputNode(props: { placeholder?: string; value?: string; allowClear?: boolean; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <NodeFrame title="输入框" tight>
      <Input
        placeholder={props.placeholder}
        value={props.value as string | undefined}
        allowClear={props.allowClear}
        disabled={props.disabled}
        style={props.style}
        readOnly
      />
    </NodeFrame>
  );
}

InputNode.craft = {
  displayName: 'Input',
  props: {
    placeholder: '请输入内容',
    value: '',
    allowClear: true,
    disabled: false,
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

type TabsItem = { key: string; label: string };

export function TabsNode(props: { items?: TabsItem[]; activeKey?: string; style?: React.CSSProperties }) {
  const items = props.items?.length ? props.items : [{ key: 'tab-1', label: '概览' }, { key: 'tab-2', label: '详情' }];
  return (
    <NodeFrame title="标签页" tight>
      <Tabs
        activeKey={props.activeKey || items[0].key}
        items={items.map((item) => ({
          key: item.key,
          label: item.label,
          children: (
            <Element
              id={`slot:${item.key}`}
              is={SlotCanvas}
              canvas
              slotTitle={item.label}
            />
          ),
        }))}
        style={props.style}
      />
    </NodeFrame>
  );
}

TabsNode.craft = {
  displayName: 'Tabs',
  props: {
    items: [
      { key: 'tab-1', label: '姒傝' },
      { key: 'tab-2', label: '璇︽儏' },
    ],
    activeKey: 'tab-1',
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
  rules: {
    canMoveIn: () => false,
  },
};

export function TableNode(props: { title?: string; columns?: Array<Record<string, unknown>>; dataSource?: Array<Record<string, unknown>>; pagination?: boolean; style?: React.CSSProperties }) {
  return (
    <NodeFrame title={props.title || '表格'} tight>
      <Table
        size="small"
        columns={(props.columns as any[]) || []}
        dataSource={(props.dataSource as any[]) || []}
        pagination={props.pagination ? { pageSize: 5 } : false}
        style={props.style}
      />
    </NodeFrame>
  );
}

TableNode.craft = {
  displayName: 'Table',
  props: {
    title: '表格',
    columns: [{ title: '名称', dataIndex: 'name', key: 'name' }],
    dataSource: [{ key: '1', name: '示例行' }],
    pagination: false,
    style: {},
  },
  custom: {
    locked: false,
    eventFlows: [],
  },
};

const sharedStyleFields: PropFieldConfig[] = [
  { path: 'style.width', label: '瀹藉害', type: 'text', section: 'style' as const },
  { path: 'style.minHeight', label: '最小高度', type: 'text', section: 'style' as const },
  { path: 'style.padding', label: '内边距', type: 'text', section: 'style' as const },
  { path: 'style.marginTop', label: '上边距', type: 'text', section: 'style' as const },
  { path: 'style.backgroundColor', label: '背景色', type: 'color', section: 'style' as const },
];

export const materialMetas: MaterialMeta[] = [
  {
    componentName: 'Container',
    title: '容器',
    group: '布局',
    icon: '[]',
    snippetTitle: '卡片容器',
    isCanvas: true,
    propsSchema: [
      { path: 'title', label: '标题', type: 'text', section: 'props' },
      ...sharedStyleFields,
    ],
    events: [],
  },
  {
    componentName: 'Row',
    title: '行布局',
    group: '布局',
    icon: '||',
    snippetTitle: '栅格行',
    isCanvas: true,
    propsSchema: [
      { path: 'gutter', label: '间距', type: 'number', section: 'props', min: 0, step: 4 },
      ...sharedStyleFields,
    ],
    events: [],
    nestingRule: {
      allowedChildren: ['Col'],
    },
  },
  {
    componentName: 'Col',
    title: '列',
    group: '布局',
    icon: '|:',
    snippetTitle: '栅格列',
    isCanvas: true,
    propsSchema: [
      { path: 'span', label: '栅格占比', type: 'number', section: 'props', min: 1, max: 24, step: 1 },
      ...sharedStyleFields,
    ],
    events: [],
  },
  {
    componentName: 'Flex',
    title: '弹性布局',
    group: '布局',
    icon: '<>',
    snippetTitle: '弹性布局',
    isCanvas: true,
    propsSchema: [
      { path: 'gap', label: '间距', type: 'number', section: 'props', min: 0, step: 4 },
      {
        path: 'justify',
        label: '主轴对齐',
        type: 'select',
        section: 'props',
        options: [
          { label: '起始', value: 'flex-start' },
          { label: '居中', value: 'center' },
          { label: '结束', value: 'flex-end' },
          { label: '两端对齐', value: 'space-between' },
        ],
      },
      {
        path: 'align',
        label: '交叉轴对齐',
        type: 'select',
        section: 'props',
        options: [
          { label: '拉伸', value: 'stretch' },
          { label: '居中', value: 'center' },
          { label: '起始', value: 'flex-start' },
          { label: '结束', value: 'flex-end' },
        ],
      },
      { path: 'vertical', label: '纵向排列', type: 'bool', section: 'props' },
      ...sharedStyleFields,
    ],
    events: [],
  },
  {
    componentName: 'SpaceNode',
    title: '间距布局',
    group: '布局',
    icon: '::',
    snippetTitle: '行内间距',
    isCanvas: true,
    propsSchema: [
      { path: 'size', label: '间距', type: 'number', section: 'props', min: 0, step: 4 },
      {
        path: 'direction',
        label: '方向',
        type: 'select',
        section: 'props',
        options: [
          { label: '横向', value: 'horizontal' },
          { label: '纵向', value: 'vertical' },
        ],
      },
      ...sharedStyleFields,
    ],
    events: [],
  },
  {
    componentName: 'Button',
    title: '按钮',
    group: '基础控件',
    icon: 'B',
    snippetTitle: '操作按钮',
    propsSchema: [
      { path: 'label', label: '文案', type: 'text', section: 'props' },
      {
        path: 'buttonType',
        label: '绫诲瀷',
        type: 'select',
        section: 'props',
        options: [
          { label: '默认', value: 'default' },
          { label: '主要', value: 'primary' },
          { label: '铏氱嚎', value: 'dashed' },
          { label: '文本', value: 'text' },
          { label: '链接', value: 'link' },
        ],
      },
      {
        path: 'size',
        label: '尺寸',
        type: 'select',
        section: 'props',
        options: [
          { label: '小', value: 'small' },
          { label: '中', value: 'middle' },
          { label: '大', value: 'large' },
        ],
      },
      { path: 'block', label: '撑满宽度', type: 'bool', section: 'props' },
      { path: 'danger', label: '危险态', type: 'bool', section: 'props' },
      { path: 'disabled', label: '禁用', type: 'bool', section: 'advanced' },
      ...sharedStyleFields,
    ],
    events: [{ name: 'onClick', label: '点击', params: [] }],
  },
  {
    componentName: 'Input',
    title: '输入框',
    group: '基础控件',
    icon: 'I',
    snippetTitle: '文本输入',
    propsSchema: [
      { path: 'placeholder', label: '占位提示', type: 'text', section: 'props' },
      { path: 'value', label: '值', type: 'text', section: 'props' },
      { path: 'allowClear', label: '允许清空', type: 'bool', section: 'props' },
      { path: 'disabled', label: '禁用', type: 'bool', section: 'advanced' },
      ...sharedStyleFields,
    ],
    events: [{ name: 'onChange', label: '值变化', params: ['value'] }],
  },
  {
    componentName: 'Tabs',
    title: '标签页',
    group: '复杂控件',
    icon: '=',
    snippetTitle: '标签面板',
    propsSchema: [
      { path: 'items', label: '标签项', type: 'json', section: 'props', rows: 8 },
      { path: 'activeKey', label: '当前标签 Key', type: 'text', section: 'props' },
      ...sharedStyleFields,
    ],
    events: [{ name: 'onTabChange', label: '标签切换', params: ['activeKey'] }],
  },
  {
    componentName: 'Table',
    title: '表格',
    group: '复杂控件',
    icon: '#',
    snippetTitle: '数据表格',
    propsSchema: [
      { path: 'title', label: '标题', type: 'text', section: 'props' },
      { path: 'columns', label: '列配置', type: 'json', section: 'props', rows: 10 },
      { path: 'dataSource', label: '数据源', type: 'json', section: 'props', rows: 10 },
      { path: 'pagination', label: '分页', type: 'bool', section: 'props' },
      ...sharedStyleFields,
    ],
    events: [{ name: 'onSelectRow', label: '选择行', params: ['selectedRowKeys', 'selectedRows'] }],
  },
  {
    componentName: 'FormGroup',
    title: '表单分组',
    group: '复杂控件',
    icon: 'F',
    snippetTitle: '分组表单',
    isCanvas: true,
    propsSchema: [
      { path: 'title', label: '标题', type: 'text', section: 'props' },
      { path: 'showSubmitButton', label: '显示提交按钮', type: 'bool', section: 'props' },
      { path: 'submitText', label: '提交按钮文案', type: 'text', section: 'props' },
      ...sharedStyleFields,
    ],
    events: [{ name: 'onSubmit', label: '提交', params: ['values'] }],
  },
];

export const materialMetaMap = Object.fromEntries(materialMetas.map((meta) => [meta.componentName, meta]));

export const resolver = {
  CanvasRoot,
  SlotCanvas,
  Container,
  Row,
  Col,
  Flex,
  SpaceNode,
  Button: ButtonNode,
  Input: InputNode,
  Tabs: TabsNode,
  Table: TableNode,
  FormGroup,
};

export function createSnippet(componentName: string): React.ReactElement {
  switch (componentName) {
    case 'Container':
      return (
        <Element is={Container} canvas title="瀹瑰櫒" style={{ padding: '16px', backgroundColor: '#ffffff', minHeight: '120px' }} />
      );
    case 'Row':
      return (
        <Element is={Row} canvas gutter={16}>
          <Element is={Col} canvas span={12}>
            <Element is={Container} canvas title="左侧区域" style={{ minHeight: '96px', padding: '12px' }} />
          </Element>
          <Element is={Col} canvas span={12}>
            <Element is={Container} canvas title="右侧区域" style={{ minHeight: '96px', padding: '12px' }} />
          </Element>
        </Element>
      );
    case 'Col':
      return (
        <Element is={Col} canvas span={12}>
          <Element is={Container} canvas title="列内容" style={{ minHeight: '96px', padding: '12px' }} />
        </Element>
      );
    case 'Flex':
      return (
        <Element is={Flex} canvas gap={12}>
          <Element is={ButtonNode} label="主要按钮" buttonType="primary" />
          <Element is={ButtonNode} label="次要按钮" />
        </Element>
      );
    case 'SpaceNode':
      return (
        <Element is={SpaceNode} canvas size={12}>
          <Element is={ButtonNode} label="左侧按钮" />
          <Element is={ButtonNode} label="右侧按钮" />
        </Element>
      );
    case 'Button':
      return <Element is={ButtonNode} label="按钮" buttonType="primary" />;
    case 'Input':
      return <Element is={InputNode} placeholder="请输入内容" />;
    case 'Tabs':
      return (
        <Element
          is={TabsNode}
          items={[
            { key: 'tab-1', label: '概览' },
            { key: 'tab-2', label: '详情' },
          ]}
          activeKey="tab-1"
        />
      );
    case 'Table':
      return (
        <Element
          is={TableNode}
          title="表格"
          columns={[
            { title: '姓名', dataIndex: 'name', key: 'name' },
            { title: '角色', dataIndex: 'role', key: 'role' },
          ]}
          dataSource={[
            { key: '1', name: '林青', role: '管理员' },
            { key: '2', name: '王澜', role: '分析师' },
          ]}
          pagination={false}
        />
      );
    case 'FormGroup':
      return (
          <Element is={FormGroup} canvas title="表单分组" showSubmitButton submitText="提交">
          <Element is={InputNode} placeholder="字段 A" />
          <Element is={InputNode} placeholder="字段 B" />
        </Element>
      );
    default:
      return <Element is={Container} canvas title="容器" />;
  }
}

export function describeMaterial(componentName: string) {
  return materialMetaMap[componentName] || {
    componentName,
    title: componentName,
    group: '自定义',
    icon: '?',
    snippetTitle: componentName,
    propsSchema: [],
    events: [],
  };
}

export function MaterialBadge({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="material-badge">
      <span className="material-badge__icon">{icon}</span>
      <Typography.Text className="material-badge__title">{title}</Typography.Text>
    </div>
  );
}
