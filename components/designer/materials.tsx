import { UserComponent, Element, useNode } from '@craftjs/core';
import {
  AppstoreAddOutlined,
  BorderOutlined,
  ColumnHeightOutlined,
  ColumnWidthOutlined,
  FormOutlined,
  GatewayOutlined,
  InsertRowAboveOutlined,
  LayoutOutlined,
  TableOutlined,
} from '@ant-design/icons';
import {
  Button as AntButton,
  Card,
  Col,
  Flex as AntFlex,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
} from 'antd';
import React from 'react';

export type BoxValues = [number, number, number, number];

export type SetterOption = {
  label: string;
  value: string | number | boolean;
};

export type SetterType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'select'
  | 'color'
  | 'boxModel'
  | 'tabsItems'
  | 'tableColumns'
  | 'formFields';

export type MaterialPropSchema = {
  key: string;
  title: string;
  group: '基础属性' | '布局属性' | '展示属性';
  setter: SetterType;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: SetterOption[];
};

export type MaterialMeta = {
  componentName: string;
  title: string;
  group: '布局容器' | '基础控件' | '数据展示' | '表单分组';
  icon: React.ReactNode;
  snippet: () => React.ReactElement;
  propsSchema: MaterialPropSchema[];
  allowChildren: boolean;
  component: React.ElementType;
};

export const TAB_PANE_CANVAS_COMPONENT_NAME = 'TabPaneCanvas';

type BaseBoxProps = {
  width?: string;
  height?: string;
  minHeight?: number;
  margin?: BoxValues;
  padding?: BoxValues;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  children?: React.ReactNode;
};

export type ContainerProps = BaseBoxProps & {
  title?: string;
  direction?: 'row' | 'column';
  align?: string;
  justify?: string;
  gap?: number;
};

export type RowProps = BaseBoxProps & {
  gutter?: number;
  align?: 'top' | 'middle' | 'bottom';
  justify?: 'start' | 'center' | 'end' | 'space-around' | 'space-between';
  wrap?: boolean;
};

export type ColProps = BaseBoxProps & {
  span?: number;
};

export type FlexProps = BaseBoxProps & {
  direction?: 'row' | 'column';
  align?: string;
  justify?: string;
  gap?: number;
};

export type SpaceProps = BaseBoxProps & {
  direction?: 'horizontal' | 'vertical';
  size?: number;
  wrap?: boolean;
};

export type ButtonProps = {
  text?: string;
  buttonType?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  size?: 'large' | 'middle' | 'small';
  block?: boolean;
  danger?: boolean;
  disabled?: boolean;
  width?: string;
  margin?: BoxValues;
};

export type InputProps = {
  label?: string;
  placeholder?: string;
  inputType?: 'text' | 'password' | 'textarea';
  disabled?: boolean;
  readOnly?: boolean;
  allowClear?: boolean;
  width?: string;
  margin?: BoxValues;
};

export type TabsItemSchema = {
  key: string;
  label: string;
  paneId?: string;
};

export type TabsProps = {
  items?: TabsItemSchema[];
  tabType?: 'line' | 'card';
  centered?: boolean;
  width?: string;
  margin?: BoxValues;
};

export type TabPaneCanvasProps = BaseBoxProps & {
  tabLabel?: string;
};

export type TableColumnSchema = {
  key: string;
  title: string;
  dataIndex: string;
  width?: number;
};

export type TableProps = {
  title?: string;
  columns?: TableColumnSchema[];
  rowCount?: number;
  size?: 'large' | 'middle' | 'small';
  bordered?: boolean;
  width?: string;
  margin?: BoxValues;
};

export type FormFieldSchema = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'textarea' | 'select' | 'switch';
};

export type FormGroupProps = {
  title?: string;
  fields?: FormFieldSchema[];
  width?: string;
  margin?: BoxValues;
  padding?: BoxValues;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
};

const DEFAULT_MARGIN: BoxValues = [0, 0, 0, 0];
const DEFAULT_COMPONENT_MARGIN: BoxValues = [1, 1, 1, 1];
const DEFAULT_COMPACT_PADDING: BoxValues = [1, 1, 1, 1];

const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const toBoxValue = (value?: BoxValues) => {
  const [top, right, bottom, left] = value || DEFAULT_MARGIN;
  return `${top}px ${right}px ${bottom}px ${left}px`;
};

const getBoxStyle = (
  props: BaseBoxProps,
  extraStyle: React.CSSProperties = {}
): React.CSSProperties => {
  const style: React.CSSProperties = {
    width: props.width,
    height: props.height && props.height !== 'auto' ? props.height : undefined,
    minHeight: props.minHeight,
    margin: toBoxValue(props.margin),
    padding: toBoxValue(props.padding),
    background: props.backgroundColor,
    border: props.borderColor ? `1px solid ${props.borderColor}` : undefined,
    borderRadius: props.borderRadius,
    ...extraStyle,
  };

  if (props.height === 'auto') {
    style.height = 'auto';
  }

  return style;
};

