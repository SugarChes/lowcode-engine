import { useEditor } from '@craftjs/core';
import {
  Button,
  Collapse,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import React, { useMemo } from 'react';

import {
  BoxValues,
  createDefaultFormField,
  createDefaultTableColumn,
  createDefaultTabsItem,
  FormFieldSchema,
  getMaterialMeta,
  MaterialPropSchema,
  TableColumnSchema,
  TabsItemSchema,
} from './materials';

const SECTION_ORDER = ['基础属性', '布局属性', '展示属性'] as const;

const normalizeBoxValues = (value: any): BoxValues => {
  if (Array.isArray(value) && value.length === 4) {
    return value.map((item) => Number(item) || 0) as BoxValues;
  }

  return [0, 0, 0, 0];
};

const ColorInput: React.FC<{
  value?: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <div className="designer-color-input">
    <input
      type="color"
      value={value || '#1677ff'}
      onChange={(event) => onChange(event.target.value)}
    />
    <Input value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
);

const BoxModelEditor: React.FC<{
  value?: BoxValues;
  onChange: (nextValue: BoxValues) => void;
}> = ({ value, onChange }) => {
  const boxValue = normalizeBoxValues(value);
  const labels = ['上', '右', '下', '左'];

  return (
    <div className="designer-box-grid">
      {labels.map((label, index) => (
        <div key={label} className="designer-box-grid__item">
          <span className="designer-box-grid__label">{label}</span>
          <InputNumber
            min={0}
            value={boxValue[index]}
            onChange={(nextValue) => {
              const newValue = [...boxValue] as BoxValues;
              newValue[index] = Number(nextValue) || 0;
              onChange(newValue);
            }}
            style={{ width: '100%' }}
          />
        </div>
      ))}
    </div>
  );
};

const ListSectionTitle: React.FC<{
  title: string;
  onAdd: () => void;
  buttonText: string;
}> = ({ title, onAdd, buttonText }) => (
  <div className="designer-list-header">
    <span>{title}</span>
    <Button type="link" size="small" onClick={onAdd}>
      {buttonText}
    </Button>
  </div>
);

const TabsItemsEditor: React.FC<{
  value?: TabsItemSchema[];
  onChange: (nextValue: TabsItemSchema[]) => void;
}> = ({ value, onChange }) => {
  const items = value || [];

  return (
    <div className="designer-list-stack">
      <ListSectionTitle
        title="页签项"
        buttonText="新增页签"
        onAdd={() => onChange([...items, createDefaultTabsItem()])}
      />
      {items.map((item, index) => (
        <div key={item.paneId || item.key} className="designer-list-card">
          <Input
            addonBefore="标题"
            value={item.label}
            onChange={(event) => {
              const nextItems = [...items];
              nextItems[index] = {
                ...item,
                label: event.target.value,
              };
              onChange(nextItems);
            }}
          />
          <Input
            addonBefore="标识"
            value={item.key}
            onChange={(event) => {
              const nextItems = [...items];
              nextItems[index] = {
                ...item,
                key: event.target.value,
              };
              onChange(nextItems);
            }}
          />
          <div className="designer-list-card__actions">
            <Button
              danger
              size="small"
              onClick={() => onChange(items.filter((_, current) => current !== index))}
            >
              删除
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无页签项" />
      ) : null}
    </div>
  );
};

const TableColumnsEditor: React.FC<{
  value?: TableColumnSchema[];
  onChange: (nextValue: TableColumnSchema[]) => void;
}> = ({ value, onChange }) => {
  const columns = value || [];

  return (
    <div className="designer-list-stack">
      <ListSectionTitle
        title="列配置"
        buttonText="新增列"
        onAdd={() => onChange([...columns, createDefaultTableColumn()])}
      />
      {columns.map((column, index) => (
        <div key={column.key} className="designer-list-card">
          <Input
            addonBefore="标题"
            value={column.title}
            onChange={(event) => {
              const nextColumns = [...columns];
              nextColumns[index] = {
                ...column,
                title: event.target.value,
              };
              onChange(nextColumns);
            }}
          />
          <Input
            addonBefore="字段"
            value={column.dataIndex}
            onChange={(event) => {
              const nextColumns = [...columns];
              nextColumns[index] = {
                ...column,
                dataIndex: event.target.value,
              };
              onChange(nextColumns);
            }}
          />
          <InputNumber
            min={60}
            value={column.width}
            onChange={(nextValue) => {
              const nextColumns = [...columns];
              nextColumns[index] = {
                ...column,
                width: Number(nextValue) || 120,
              };
              onChange(nextColumns);
            }}
            style={{ width: '100%' }}
          />
          <div className="designer-list-card__actions">
            <Button
              danger
              size="small"
              onClick={() =>
                onChange(columns.filter((_, current) => current !== index))
              }
            >
              删除
            </Button>
          </div>
        </div>
      ))}
      {columns.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无列配置" />
      ) : null}
    </div>
  );
};

const FormFieldsEditor: React.FC<{
  value?: FormFieldSchema[];
  onChange: (nextValue: FormFieldSchema[]) => void;
}> = ({ value, onChange }) => {
  const fields = value || [];

  return (
    <div className="designer-list-stack">
      <ListSectionTitle
        title="字段列表"
        buttonText="新增字段"
        onAdd={() => onChange([...fields, createDefaultFormField()])}
      />
      {fields.map((field, index) => (
        <div key={field.key} className="designer-list-card">
          <Input
            addonBefore="标签"
            value={field.label}
            onChange={(event) => {
              const nextFields = [...fields];
              nextFields[index] = {
                ...field,
                label: event.target.value,
              };
              onChange(nextFields);
            }}
          />
          <Input
            addonBefore="占位"
            value={field.placeholder}
            onChange={(event) => {
              const nextFields = [...fields];
              nextFields[index] = {
                ...field,
                placeholder: event.target.value,
              };
              onChange(nextFields);
            }}
          />
          <Select
            value={field.type}
            options={[
              { label: '单行输入', value: 'text' },
              { label: '密码框', value: 'password' },
              { label: '多行输入', value: 'textarea' },
              { label: '下拉选择', value: 'select' },
              { label: '开关', value: 'switch' },
            ]}
            onChange={(nextValue) => {
              const nextFields = [...fields];
              nextFields[index] = {
                ...field,
                type: nextValue,
              };
              onChange(nextFields);
            }}
          />
          <div className="designer-list-card__actions">
            <Button
              danger
              size="small"
              onClick={() => onChange(fields.filter((_, current) => current !== index))}
            >
              删除
            </Button>
          </div>
        </div>
      ))}
      {fields.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无字段" />
      ) : null}
    </div>
  );
};

