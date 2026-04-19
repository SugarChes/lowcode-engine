import React, { useMemo, useState } from 'react';
import { useEditor } from '@craftjs/core';
import { Card, Empty, Input, InputNumber, Select, Space, Switch, Tabs, Typography } from 'antd';
import type { AppSchema, NodeSchema, PropFieldConfig } from '../../schema/types';
import { describeMaterial, materialMetaMap } from '../../materials/defs';
import { deleteIn, extractNodeSchema, getIn } from '../../schema/helpers';

function FieldValue({
  field,
  value,
  onCommit,
}: {
  field: PropFieldConfig;
  value: unknown;
  onCommit: (nextValue: unknown) => void;
}) {
  const [draft, setDraft] = useState(() =>
    field.type === 'json'
      ? JSON.stringify(value ?? (field.path === 'items' ? [] : {}), null, 2)
      : String(value ?? ''),
  );

  React.useEffect(() => {
    setDraft(
      field.type === 'json'
        ? JSON.stringify(value ?? (field.path === 'items' ? [] : {}), null, 2)
        : String(value ?? ''),
    );
  }, [field.path, field.type, value]);

  switch (field.type) {
    case 'bool':
      return <Switch checked={Boolean(value)} onChange={(checked) => onCommit(checked)} />;
    case 'number':
      return (
        <InputNumber
          style={{ width: '100%' }}
          value={typeof value === 'number' ? value : Number(value || 0)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(nextValue) => onCommit(nextValue ?? 0)}
        />
      );
    case 'select':
      return (
        <Select
          value={(value as string | number | boolean | undefined) ?? undefined}
          options={field.options}
          onChange={(nextValue) => onCommit(nextValue)}
        />
      );
    case 'textarea':
      return <Input.TextArea rows={field.rows || 4} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onCommit(draft)} />;
    case 'json':
      return (
        <Input.TextArea
          rows={field.rows || 8}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            try {
              onCommit(JSON.parse(draft));
            } catch {
              // ignore parse errors until valid JSON is entered
            }
          }}
        />
      );
    case 'color':
      return (
        <Space>
          <input type="color" value={String(value || '#ffffff')} onChange={(event) => onCommit(event.target.value)} />
          <Input value={String(value || '')} onChange={(event) => onCommit(event.target.value)} />
        </Space>
      );
    case 'text':
    default:
      return <Input value={draft} placeholder={field.placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={() => onCommit(draft)} />;
  }
}

function SectionFields({
  title,
  fields,
  node,
  onPropChange,
}: {
  title: string;
  fields: PropFieldConfig[];
  node: NodeSchema;
  onPropChange: (path: string, value: unknown) => void;
}) {
  if (!fields.length) return null;
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Typography.Text strong>{title}</Typography.Text>
      {fields.map((field) => (
        <div key={field.path}>
          <Typography.Text type="secondary">{field.label}</Typography.Text>
          <FieldValue field={field} value={getIn(node.props, field.path)} onCommit={(nextValue) => onPropChange(field.path, nextValue)} />
        </div>
      ))}
    </Space>
  );
}

export default function PropsPanel({
  schema,
  selectedNodeId,
}: {
  schema: AppSchema;
  selectedNodeId: string | null;
}) {
  const { actions } = useEditor();
  const node = extractNodeSchema(schema, selectedNodeId);
  const material = node ? describeMaterial(node.componentName) : null;

  const fieldGroups = useMemo(() => {
    if (!material || !node) return null;
    return {
      props: material.propsSchema.filter((field) => field.section === 'props'),
      style: material.propsSchema.filter((field) => field.section === 'style'),
      advanced: material.propsSchema.filter((field) => field.section === 'advanced'),
    };
  }, [material, node]);

  if (!node || !selectedNodeId) {
    return (
      <Card size="small" title="属性">
        <Empty description="请选择一个节点后编辑属性" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const onPropChange = (path: string, nextValue: unknown) => {
    actions.setProp(selectedNodeId, (props: Record<string, unknown>) => {
      if (nextValue === '' && path.startsWith('style.')) {
        const nextProps = deleteIn(props, path);
        Object.assign(props, nextProps);
        return;
      }
      const parts = path.split('.');
      let current: any = props;
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        if (isLast) {
          current[part] = nextValue;
          return;
        }
        current[part] = typeof current[part] === 'object' && current[part] ? { ...current[part] } : {};
        current = current[part];
      });
    });
  };

  return (
    <Card size="small" title="属性">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Text strong>{material?.title || node.componentName}</Typography.Text>
        <Tabs
          items={[
            {
              key: 'props',
              label: '属性',
              children: fieldGroups ? <SectionFields title="基础属性" fields={fieldGroups.props} node={node} onPropChange={onPropChange} /> : null,
            },
            {
              key: 'style',
              label: '样式',
              children: fieldGroups ? <SectionFields title="样式属性" fields={fieldGroups.style} node={node} onPropChange={onPropChange} /> : null,
            },
            {
              key: 'advanced',
              label: '高级',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {fieldGroups ? <SectionFields title="高级属性" fields={fieldGroups.advanced} node={node} onPropChange={onPropChange} /> : null}
                  <div>
                    <Typography.Text type="secondary">可见</Typography.Text>
                    <div>
                      <Switch checked={node.visible !== false} onChange={(checked) => actions.setHidden(selectedNodeId, !checked)} />
                    </div>
                  </div>
                  <div>
                    <Typography.Text type="secondary">锁定</Typography.Text>
                    <div>
                      <Switch
                        checked={Boolean(node.locked)}
                        onChange={(checked) =>
                          actions.setCustom(selectedNodeId, (custom: Record<string, unknown>) => {
                            custom.locked = checked;
                          })
                        }
                      />
                    </div>
                  </div>
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );
}