const bindCraftRef = (dom: any, connect: any, drag: any) => {
  const target =
    dom?.nativeElement || dom?.input || dom?.resizableTextArea?.textArea || dom;

  if (target) {
    connect(drag(target));
  }
};

const bindCraftDropRef = (dom: any, connect: any) => {
  const target =
    dom?.nativeElement || dom?.input || dom?.resizableTextArea?.textArea || dom;

  if (target) {
    connect(target);
  }
};

const useDropHint = () => {
  const activeTargetRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const hideHint = () => {
      activeTargetRef.current?.classList.remove('designer-drop-active');
      activeTargetRef.current = null;
    };

    window.addEventListener('drop', hideHint, true);
    window.addEventListener('dragend', hideHint, true);

    return () => {
      window.removeEventListener('drop', hideHint, true);
      window.removeEventListener('dragend', hideHint, true);
    };
  }, []);

  const showHint = (target: HTMLElement) => {
    if (activeTargetRef.current && activeTargetRef.current !== target) {
      activeTargetRef.current.classList.remove('designer-drop-active');
    }

    activeTargetRef.current = target;
    target.classList.add('designer-drop-active');
  };

  const hideHint = (target: HTMLElement) => {
    target.classList.remove('designer-drop-active');

    if (activeTargetRef.current === target) {
      activeTargetRef.current = null;
    }
  };

  const dropHintHandlers = {
    onDragEnter: (event: React.DragEvent<HTMLElement>) =>
      showHint(event.currentTarget),
    onDragOver: (event: React.DragEvent<HTMLElement>) =>
      showHint(event.currentTarget),
    onDragLeave: (event: React.DragEvent<HTMLElement>) => {
      const currentTarget = event.currentTarget;
      const nextTarget = event.relatedTarget as Node | null;

      if (!nextTarget || !currentTarget.contains(nextTarget)) {
        hideHint(currentTarget);
      }
    },
    onDrop: (event: React.DragEvent<HTMLElement>) =>
      hideHint(event.currentTarget),
  };

  return { dropHintHandlers };
};

const EmptySlot: React.FC = () => <div className="designer-empty-slot" />;

const FieldLabel: React.FC<{ text?: string }> = ({ text }) => {
  const normalizedText = typeof text === 'string' ? text.trim() : text;

  return normalizedText ? (
    <div className="designer-field-label">{normalizedText}</div>
  ) : null;
};

export const CONTAINER_DEFAULT_PROPS: ContainerProps = {
  title: '容器',
  width: '100%',
  height: 'auto',
  minHeight: 160,
  margin: DEFAULT_COMPONENT_MARGIN,
  padding: DEFAULT_COMPACT_PADDING,
  backgroundColor: '#ffffff',
  borderColor: '#d9d9d9',
  borderRadius: 8,
  direction: 'column',
  align: 'stretch',
  justify: 'flex-start',
  gap: 1,
};

export const ROW_DEFAULT_PROPS: RowProps = {
  width: '100%',
  height: 'auto',
  minHeight: 96,
  margin: DEFAULT_COMPONENT_MARGIN,
  padding: DEFAULT_COMPACT_PADDING,
  backgroundColor: '#ffffff',
  borderColor: '#d9d9d9',
  borderRadius: 8,
  gutter: 1,
  align: 'top',
  justify: 'start',
  wrap: true,
};

export const COL_DEFAULT_PROPS: ColProps = {
  span: 12,
  width: '100%',
  height: 'auto',
  minHeight: 96,
  margin: DEFAULT_COMPONENT_MARGIN,
  padding: DEFAULT_COMPACT_PADDING,
  backgroundColor: '#fafafa',
  borderColor: '#d9d9d9',
  borderRadius: 8,
};

export const FLEX_DEFAULT_PROPS: FlexProps = {
  width: '100%',
  height: 'auto',
  minHeight: 96,
  margin: DEFAULT_COMPONENT_MARGIN,
  padding: DEFAULT_COMPACT_PADDING,
  backgroundColor: '#ffffff',
  borderColor: '#d9d9d9',
  borderRadius: 8,
  direction: 'row',
  align: 'stretch',
  justify: 'flex-start',
  gap: 1,
};

export const SPACE_DEFAULT_PROPS: SpaceProps = {
  width: '100%',
  height: 'auto',
  minHeight: 72,
  margin: DEFAULT_COMPONENT_MARGIN,
  padding: DEFAULT_COMPACT_PADDING,
  backgroundColor: '#ffffff',
  borderColor: '#d9d9d9',
  borderRadius: 8,
  direction: 'horizontal',
  size: 1,
  wrap: true,
};

