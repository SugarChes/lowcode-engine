import React from 'react';
import { useEditor } from '@craftjs/core';
import { Button, Card, Collapse, Empty, Input, Select, Space, Switch, Typography } from 'antd';
import type {
  ActionNode,
  ApiSchema,
  AppSchema,
  EventFlow,
  MaterialEventMeta,
  MethodSchema,
  ValueSource,
} from '../../schema/types';
import { createEmptyAction, eventFlowsForEvent, extractNodeSchema, removeEventFlow, upsertEventFlow } from '../../schema/helpers';
import { describeMaterial } from '../../materials/defs';

const ACTION_TYPE_LABELS: Record<ActionNode['type'], string> = {
  setState: '设置状态',
  setNodeProp: '设置组件属性',
  toggleNodeProp: '切换组件属性',
  showNode: '显示组件',
  hideNode: '隐藏组件',
  if: '条件判断',
  callMethod: '调用方法',
  request: '发起请求',
  message: '消息提示',
};

function ValueSourceEditor({
  value,
  onChange,
  pageState,
  nodeOptions,
}: {
  value: ValueSource;
  onChange: (nextValue: ValueSource) => void;
  pageState: Record<string, unknown>;
  nodeOptions: Array<{ label: string; value: string }>;
}) {
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Select
        value={value.kind}
        options={[
          { label: '字面量', value: 'literal' },
          { label: '页面状态', value: 'state' },
          { label: '组件属性', value: 'nodeProp' },
          { label: '事件参数', value: 'eventParam' },
          { label: '接口结果', value: 'apiResult' },
        ]}
        onChange={(kind) => {
          if (kind === 'literal') onChange({ kind, value: '' });
          if (kind === 'state') onChange({ kind, key: Object.keys(pageState)[0] || 'searchText' });
          if (kind === 'nodeProp') onChange({ kind, nodeId: nodeOptions[0]?.value || 'ROOT', propPath: 'label' });
          if (kind === 'eventParam') onChange({ kind, path: 'value' });
          if (kind === 'apiResult') onChange({ kind, path: '0.name' });
        }}
      />
      {value.kind === 'literal' ? (
        <Input value={String(value.value ?? '')} onChange={(event) => onChange({ ...value, value: event.target.value })} />
      ) : null}
      {value.kind === 'state' ? (
        <Select
          value={value.key}
          options={Object.keys(pageState).map((key) => ({ label: key, value: key }))}
          onChange={(key) => onChange({ ...value, key })}
        />
      ) : null}
      {value.kind === 'nodeProp' ? (
        <Space.Compact style={{ width: '100%' }}>
          <Select
            style={{ width: '45%' }}
            value={value.nodeId}
            options={nodeOptions}
            onChange={(nodeId) => onChange({ ...value, nodeId })}
          />
          <Input value={value.propPath} onChange={(event) => onChange({ ...value, propPath: event.target.value })} />
        </Space.Compact>
      ) : null}
      {value.kind === 'eventParam' ? (
        <Input value={value.path} onChange={(event) => onChange({ ...value, path: event.target.value })} />
      ) : null}
      {value.kind === 'apiResult' ? (
        <Input value={value.path} onChange={(event) => onChange({ ...value, path: event.target.value })} />
      ) : null}
    </Space>
  );
}

function ActionListEditor({
  actions,
  onChange,
  pageState,
  nodeOptions,
  methods,
  apis,
}: {
  actions: ActionNode[];
  onChange: (nextActions: ActionNode[]) => void;
  pageState: Record<string, unknown>;
  nodeOptions: Array<{ label: string; value: string }>;
  methods: MethodSchema[];
  apis: ApiSchema[];
}) {
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {actions.map((action, index) => (
        <ActionEditor
          key={action.id}
          action={action}
          pageState={pageState}
          nodeOptions={nodeOptions}
          methods={methods}
          apis={apis}
          onChange={(nextAction) => {
            const nextActions = [...actions];
            nextActions[index] = nextAction;
            onChange(nextActions);
          }}
          onRemove={() => onChange(actions.filter((item) => item.id !== action.id))}
        />
      ))}
      <Select
        placeholder="添加动作"
        value={undefined}
        options={Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => ({ label, value }))}
        onChange={(type) => {
          if (type) {
            onChange([...actions, createEmptyAction(type as ActionNode['type'])]);
          }
        }}
      />
    </Space>
  );
}

