import React, { useEffect, useState } from 'react';
import { Button, Card, Input, Space, Typography } from 'antd';
import type { ApiSchema, MethodSchema } from '../../schema/types';

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function PageStatePanel({
  pageState,
  methods,
  apis,
  onChangePageState,
  onChangeMethods,
  onChangeApis,
}: {
  pageState: Record<string, unknown>;
  methods: MethodSchema[];
  apis: ApiSchema[];
  onChangePageState: (nextState: Record<string, unknown>) => void;
  onChangeMethods: (nextMethods: MethodSchema[]) => void;
  onChangeApis: (nextApis: ApiSchema[]) => void;
}) {
  const [stateDraft, setStateDraft] = useState(() => pretty(pageState));
  const [methodDraft, setMethodDraft] = useState(() => pretty(methods));
  const [apiDraft, setApiDraft] = useState(() => pretty(apis));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setStateDraft(pretty(pageState)), [pageState]);
  useEffect(() => setMethodDraft(pretty(methods)), [methods]);
  useEffect(() => setApiDraft(pretty(apis)), [apis]);

  const apply = () => {
    try {
      onChangePageState(JSON.parse(stateDraft));
      onChangeMethods(JSON.parse(methodDraft));
      onChangeApis(JSON.parse(apiDraft));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'JSON 格式无效');
    }
  };

  return (
    <Card size="small" title="页面状态">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Typography.Text type="secondary">状态</Typography.Text>
          <Input.TextArea rows={8} value={stateDraft} onChange={(event) => setStateDraft(event.target.value)} />
        </div>
        <div>
          <Typography.Text type="secondary">方法</Typography.Text>
          <Input.TextArea rows={6} value={methodDraft} onChange={(event) => setMethodDraft(event.target.value)} />
        </div>
        <div>
          <Typography.Text type="secondary">接口</Typography.Text>
          <Input.TextArea rows={6} value={apiDraft} onChange={(event) => setApiDraft(event.target.value)} />
        </div>
        {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        <Button type="primary" onClick={apply}>
          应用 JSON
        </Button>
      </Space>
    </Card>
  );
}