export const BUTTON_DEFAULT_PROPS: ButtonProps = {
  text: '按钮',
  buttonType: 'primary',
  size: 'middle',
  block: false,
  danger: false,
  disabled: false,
  width: 'auto',
  margin: DEFAULT_COMPONENT_MARGIN,
};

export const INPUT_DEFAULT_PROPS: InputProps = {
  label: '',
  placeholder: '请输入内容',
  inputType: 'text',
  disabled: false,
  readOnly: false,
  allowClear: true,
  width: '100%',
  margin: DEFAULT_COMPONENT_MARGIN,
};

export const TABS_DEFAULT_PROPS: TabsProps = {
  items: [
    { key: 'tab-1', label: '页签 1', paneId: 'pane-tab-1' },
    { key: 'tab-2', label: '页签 2', paneId: 'pane-tab-2' },
  ],
  tabType: 'line',
  centered: false,
  width: '100%',
  margin: DEFAULT_COMPONENT_MARGIN,
};

export const TAB_PANE_DEFAULT_PROPS: TabPaneCanvasProps = {
  tabLabel: '页签内容',
  width: '100%',
  height: 'auto',
  minHeight: 112,
  margin: [0, 0, 0, 0],
  padding: DEFAULT_COMPACT_PADDING,
  backgroundColor: '#ffffff',
  borderColor: '#d9d9d9',
  borderRadius: 6,
};

export const TABLE_DEFAULT_PROPS: TableProps = {
  title: '数据表格',
  columns: [
    { key: 'name', title: '名称', dataIndex: 'name', width: 180 },
    { key: 'status', title: '状态', dataIndex: 'status', width: 120 },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 140 },
  ],
  rowCount: 3,
  size: 'middle',
  bordered: true,
  width: '100%',
  margin: DEFAULT_COMPONENT_MARGIN,
};

export const FORM_GROUP_DEFAULT_PROPS: FormGroupProps = {
  title: '分组表单',
  width: '100%',
  margin: DEFAULT_COMPONENT_MARGIN,
  padding: DEFAULT_COMPACT_PADDING,
  backgroundColor: '#ffffff',
  borderColor: '#d9d9d9',
  borderRadius: 8,
  fields: [
    {
      key: 'field-name',
      label: '姓名',
      placeholder: '请输入姓名',
      type: 'text',
    },
    {
      key: 'field-dept',
      label: '部门',
      placeholder: '请选择部门',
      type: 'select',
    },
  ],
};