function ActionEditor({
  action,
  onChange,
  onRemove,
  pageState,
  nodeOptions,
  methods,
  apis,
}: {
  action: ActionNode;
  onChange: (nextAction: ActionNode) => void;
  onRemove: () => void;
  pageState: Record<string, unknown>;
  nodeOptions: Array<{ label: string; value: string }>;
  methods: MethodSchema[];
  apis: ApiSchema[];
}) {
  return (
    <Card
      size="small"
      type="inner"
      title={ACTION_TYPE_LABELS[action.type]}
      extra={
        <Button size="small" danger type="text" onClick={onRemove}>
          删除
        </Button>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {action.type === 'setState' ? (
          <>
            <Input value={action.key} addonBefore="状态键" onChange={(event) => onChange({ ...action, key: event.target.value })} />
            <ValueSourceEditor
              value={action.value}
              onChange={(value) => onChange({ ...action, value })}
              pageState={pageState}
              nodeOptions={nodeOptions}
            />
          </>
        ) : null}
        {action.type === 'setNodeProp' ? (
          <>
            <Select value={action.nodeId} options={nodeOptions} onChange={(nodeId) => onChange({ ...action, nodeId })} />
            <Input value={action.propPath} addonBefore="属性路径" onChange={(event) => onChange({ ...action, propPath: event.target.value })} />
            <ValueSourceEditor
              value={action.value}
              onChange={(value) => onChange({ ...action, value })}
              pageState={pageState}
              nodeOptions={nodeOptions}
            />
          </>
        ) : null}
        {action.type === 'toggleNodeProp' ? (
          <>
            <Select value={action.nodeId} options={nodeOptions} onChange={(nodeId) => onChange({ ...action, nodeId })} />
            <Input value={action.propPath} addonBefore="属性路径" onChange={(event) => onChange({ ...action, propPath: event.target.value })} />
          </>
        ) : null}
        {action.type === 'showNode' || action.type === 'hideNode' ? (
          <Select value={action.nodeId} options={nodeOptions} onChange={(nodeId) => onChange({ ...action, nodeId })} />
        ) : null}
        {action.type === 'callMethod' ? (
          <Select value={action.methodName} options={methods.map((method) => ({ label: method.name, value: method.name }))} onChange={(methodName) => onChange({ ...action, methodName })} />
        ) : null}
        {action.type === 'request' ? (
          <Select value={action.apiName} options={apis.map((api) => ({ label: api.name, value: api.name }))} onChange={(apiName) => onChange({ ...action, apiName })} />
        ) : null}
        {action.type === 'message' ? (
          <>
            <Select
              value={action.level}
              options={[
                { label: '提示', value: 'info' },
                { label: '成功', value: 'success' },
                { label: '警告', value: 'warning' },
                { label: '错误', value: 'error' },
              ]}
              onChange={(level) => onChange({ ...action, level })}
            />
            <ValueSourceEditor
              value={action.content}
              onChange={(content) => onChange({ ...action, content })}
              pageState={pageState}
              nodeOptions={nodeOptions}
            />
          </>
        ) : null}
        {action.type === 'if' ? (
          <>
            <Typography.Text type="secondary">条件</Typography.Text>
            <ValueSourceEditor
              value={action.condition.left}
              onChange={(left) => onChange({ ...action, condition: { ...action.condition, left } })}
              pageState={pageState}
              nodeOptions={nodeOptions}
            />
            <Select
              value={action.condition.operator}
              options={[
                { label: '等于', value: 'eq' },
                { label: '不等于', value: 'neq' },
                { label: '包含', value: 'contains' },
                { label: '大于', value: 'gt' },
                { label: '小于', value: 'lt' },
                { label: '为真', value: 'truthy' },
                { label: '为假', value: 'falsy' },
              ]}
              onChange={(operator) => onChange({ ...action, condition: { ...action.condition, operator } })}
            />
            {action.condition.operator !== 'truthy' && action.condition.operator !== 'falsy' ? (
              <ValueSourceEditor
                value={action.condition.right ?? { kind: 'literal', value: '' }}
                onChange={(right) => onChange({ ...action, condition: { ...action.condition, right } })}
                pageState={pageState}
                nodeOptions={nodeOptions}
              />
            ) : null}
            <Typography.Text type="secondary">满足时</Typography.Text>
            <ActionListEditor
              actions={action.then}
              onChange={(then) => onChange({ ...action, then })}
              pageState={pageState}
              nodeOptions={nodeOptions}
              methods={methods}
              apis={apis}
            />
            <Typography.Text type="secondary">否则</Typography.Text>
            <ActionListEditor
              actions={action.else}
              onChange={(elseActions) => onChange({ ...action, else: elseActions })}
              pageState={pageState}
              nodeOptions={nodeOptions}
              methods={methods}
              apis={apis}
            />
          </>
        ) : null}
      </Space>
    </Card>
  );
}

function EventFlowCard({
  eventMeta,
  flow,
  pageState,
  nodeOptions,
  methods,
  apis,
  onSave,
  onDelete,
}: {
  eventMeta: MaterialEventMeta;
  flow: EventFlow;
  pageState: Record<string, unknown>;
  nodeOptions: Array<{ label: string; value: string }>;
  methods: MethodSchema[];
  apis: ApiSchema[];
  onSave: (nextFlow: EventFlow) => void;
  onDelete: () => void;
}) {
  return (
    <Card size="small" title={eventMeta.label} extra={<Switch checked={flow.enabled !== false} onChange={(enabled) => onSave({ ...flow, enabled })} />}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">事件名：{eventMeta.name}</Typography.Text>
        <Typography.Text type="secondary">参数：{eventMeta.params.join(', ') || '无'}</Typography.Text>
        <ActionListEditor
          actions={flow.actions}
          onChange={(actions) => onSave({ ...flow, actions })}
          pageState={pageState}
          nodeOptions={nodeOptions}
          methods={methods}
          apis={apis}
        />
        <Button danger onClick={onDelete}>
          删除事件流
        </Button>
      </Space>
    </Card>
  );
}

export default function EventPanel({
  schema,
  selectedNodeId,
}: {
  schema: AppSchema;
  selectedNodeId: string | null;
}) {
  const { actions } = useEditor();
  const node = extractNodeSchema(schema, selectedNodeId);

  if (!node || !selectedNodeId) {
    return (
      <Card size="small" title="事件">
        <Empty description="请选择一个组件后编辑事件流" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  const page = schema.pages[0];
  const material = describeMaterial(node.componentName);
  const nodeOptions = Object.values(page.nodes).map((item) => ({
    label: `${item.id} · ${describeMaterial(item.componentName).title}`,
    value: item.id,
  }));

  const saveFlowSet = (nextFlows: EventFlow[]) => {
    actions.setCustom(selectedNodeId, (custom: Record<string, unknown>) => {
      custom.eventFlows = nextFlows;
    });
  };

  const saveFlow = (nextFlow: EventFlow) => saveFlowSet(upsertEventFlow(node.eventFlows ?? [], nextFlow));

  return (
    <Card size="small" title="事件">
      <Collapse
        items={material.events.map((eventMeta) => {
          const existingFlow =
            eventFlowsForEvent(node, eventMeta.name)[0] ??
            ({
              nodeId: selectedNodeId,
              eventName: eventMeta.name,
              actions: [],
              enabled: true,
            } as EventFlow);

          return {
            key: eventMeta.name,
            label: eventMeta.label,
            children: (
              <EventFlowCard
                eventMeta={eventMeta}
                flow={existingFlow}
                pageState={page.state}
                nodeOptions={nodeOptions}
                methods={schema.methods ?? []}
                apis={schema.apis ?? []}
                onSave={saveFlow}
                onDelete={() => saveFlowSet(removeEventFlow(node.eventFlows ?? [], eventMeta.name))}
              />
            ),
          };
        })}
      />
      {!material.events.length ? <Typography.Text type="secondary">这个组件暂时没有可配置事件。</Typography.Text> : null}
    </Card>
  );
}
