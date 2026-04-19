import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App as AntdApp, Button, Card, Col, Empty, Flex, Input, Row, Space, Table, Tabs, Typography } from 'antd';
import type { AppSchema, NodeSchema } from '../schema/types';
import { deepClone, getIn } from '../schema/helpers';
import { runActions, updateNodePropRecord } from './actions';

export default function RuntimePreview({ schema }: { schema: AppSchema }) {
  const page = schema.pages[0];
  const { message } = AntdApp.useApp();
  const [pageState, setPageStateState] = useState<Record<string, unknown>>(() => deepClone(page.state));
  const [nodes, setNodes] = useState<Record<string, NodeSchema>>(() => deepClone(page.nodes));
  const pageStateRef = useRef(pageState);
  const nodesRef = useRef(nodes);

  useEffect(() => {
    const nextState = deepClone(page.state);
    const nextNodes = deepClone(page.nodes);
    pageStateRef.current = nextState;
    nodesRef.current = nextNodes;
    setPageStateState(nextState);
    setNodes(nextNodes);
  }, [page]);

  const apiMap = useMemo(
    () => Object.fromEntries((schema.apis ?? []).map((api) => [api.name, api])),
    [schema.apis],
  );

  const methodMap = useMemo(
    () =>
      Object.fromEntries(
        (schema.methods ?? []).map((method) => [
          method.name,
          async (context: { pageState: Record<string, unknown> }) => {
            if (method.name === 'logSelection') {
              console.info(`[runtime:${method.name}]`, context.pageState);
              message.info('页面状态快照已输出到控制台。');
              return;
            }
            console.info(`[runtime:${method.name}]`, context.pageState);
          },
        ]),
      ),
    [message, schema.methods],
  );

  const notify = (level: 'success' | 'info' | 'warning' | 'error', content: string) => {
    message[level](content);
  };

  const setPageState = (key: string, value: unknown) => {
    pageStateRef.current = {
      ...pageStateRef.current,
      [key]: value,
    };
    setPageStateState(pageStateRef.current);
  };

  const updateNodeProp = (nodeId: string, propPath: string, value: unknown) => {
    const current = nodesRef.current[nodeId];
    if (!current) return;
    const nextNode = updateNodePropRecord(current, propPath, value);
    nodesRef.current = {
      ...nodesRef.current,
      [nodeId]: nextNode,
    };
    setNodes(nodesRef.current);
  };

  const toggleNodeProp = (nodeId: string, propPath: string) => {
    const current = nodesRef.current[nodeId];
    if (!current) return;
    const currentValue = Boolean(getIn(current.props, propPath));
    updateNodeProp(nodeId, propPath, !currentValue);
  };

  const setNodeVisibility = (nodeId: string, visible: boolean) => {
    const current = nodesRef.current[nodeId];
    if (!current) return;
    const nextNode = {
      ...current,
      visible,
    };
    nodesRef.current = {
      ...nodesRef.current,
      [nodeId]: nextNode,
    };
    setNodes(nodesRef.current);
  };

  const fireEvent = async (nodeId: string, eventName: string, eventParams: Record<string, unknown>) => {
    const node = nodesRef.current[nodeId];
    const flows = (node?.eventFlows ?? []).filter((flow) => flow.eventName === eventName && flow.enabled !== false);
    for (const flow of flows) {
      await runActions(flow.actions, {
        pageState: pageStateRef.current,
        getNode: (targetId) => nodesRef.current[targetId],
        setPageState,
        updateNodeProp,
        toggleNodeProp,
        setNodeVisibility,
        notify,
        apis: apiMap,
        methods: methodMap,
        eventParams,
      });
    }
  };

  const collectInputValues = (nodeId: string, acc: Record<string, unknown> = {}) => {
    const node = nodesRef.current[nodeId];
    if (!node) return acc;
    if (node.componentName === 'Input') {
      const fieldKey = String(node.props.placeholder || node.id);
      acc[fieldKey] = node.props.value ?? '';
    }
    node.children?.forEach((childId) => collectInputValues(childId, acc));
    Object.values(node.slots ?? {}).forEach((slotChildren) => {
      slotChildren.forEach((slotChildId) => collectInputValues(slotChildId, acc));
    });
    return acc;
  };

  const renderChildren = (nodeIds: string[] | undefined) => nodeIds?.map((childId) => renderNode(childId)) ?? null;

  const renderSlots = (slots: Record<string, string[]> | undefined) =>
    Object.fromEntries(
      Object.entries(slots ?? {}).map(([slotName, slotChildren]) => [slotName, renderChildren(slotChildren)]),
    );

  const renderNode = (nodeId: string): React.ReactNode => {
    const node = nodes[nodeId];
    if (!node || node.visible === false) return null;

    const slotContent = renderSlots(node.slots);
    const style = (node.props.style as React.CSSProperties | undefined) ?? {};

    switch (node.componentName) {
      case 'CanvasRoot':
        return (
          <div key={nodeId} style={{ ...style, minHeight: '100%' }}>
            {renderChildren(node.children)}
          </div>
        );
      case 'Container':
        return (
          <Card key={nodeId} title={typeof node.props.title === 'string' ? node.props.title : undefined} style={style}>
            {renderChildren(node.children)}
          </Card>
        );
      case 'Row':
        return (
          <Row key={nodeId} gutter={Number(node.props.gutter || 0)} style={style}>
            {renderChildren(node.children)}
          </Row>
        );
      case 'Col':
        return (
          <Col key={nodeId} span={Number(node.props.span || 24)} style={style}>
            {renderChildren(node.children)}
          </Col>
        );
      case 'Flex':
        return (
          <Flex
            key={nodeId}
            gap={Number(node.props.gap || 0)}
            justify={(node.props.justify as any) || 'flex-start'}
            align={(node.props.align as any) || 'stretch'}
            vertical={Boolean(node.props.vertical)}
            style={style}
          >
            {renderChildren(node.children)}
          </Flex>
        );
      case 'SpaceNode':
        return (
          <Space key={nodeId} size={Number(node.props.size || 0)} direction={(node.props.direction as any) || 'horizontal'} style={style}>
            {renderChildren(node.children)}
          </Space>
        );
      case 'Button':
        return (
          <Button
            key={nodeId}
            type={(node.props.buttonType as any) || 'default'}
            size={(node.props.size as any) || 'middle'}
            block={Boolean(node.props.block)}
            danger={Boolean(node.props.danger)}
            disabled={Boolean(node.props.disabled)}
            style={style}
            onClick={() => fireEvent(nodeId, 'onClick', {})}
          >
            {String(node.props.label || '按钮')}
          </Button>
        );
      case 'Input':
        return (
          <Input
            key={nodeId}
            placeholder={String(node.props.placeholder || '')}
            value={typeof node.props.value === 'string' ? node.props.value : ''}
            allowClear={Boolean(node.props.allowClear)}
            disabled={Boolean(node.props.disabled)}
            style={style}
            onChange={(event) => {
              updateNodeProp(nodeId, 'value', event.target.value);
              fireEvent(nodeId, 'onChange', { value: event.target.value });
            }}
          />
        );
      case 'Tabs': {
        const items = Array.isArray(node.props.items) ? (node.props.items as Array<{ key: string; label: string }>) : [];
        return (
          <Tabs
            key={nodeId}
            activeKey={String(node.props.activeKey || items[0]?.key || '')}
            style={style}
            items={items.map((item) => ({
              key: item.key,
              label: item.label,
              children: slotContent[`slot:${item.key}`] ?? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无页签内容" />,
            }))}
            onChange={(activeKey) => {
              updateNodeProp(nodeId, 'activeKey', activeKey);
              fireEvent(nodeId, 'onTabChange', { activeKey });
            }}
          />
        );
      }
      case 'Table': {
        const columns = Array.isArray(node.props.columns) ? (node.props.columns as any[]) : [];
        const dataSource = Array.isArray(node.props.dataSource) ? (node.props.dataSource as any[]) : [];
        return (
          <div key={nodeId}>
            {node.props.title ? (
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {String(node.props.title)}
              </Typography.Title>
            ) : null}
            <Table
              rowSelection={{
                onChange: (selectedRowKeys, selectedRows) =>
                  fireEvent(nodeId, 'onSelectRow', { selectedRowKeys, selectedRows }),
              }}
              columns={columns}
              dataSource={dataSource}
              pagination={Boolean(node.props.pagination) ? { pageSize: 5 } : false}
              style={style}
            />
          </div>
        );
      }
      case 'FormGroup':
        return (
          <Card key={nodeId} title={typeof node.props.title === 'string' ? node.props.title : undefined} style={style}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {renderChildren(node.children)}
              {node.props.showSubmitButton ? (
                <Button
                  type="primary"
                  onClick={() =>
                    fireEvent(nodeId, 'onSubmit', {
                      values: collectInputValues(nodeId),
                    })
                  }
                >
                  {String(node.props.submitText || '提交')}
                </Button>
              ) : null}
            </Space>
          </Card>
        );
      case 'SlotCanvas':
        return <div key={nodeId}>{renderChildren(node.children)}</div>;
      default:
        return (
          <Card key={nodeId} size="small">
            未知组件：{node.componentName}
          </Card>
        );
    }
  };

  return (
    <div style={{ padding: 20, minHeight: '100%', background: '#f6f9fc' }}>
      {renderNode(page.rootNodeId)}
      <Card size="small" style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">运行时状态</Typography.Text>
        <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(pageState, null, 2)}</pre>
      </Card>
    </div>
  );
}