export const Container: UserComponent<ContainerProps> = ({
  children,
  ...props
}) => {
  const {
    connectors: { connect, drag },
    childCount,
  } = useNode((node) => ({
    childCount: node.data.nodes.length,
  }));
  const hasChildren = React.Children.count(children) > 0 || childCount > 0;
  const { dropHintHandlers } = useDropHint();

  return (
    <div
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      className="designer-surface"
      style={getBoxStyle(props, {
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <div
        {...dropHintHandlers}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: props.direction,
          alignItems: props.align,
          justifyContent: props.justify,
          gap: props.gap,
          flex: 1,
          minHeight: props.minHeight,
        }}
      >
        {hasChildren ? children : <EmptySlot />}
      </div>
    </div>
  );
};

Container.craft = {
  displayName: '容器',
  props: CONTAINER_DEFAULT_PROPS,
};

export const RowMaterial: UserComponent<RowProps> = ({ children, ...props }) => {
  const {
    connectors: { connect, drag },
    childCount,
  } = useNode((node) => ({
    childCount: node.data.nodes.length,
  }));
  const hasChildren = React.Children.count(children) > 0 || childCount > 0;
  const { dropHintHandlers } = useDropHint();

  return (
    <Row
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      {...dropHintHandlers}
      gutter={props.gutter}
      align={props.align}
      justify={props.justify}
      wrap={props.wrap}
      style={getBoxStyle(props, { position: 'relative' })}
    >
      {hasChildren ? (
        children
      ) : (
        <Col span={24}>
          <EmptySlot />
        </Col>
      )}
    </Row>
  );
};

RowMaterial.craft = {
  displayName: '栅格行',
  props: ROW_DEFAULT_PROPS,
};

export const ColMaterial: UserComponent<ColProps> = ({ children, ...props }) => {
  const {
    connectors: { connect, drag },
    childCount,
  } = useNode((node) => ({
    childCount: node.data.nodes.length,
  }));
  const hasChildren = React.Children.count(children) > 0 || childCount > 0;
  const { dropHintHandlers } = useDropHint();

  return (
    <Col
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      {...dropHintHandlers}
      span={props.span}
      style={getBoxStyle(props, { position: 'relative' })}
    >
      {hasChildren ? children : <EmptySlot />}
    </Col>
  );
};

ColMaterial.craft = {
  displayName: '栅格列',
  props: COL_DEFAULT_PROPS,
};

export const FlexMaterial: UserComponent<FlexProps> = ({
  children,
  ...props
}) => {
  const {
    connectors: { connect, drag },
    childCount,
  } = useNode((node) => ({
    childCount: node.data.nodes.length,
  }));
  const hasChildren = React.Children.count(children) > 0 || childCount > 0;
  const { dropHintHandlers } = useDropHint();

  return (
    <AntFlex
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      {...dropHintHandlers}
      vertical={props.direction === 'column'}
      align={props.align as any}
      justify={props.justify as any}
      gap={props.gap}
      style={getBoxStyle(props, { position: 'relative' })}
    >
      {hasChildren ? children : <EmptySlot />}
    </AntFlex>
  );
};

FlexMaterial.craft = {
  displayName: '弹性布局',
  props: FLEX_DEFAULT_PROPS,
};

export const SpaceMaterial: UserComponent<SpaceProps> = ({
  children,
  ...props
}) => {
  const {
    connectors: { connect, drag },
    childCount,
  } = useNode((node) => ({
    childCount: node.data.nodes.length,
  }));
  const hasChildren = React.Children.count(children) > 0 || childCount > 0;
  const { dropHintHandlers } = useDropHint();

  return (
    <Space
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      {...dropHintHandlers}
      direction={props.direction}
      size={props.size}
      wrap={props.wrap}
      style={getBoxStyle(props, { position: 'relative' })}
      className="designer-space-shell"
    >
      {hasChildren ? children : <EmptySlot />}
    </Space>
  );
};

SpaceMaterial.craft = {
  displayName: '间距容器',
  props: SPACE_DEFAULT_PROPS,
};

export const ButtonMaterial: UserComponent<ButtonProps> = ({
  text,
  buttonType,
  size,
  block,
  danger,
  disabled,
  width,
  margin,
}) => {
  const {
    connectors: { connect, drag },
  } = useNode();

  return (
    <div
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      style={{
        width: block ? width || '100%' : width,
        margin: toBoxValue(margin),
      }}
    >
      <AntButton
        type={buttonType}
        size={size}
        block={block}
        danger={danger}
        disabled={disabled}
      >
        {text}
      </AntButton>
    </div>
  );
};

ButtonMaterial.craft = {
  displayName: '按钮',
  props: BUTTON_DEFAULT_PROPS,
};

export const InputMaterial: UserComponent<InputProps> = ({
  label,
  placeholder,
  inputType,
  disabled,
  readOnly,
  allowClear,
  width,
  margin,
}) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  const normalizedLabel = typeof label === 'string' ? label.trim() : label;

  let control: React.ReactNode = null;

  if (inputType === 'textarea') {
    control = (
      <Input.TextArea
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        rows={4}
      />
    );
  } else if (inputType === 'password') {
    control = (
      <Input.Password
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
      />
    );
  } else {
    control = (
      <Input
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        allowClear={allowClear}
      />
    );
  }

  return (
    <div
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      style={{
        width,
        margin: toBoxValue(margin),
      }}
    >
      <div
        className="designer-inline-field"
        style={{
          alignItems: inputType === 'textarea' ? 'flex-start' : 'center',
        }}
      >
        {normalizedLabel ? (
          <div className="designer-inline-field__label">{normalizedLabel}</div>
        ) : null}
        <div className="designer-inline-field__control">{control}</div>
      </div>
    </div>
  );
};

InputMaterial.craft = {
  displayName: '输入框',
  props: INPUT_DEFAULT_PROPS,
};

const createTableRows = (
  columns: TableColumnSchema[] = [],
  rowCount = 3
) =>
  Array.from({ length: rowCount }).map((_, index) => {
    const row = columns.reduce<Record<string, string>>((acc, column) => {
      acc[column.dataIndex] = `${column.title}${index + 1}`;
      return acc;
    }, {});

    return {
      key: `row-${index}`,
      ...row,
    };
  });

export const getTabPaneSlotId = (item: TabsItemSchema, index = 0) =>
  item.paneId || `pane-${item.key || index + 1}`;

const normalizeTabsItems = (items?: TabsItemSchema[]) => {
  const sourceItems = items?.length ? items : TABS_DEFAULT_PROPS.items || [];

  return sourceItems.map((item, index) => ({
    ...item,
    key: item.key || `tab-${index + 1}`,
    label: item.label || `页签 ${index + 1}`,
    paneId: getTabPaneSlotId(item, index),
  }));
};