const SetterField: React.FC<{
  schema: MaterialPropSchema;
  value: any;
  onChange: (nextValue: any) => void;
}> = ({ schema, value, onChange }) => {
  if (schema.setter === 'text') {
    return (
      <Input
        value={value}
        placeholder={schema.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (schema.setter === 'textarea') {
    return (
      <Input.TextArea
        rows={4}
        value={value}
        placeholder={schema.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (schema.setter === 'number') {
    return (
      <InputNumber
        min={schema.min}
        max={schema.max}
        step={schema.step}
        value={value}
        onChange={(nextValue) => onChange(Number(nextValue) || 0)}
        style={{ width: '100%' }}
      />
    );
  }

  if (schema.setter === 'switch') {
    return <Switch checked={Boolean(value)} onChange={onChange} />;
  }

  if (schema.setter === 'select') {
    return (
      <Select
        value={value}
        options={schema.options}
        onChange={(nextValue) => onChange(nextValue)}
      />
    );
  }

  if (schema.setter === 'color') {
    return <ColorInput value={value} onChange={onChange} />;
  }

  if (schema.setter === 'boxModel') {
    return <BoxModelEditor value={value} onChange={onChange} />;
  }

  if (schema.setter === 'tabsItems') {
    return <TabsItemsEditor value={value} onChange={onChange} />;
  }

  if (schema.setter === 'tableColumns') {
    return <TableColumnsEditor value={value} onChange={onChange} />;
  }

  if (schema.setter === 'formFields') {
    return <FormFieldsEditor value={value} onChange={onChange} />;
  }

  return null;
};

export const PropsPanel = () => {
  const { actions, activeId, activeNode } = useEditor((state, query) => {
    const selectedId = query.getEvent('selected').first();
    const node = selectedId ? state.nodes[selectedId] : null;

    return {
      activeId: selectedId || null,
      activeNode: node
        ? {
            name: node.data.name,
            displayName: node.data.custom?.displayName || node.data.displayName,
            props: node.data.props,
          }
        : null,
    };
  });

  const material = getMaterialMeta(activeNode?.name);

  const groups = useMemo(() => {
    if (!material) {
      return [];
    }

    return SECTION_ORDER.map((sectionName) => ({
      key: sectionName,
      label: sectionName,
      children: material.propsSchema.filter(
        (item) => item.group === sectionName
      ),
    })).filter((section) => section.children.length > 0);
  }, [material]);

  if (!activeId || !activeNode || !material) {
    return (
      <div className="designer-panel-empty">
        <Empty description="请选择画布中的组件" />
      </div>
    );
  }

  return (
    <div className="designer-props-panel">
      <div className="designer-panel-head">
        <Space direction="vertical" size={4}>
          <Typography.Text strong>{activeNode.displayName}</Typography.Text>
          <Tag color="blue">{material.title}</Tag>
        </Space>
      </div>
      <Collapse
        bordered={false}
        defaultActiveKey={groups.map((group) => group.key)}
        items={groups.map((group) => ({
          key: group.key,
          label: group.label,
          children: (
            <div className="designer-props-stack">
              {group.children.map((schema) => (
                <div key={schema.key} className="designer-props-field">
                  <label className="designer-props-field__label">
                    {schema.title}
                  </label>
                  <SetterField
                    schema={schema}
                    value={activeNode.props?.[schema.key]}
                    onChange={(nextValue) => {
                      actions.setProp(activeId, (props: Record<string, any>) => {
                        props[schema.key] = nextValue;
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          ),
        }))}
      />
    </div>
  );
};