export const TabPaneCanvas: UserComponent<TabPaneCanvasProps> = ({
  children,
  ...props
}) => {
  const {
    connectors: { connect },
    childCount,
  } = useNode((node) => ({
    childCount: node.data.nodes.length,
  }));
  const hasChildren = React.Children.count(children) > 0 || childCount > 0;
  const { dropHintHandlers } = useDropHint();

  return (
    <div
      ref={(dom) => bindCraftDropRef(dom, connect)}
      {...dropHintHandlers}
      className="designer-tab-pane-canvas"
      style={getBoxStyle(props, { position: 'relative' })}
    >
      {hasChildren ? children : <EmptySlot />}
    </div>
  );
};

TabPaneCanvas.craft = {
  displayName: '页签内容',
  props: TAB_PANE_DEFAULT_PROPS,
};

export const TabsMaterial: UserComponent<TabsProps> = ({
  items,
  tabType,
  centered,
  width,
  margin,
}) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  const tabs = normalizeTabsItems(items);
  const [activeKey, setActiveKey] = React.useState<string | undefined>(
    tabs[0]?.key
  );

  React.useEffect(() => {
    if (!tabs.some((item) => item.key === activeKey)) {
      setActiveKey(tabs[0]?.key);
    }
  }, [activeKey, tabs]);

  const tabsItems = tabs.map((item) => ({
    key: item.key,
    label: item.label,
    children: (
      <Element
        id={item.paneId}
        canvas
        is={TabPaneCanvas}
        tabLabel={item.label}
        custom={{ displayName: `${item.label}内容` }}
      />
    ),
  }));

  return (
    <div
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      style={{
        width,
        margin: toBoxValue(margin),
      }}
    >
      <Tabs
        className="designer-tabs-material"
        activeKey={activeKey}
        items={tabsItems}
        type={tabType}
        centered={centered}
        onChange={setActiveKey}
      />
    </div>
  );
};

TabsMaterial.craft = {
  displayName: '页签',
  props: TABS_DEFAULT_PROPS,
};

export const TableMaterial: UserComponent<TableProps> = ({
  title,
  columns,
  rowCount,
  size,
  bordered,
  width,
  margin,
}) => {
  const {
    connectors: { connect, drag },
  } = useNode();

  const tableColumns =
    columns?.map((column) => ({
      key: column.key,
      title: column.title,
      dataIndex: column.dataIndex,
      width: column.width,
    })) || [];

  return (
    <div
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      style={{
        width,
        margin: toBoxValue(margin),
      }}
    >
      <FieldLabel text={title} />
      <Table
        columns={tableColumns as any}
        dataSource={createTableRows(columns, rowCount)}
        pagination={false}
        size={size}
        bordered={bordered}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
};

TableMaterial.craft = {
  displayName: '表格',
  props: TABLE_DEFAULT_PROPS,
};

const renderFormField = (field: FormFieldSchema) => {
  if (field.type === 'password') {
    return <Input.Password placeholder={field.placeholder} />;
  }

  if (field.type === 'textarea') {
    return <Input.TextArea placeholder={field.placeholder} rows={3} />;
  }

  if (field.type === 'select') {
    return (
      <Select
        placeholder={field.placeholder}
        options={[
          { label: '选项一', value: 'option-1' },
          { label: '选项二', value: 'option-2' },
        ]}
      />
    );
  }

  if (field.type === 'switch') {
    return <Switch />;
  }

  return <Input placeholder={field.placeholder} />;
};

export const FormGroupMaterial: UserComponent<FormGroupProps> = ({
  title,
  fields,
  width,
  margin,
  padding,
  backgroundColor,
  borderColor,
  borderRadius,
}) => {
  const {
    connectors: { connect, drag },
  } = useNode();

  return (
    <div
      ref={(dom) => bindCraftRef(dom, connect, drag)}
      style={{
        width,
        margin: toBoxValue(margin),
      }}
    >
      <Card
        size="small"
        title={title}
        styles={{
          body: {
            padding: toBoxValue(padding || DEFAULT_COMPACT_PADDING),
            background: backgroundColor,
            borderRadius,
          },
          header: {
            borderColor,
          },
        }}
        style={{
          borderColor,
          borderRadius,
        }}
      >
        <Form layout="vertical">
          {(fields || []).map((field) => (
            <Form.Item
              key={field.key}
              label={field.label}
              valuePropName={field.type === 'switch' ? 'checked' : 'value'}
            >
              {renderFormField(field)}
            </Form.Item>
          ))}
        </Form>
      </Card>
    </div>
  );
};

FormGroupMaterial.craft = {
  displayName: '分组表单',
  props: FORM_GROUP_DEFAULT_PROPS,
};

const commonContainerProps: MaterialPropSchema[] = [
  {
    key: 'width',
    title: '宽度',
    group: '布局属性',
    setter: 'text',
    placeholder: '100%',
  },
  {
    key: 'height',
    title: '高度',
    group: '布局属性',
    setter: 'text',
    placeholder: 'auto / 240px',
  },
  {
    key: 'minHeight',
    title: '最小高度',
    group: '布局属性',
    setter: 'number',
    min: 40,
  },
  {
    key: 'padding',
    title: '内边距',
    group: '布局属性',
    setter: 'boxModel',
  },
  {
    key: 'margin',
    title: '外边距',
    group: '布局属性',
    setter: 'boxModel',
  },
  {
    key: 'backgroundColor',
    title: '背景色',
    group: '展示属性',
    setter: 'color',
  },
  {
    key: 'borderColor',
    title: '边框色',
    group: '展示属性',
    setter: 'color',
  },
  {
    key: 'borderRadius',
    title: '圆角',
    group: '展示属性',
    setter: 'number',
    min: 0,
  },
];

export const MATERIAL_GROUPS = [
  { key: '布局容器', title: '布局容器' },
  { key: '基础控件', title: '基础控件' },
  { key: '数据展示', title: '数据展示' },
  { key: '表单分组', title: '表单分组' },
] as const;

export const MATERIALS: MaterialMeta[] = [
  {
    componentName: 'Container',
    title: '容器',
    group: '布局容器',
    icon: <BorderOutlined />,
    snippet: () => (
      <Element canvas is={Container} {...CONTAINER_DEFAULT_PROPS} />
    ),
    allowChildren: true,
    component: Container,
    propsSchema: [
      {
        key: 'title',
        title: '标题',
        group: '基础属性',
        setter: 'text',
        placeholder: '容器',
      },
      {
        key: 'direction',
        title: '方向',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '纵向', value: 'column' },
          { label: '横向', value: 'row' },
        ],
      },
      {
        key: 'align',
        title: '交叉轴对齐',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '拉伸', value: 'stretch' },
          { label: '起点', value: 'flex-start' },
          { label: '居中', value: 'center' },
          { label: '终点', value: 'flex-end' },
        ],
      },
      {
        key: 'justify',
        title: '主轴对齐',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '起点', value: 'flex-start' },
          { label: '居中', value: 'center' },
          { label: '终点', value: 'flex-end' },
          { label: '两端对齐', value: 'space-between' },
        ],
      },
      {
        key: 'gap',
        title: '子项间距',
        group: '布局属性',
        setter: 'number',
        min: 0,
      },
      ...commonContainerProps,
    ],
  },
  {
    componentName: 'RowMaterial',
    title: '栅格行',
    group: '布局容器',
    icon: <InsertRowAboveOutlined />,
    snippet: () => (
      <Element canvas is={RowMaterial} {...ROW_DEFAULT_PROPS} />
    ),
    allowChildren: true,
    component: RowMaterial,
    propsSchema: [
      {
        key: 'gutter',
        title: '栅格间距',
        group: '布局属性',
        setter: 'number',
        min: 0,
      },
      {
        key: 'align',
        title: '纵向对齐',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '顶部', value: 'top' },
          { label: '居中', value: 'middle' },
          { label: '底部', value: 'bottom' },
        ],
      },
      {
        key: 'justify',
        title: '横向对齐',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '左对齐', value: 'start' },
          { label: '居中', value: 'center' },
          { label: '右对齐', value: 'end' },
          { label: '两端', value: 'space-between' },
          { label: '环绕', value: 'space-around' },
        ],
      },
      {
        key: 'wrap',
        title: '自动换行',
        group: '布局属性',
        setter: 'switch',
      },
      ...commonContainerProps,
    ],
  },
  {
    componentName: 'ColMaterial',
    title: '栅格列',
    group: '布局容器',
    icon: <ColumnWidthOutlined />,
    snippet: () => (
      <Element canvas is={ColMaterial} {...COL_DEFAULT_PROPS} />
    ),
    allowChildren: true,
    component: ColMaterial,
    propsSchema: [
      {
        key: 'span',
        title: '列宽占比',
        group: '布局属性',
        setter: 'number',
        min: 1,
        max: 24,
      },
      ...commonContainerProps,
    ],
  },
  {
    componentName: 'FlexMaterial',
    title: '弹性布局',
    group: '布局容器',
    icon: <GatewayOutlined />,
    snippet: () => (
      <Element canvas is={FlexMaterial} {...FLEX_DEFAULT_PROPS} />
    ),
    allowChildren: true,
    component: FlexMaterial,
    propsSchema: [
      {
        key: 'direction',
        title: '方向',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '横向', value: 'row' },
          { label: '纵向', value: 'column' },
        ],
      },
      {
        key: 'align',
        title: '交叉轴对齐',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '拉伸', value: 'stretch' },
          { label: '起点', value: 'flex-start' },
          { label: '居中', value: 'center' },
          { label: '终点', value: 'flex-end' },
        ],
      },
      {
        key: 'justify',
        title: '主轴对齐',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '起点', value: 'flex-start' },
          { label: '居中', value: 'center' },
          { label: '终点', value: 'flex-end' },
          { label: '两端', value: 'space-between' },
        ],
      },
      {
        key: 'gap',
        title: '间距',
        group: '布局属性',
        setter: 'number',
        min: 0,
      },
      ...commonContainerProps,
    ],
  },
  {
    componentName: 'SpaceMaterial',
    title: '间距容器',
    group: '布局容器',
    icon: <LayoutOutlined />,
    snippet: () => (
      <Element canvas is={SpaceMaterial} {...SPACE_DEFAULT_PROPS} />
    ),
    allowChildren: true,
    component: SpaceMaterial,
    propsSchema: [
      {
        key: 'direction',
        title: '排列方向',
        group: '布局属性',
        setter: 'select',
        options: [
          { label: '横向', value: 'horizontal' },
          { label: '纵向', value: 'vertical' },
        ],
      },
      {
        key: 'size',
        title: '间距',
        group: '布局属性',
        setter: 'number',
        min: 0,
      },
      {
        key: 'wrap',
        title: '自动换行',
        group: '布局属性',
        setter: 'switch',
      },
      ...commonContainerProps,
    ],
  },
  {
    componentName: 'ButtonMaterial',
    title: '按钮',
    group: '基础控件',
    icon: <AppstoreAddOutlined />,
    snippet: () => <ButtonMaterial {...BUTTON_DEFAULT_PROPS} />,
    allowChildren: false,
    component: ButtonMaterial,
    propsSchema: [
      {
        key: 'text',
        title: '按钮文字',
        group: '基础属性',
        setter: 'text',
      },
      {
        key: 'buttonType',
        title: '类型',
        group: '基础属性',
        setter: 'select',
        options: [
          { label: '主按钮', value: 'primary' },
          { label: '默认', value: 'default' },
          { label: '虚线', value: 'dashed' },
          { label: '链接', value: 'link' },
          { label: '文本', value: 'text' },
        ],
      },
      {
        key: 'size',
        title: '尺寸',
        group: '基础属性',
        setter: 'select',
        options: [
          { label: '大', value: 'large' },
          { label: '中', value: 'middle' },
          { label: '小', value: 'small' },
        ],
      },
      {
        key: 'block',
        title: '撑满宽度',
        group: '布局属性',
        setter: 'switch',
      },
      {
        key: 'width',
        title: '宽度',
        group: '布局属性',
        setter: 'text',
        placeholder: 'auto / 240px / 100%',
      },
      {
        key: 'margin',
        title: '外边距',
        group: '布局属性',
        setter: 'boxModel',
      },
      {
        key: 'danger',
        title: '危险态',
        group: '展示属性',
        setter: 'switch',
      },
      {
        key: 'disabled',
        title: '禁用',
        group: '展示属性',
        setter: 'switch',
      },
    ],
  },
  {
    componentName: 'InputMaterial',
    title: '输入框',
    group: '基础控件',
    icon: <ColumnHeightOutlined />,
    snippet: () => <InputMaterial {...INPUT_DEFAULT_PROPS} />,
    allowChildren: false,
    component: InputMaterial,
    propsSchema: [
      {
        key: 'label',
        title: '字段标题',
        group: '基础属性',
        setter: 'text',
      },
      {
        key: 'placeholder',
        title: '占位提示',
        group: '基础属性',
        setter: 'text',
      },
      {
        key: 'inputType',
        title: '输入类型',
        group: '基础属性',
        setter: 'select',
        options: [
          { label: '单行输入', value: 'text' },
          { label: '密码输入', value: 'password' },
          { label: '多行输入', value: 'textarea' },
        ],
      },
      {
        key: 'width',
        title: '宽度',
        group: '布局属性',
        setter: 'text',
        placeholder: '100%',
      },
      {
        key: 'margin',
        title: '外边距',
        group: '布局属性',
        setter: 'boxModel',
      },
      {
        key: 'allowClear',
        title: '允许清空',
        group: '展示属性',
        setter: 'switch',
      },
      {
        key: 'disabled',
        title: '禁用',
        group: '展示属性',
        setter: 'switch',
      },
      {
        key: 'readOnly',
        title: '只读',
        group: '展示属性',
        setter: 'switch',
      },
    ],
  },
  {
    componentName: 'TabsMaterial',
    title: '页签',
    group: '数据展示',
    icon: <LayoutOutlined />,
    snippet: () => <TabsMaterial {...TABS_DEFAULT_PROPS} />,
    allowChildren: false,
    component: TabsMaterial,
    propsSchema: [
      {
        key: 'items',
        title: '页签项',
        group: '基础属性',
        setter: 'tabsItems',
      },
      {
        key: 'tabType',
        title: '页签样式',
        group: '展示属性',
        setter: 'select',
        options: [
          { label: '线条', value: 'line' },
          { label: '卡片', value: 'card' },
        ],
      },
      {
        key: 'centered',
        title: '标题居中',
        group: '展示属性',
        setter: 'switch',
      },
      {
        key: 'width',
        title: '宽度',
        group: '布局属性',
        setter: 'text',
        placeholder: '100%',
      },
      {
        key: 'margin',
        title: '外边距',
        group: '布局属性',
        setter: 'boxModel',
      },
    ],
  },
  {
    componentName: 'TableMaterial',
    title: '表格',
    group: '数据展示',
    icon: <TableOutlined />,
    snippet: () => <TableMaterial {...TABLE_DEFAULT_PROPS} />,
    allowChildren: false,
    component: TableMaterial,
    propsSchema: [
      {
        key: 'title',
        title: '标题',
        group: '基础属性',
        setter: 'text',
      },
      {
        key: 'columns',
        title: '列配置',
        group: '基础属性',
        setter: 'tableColumns',
      },
      {
        key: 'rowCount',
        title: '示例行数',
        group: '基础属性',
        setter: 'number',
        min: 1,
      },
      {
        key: 'width',
        title: '宽度',
        group: '布局属性',
        setter: 'text',
        placeholder: '100%',
      },
      {
        key: 'margin',
        title: '外边距',
        group: '布局属性',
        setter: 'boxModel',
      },
      {
        key: 'size',
        title: '尺寸',
        group: '展示属性',
        setter: 'select',
        options: [
          { label: '大', value: 'large' },
          { label: '中', value: 'middle' },
          { label: '小', value: 'small' },
        ],
      },
      {
        key: 'bordered',
        title: '显示边框',
        group: '展示属性',
        setter: 'switch',
      },
    ],
  },
  {
    componentName: 'FormGroupMaterial',
    title: '分组表单',
    group: '表单分组',
    icon: <FormOutlined />,
    snippet: () => <FormGroupMaterial {...FORM_GROUP_DEFAULT_PROPS} />,
    allowChildren: false,
    component: FormGroupMaterial,
    propsSchema: [
      {
        key: 'title',
        title: '标题',
        group: '基础属性',
        setter: 'text',
      },
      {
        key: 'fields',
        title: '字段列表',
        group: '基础属性',
        setter: 'formFields',
      },
      {
        key: 'width',
        title: '宽度',
        group: '布局属性',
        setter: 'text',
        placeholder: '100%',
      },
      {
        key: 'margin',
        title: '外边距',
        group: '布局属性',
        setter: 'boxModel',
      },
      {
        key: 'padding',
        title: '内边距',
        group: '布局属性',
        setter: 'boxModel',
      },
      {
        key: 'backgroundColor',
        title: '背景色',
        group: '展示属性',
        setter: 'color',
      },
      {
        key: 'borderColor',
        title: '边框色',
        group: '展示属性',
        setter: 'color',
      },
      {
        key: 'borderRadius',
        title: '圆角',
        group: '展示属性',
        setter: 'number',
        min: 0,
      },
    ],
  },
];

export const MATERIAL_MAP = Object.fromEntries(
  MATERIALS.map((material) => [material.componentName, material])
) as Record<string, MaterialMeta>;

export const MATERIAL_TITLE_MAP = Object.fromEntries(
  MATERIALS.map((material) => [material.componentName, material.title])
) as Record<string, string>;

export const CANVAS_COMPONENT_NAMES = new Set(
  [
    ...MATERIALS.filter((material) => material.allowChildren).map(
      (material) => material.componentName
    ),
    TAB_PANE_CANVAS_COMPONENT_NAME,
  ]
);

export const getMaterialMeta = (componentName?: string) =>
  componentName ? MATERIAL_MAP[componentName] : undefined;

export const DESIGNER_RESOLVER = {
  Container,
  RowMaterial,
  ColMaterial,
  FlexMaterial,
  SpaceMaterial,
  ButtonMaterial,
  InputMaterial,
  TabsMaterial,
  TabPaneCanvas,
  TableMaterial,
  FormGroupMaterial,
};

export const createDefaultTabsItem = (): TabsItemSchema => ({
  key: createId('tab'),
  label: '新页签',
  paneId: createId('pane'),
});

export const createDefaultTableColumn = (): TableColumnSchema => ({
  key: createId('column'),
  title: '新列',
  dataIndex: createId('field'),
  width: 160,
});

export const createDefaultFormField = (): FormFieldSchema => ({
  key: createId('field'),
  label: '新字段',
  placeholder: '请输入',
  type: 'text',
});
