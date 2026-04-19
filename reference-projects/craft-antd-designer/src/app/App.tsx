import React, { useMemo, useState } from 'react';
import { Editor, useEditor } from '@craftjs/core';
import {
  App as AntdApp,
  Button,
  Card,
  Input,
  Layout,
  Modal,
  Segmented,
  Space,
  Tabs,
  Typography,
} from 'antd';
import { DeleteOutlined, DownloadOutlined, EyeOutlined, SaveOutlined, UndoOutlined, UploadOutlined } from '@ant-design/icons';
import CraftCanvas from './editor/craft/CraftCanvas';
import RenderNode from './editor/craft/RenderNode';
import MaterialPanel from './editor/panels/MaterialPanel';
import OutlinePanel from './editor/panels/OutlinePanel';
import PropsPanel from './editor/panels/PropsPanel';
import EventPanel from './editor/panels/EventPanel';
import PageStatePanel from './editor/panels/PageStatePanel';
import RuntimePreview from './runtime/preview';
import { buildAiPromptContext, AI_PATCH_TEMPLATE } from './ai/contract';
import { createDefaultSerializedNodes, DEFAULT_APIS, DEFAULT_METHODS, DEFAULT_PAGE_STATE } from './schema/defaults';
import {
  APP_LOCAL_STORAGE_KEY,
  appSchemaToSerializedNodes,
  buildAppSchema,
  deepClone,
  ROOT_ID,
} from './schema/helpers';
import type { ApiSchema, AppSchema, MethodSchema } from './schema/types';
import { resolver } from './materials/defs';

type SurfaceMode = 'design' | 'preview';

function Toolbar({
  schema,
  selectedNodeId,
  surfaceMode,
  onSurfaceModeChange,
  onRequestExport,
  onRequestImport,
  onRequestReset,
  onSaveLocal,
}: {
  schema: AppSchema;
  selectedNodeId: string | null;
  surfaceMode: SurfaceMode;
  onSurfaceModeChange: (mode: SurfaceMode) => void;
  onRequestExport: () => void;
  onRequestImport: () => void;
  onRequestReset: () => void;
  onSaveLocal: () => void;
}) {
  const { actions } = useEditor();

  return (
    <Card size="small" styles={{ body: { padding: 12 } }}>
      <div className="toolbar-row">
        <Space wrap>
          <Button icon={<UndoOutlined />} onClick={() => actions.history.undo()}>
            撤销
          </Button>
          <Button onClick={() => actions.history.redo()}>重做</Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            disabled={!selectedNodeId || selectedNodeId === ROOT_ID}
            onClick={() => {
              if (selectedNodeId && selectedNodeId !== ROOT_ID) {
                actions.delete(selectedNodeId);
              }
            }}
          >
            删除
          </Button>
        </Space>
        <Space wrap>
          <Segmented
            value={surfaceMode}
            options={[
              { label: '设计', value: 'design' },
              { label: '预览', value: 'preview', icon: <EyeOutlined /> },
            ]}
            onChange={(value) => onSurfaceModeChange(value as SurfaceMode)}
          />
          <Button icon={<SaveOutlined />} onClick={onSaveLocal}>
            保存本地
          </Button>
          <Button icon={<DownloadOutlined />} onClick={onRequestExport}>
            导出配置
          </Button>
          <Button icon={<UploadOutlined />} onClick={onRequestImport}>
            导入配置
          </Button>
          <Button onClick={onRequestReset}>重置</Button>
        </Space>
      </div>
      <Typography.Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
        {schema.pages[0].nodes ? `共 ${Object.keys(schema.pages[0].nodes).length} 个节点` : '共 0 个节点'}
      </Typography.Text>
    </Card>
  );
}

function InspectorPane({
  schema,
  selectedNodeId,
  pageState,
  methods,
  apis,
  onChangePageState,
  onChangeMethods,
  onChangeApis,
}: {
  schema: AppSchema;
  selectedNodeId: string | null;
  pageState: Record<string, unknown>;
  methods: MethodSchema[];
  apis: ApiSchema[];
  onChangePageState: (nextState: Record<string, unknown>) => void;
  onChangeMethods: (nextMethods: MethodSchema[]) => void;
  onChangeApis: (nextApis: ApiSchema[]) => void;
}) {
  const aiContext = useMemo(() => buildAiPromptContext(schema), [schema]);
  return (
    <Tabs
      items={[
        {
          key: 'props',
          label: '属性',
          children: <PropsPanel schema={schema} selectedNodeId={selectedNodeId} />,
        },
        {
          key: 'events',
          label: '事件',
          children: <EventPanel schema={schema} selectedNodeId={selectedNodeId} />,
        },
        {
          key: 'state',
          label: '页面',
          children: (
            <PageStatePanel
              pageState={pageState}
              methods={methods}
              apis={apis}
              onChangePageState={onChangePageState}
              onChangeMethods={onChangeMethods}
              onChangeApis={onChangeApis}
            />
          ),
        },
        {
          key: 'ai',
          label: 'AI',
          children: (
            <Card size="small" title="AI 协议">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Text type="secondary">
                  AI 层只输出结构化页面配置补丁和事件流补丁，不直接注入任意脚本。
                </Typography.Text>
                <Input.TextArea rows={8} readOnly value={JSON.stringify(aiContext, null, 2)} />
                <Input.TextArea rows={10} readOnly value={JSON.stringify(AI_PATCH_TEMPLATE, null, 2)} />
              </Space>
            </Card>
          ),
        },
        {
          key: 'schema',
          label: '结构',
          children: (
            <Card size="small" title="当前页面配置">
              <pre className="schema-dump">{JSON.stringify(schema, null, 2)}</pre>
            </Card>
          ),
        },
      ]}
    />
  );
}

function Workbench({
  frameData,
  schema,
  selectedNodeId,
  surfaceMode,
  onSelectedNodeChange,
  onSurfaceModeChange,
  onSaveLocal,
  onRequestExport,
  onRequestImport,
  onRequestReset,
  pageState,
  methods,
  apis,
  onChangePageState,
  onChangeMethods,
  onChangeApis,
}: {
  frameData: ReturnType<typeof createDefaultSerializedNodes>;
  schema: AppSchema;
  selectedNodeId: string | null;
  surfaceMode: SurfaceMode;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onSurfaceModeChange: (mode: SurfaceMode) => void;
  onSaveLocal: () => void;
  onRequestExport: () => void;
  onRequestImport: () => void;
  onRequestReset: () => void;
  pageState: Record<string, unknown>;
  methods: MethodSchema[];
  apis: ApiSchema[];
  onChangePageState: (nextState: Record<string, unknown>) => void;
  onChangeMethods: (nextMethods: MethodSchema[]) => void;
  onChangeApis: (nextApis: ApiSchema[]) => void;
}) {
  return (
    <Layout className="designer-shell">
      <Layout.Sider width={296} theme="light" className="designer-sider">
        <MaterialPanel />
        <OutlinePanel schema={schema} selectedNodeId={selectedNodeId} />
      </Layout.Sider>
      <Layout.Content className="designer-main">
        <Toolbar
          schema={schema}
          selectedNodeId={selectedNodeId}
          surfaceMode={surfaceMode}
          onSurfaceModeChange={onSurfaceModeChange}
          onRequestExport={onRequestExport}
          onRequestImport={onRequestImport}
          onRequestReset={onRequestReset}
          onSaveLocal={onSaveLocal}
        />
        <Card className="surface-card" styles={{ body: { padding: 0, height: '100%' } }}>
          {surfaceMode === 'design' ? (
            <CraftCanvas frameData={frameData} onSelectedChange={onSelectedNodeChange} />
          ) : (
            <RuntimePreview schema={schema} />
          )}
        </Card>
      </Layout.Content>
      <Layout.Sider width={360} theme="light" className="designer-inspector">
        <InspectorPane
          schema={schema}
          selectedNodeId={selectedNodeId}
          pageState={pageState}
          methods={methods}
          apis={apis}
          onChangePageState={onChangePageState}
          onChangeMethods={onChangeMethods}
          onChangeApis={onChangeApis}
        />
      </Layout.Sider>
    </Layout>
  );
}

export default function App() {
  const { message } = AntdApp.useApp();
  const [editorSession, setEditorSession] = useState(0);
  const [serializedNodes, setSerializedNodes] = useState(createDefaultSerializedNodes);
  const [pageState, setPageState] = useState(() => deepClone(DEFAULT_PAGE_STATE));
  const [methods, setMethods] = useState(() => deepClone(DEFAULT_METHODS));
  const [apis, setApis] = useState(() => deepClone(DEFAULT_APIS));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(ROOT_ID);
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>('design');
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importDraft, setImportDraft] = useState('');

  const schema = useMemo(
    () => buildAppSchema(serializedNodes, pageState, methods, apis),
    [apis, methods, pageState, serializedNodes],
  );

  const saveLocal = () => {
    localStorage.setItem(APP_LOCAL_STORAGE_KEY, JSON.stringify(schema, null, 2));
    message.success('配置已保存到本地存储。');
  };

  const loadSchema = (nextSchema: AppSchema) => {
    const nextSerialized = appSchemaToSerializedNodes(nextSchema);
    setSerializedNodes(nextSerialized);
    setPageState(deepClone(nextSchema.pages[0]?.state || {}));
    setMethods(deepClone(nextSchema.methods || []));
    setApis(deepClone(nextSchema.apis || []));
    setSelectedNodeId(nextSchema.pages[0]?.rootNodeId || ROOT_ID);
    setSurfaceMode('design');
    setEditorSession((value) => value + 1);
  };

  const resetAll = () => {
    setSerializedNodes(createDefaultSerializedNodes());
    setPageState(deepClone(DEFAULT_PAGE_STATE));
    setMethods(deepClone(DEFAULT_METHODS));
    setApis(deepClone(DEFAULT_APIS));
    setSelectedNodeId(ROOT_ID);
    setSurfaceMode('design');
    setEditorSession((value) => value + 1);
  };

  return (
    <>
      <Editor
        key={editorSession}
        onRender={RenderNode}
        resolver={resolver}
        onNodesChange={(query) => {
          setSerializedNodes(query.getSerializedNodes());
        }}
      >
        <Workbench
          frameData={serializedNodes}
          schema={schema}
          selectedNodeId={selectedNodeId}
          surfaceMode={surfaceMode}
          onSelectedNodeChange={setSelectedNodeId}
          onSurfaceModeChange={setSurfaceMode}
          onSaveLocal={saveLocal}
          onRequestExport={() => setExportOpen(true)}
          onRequestImport={() => setImportOpen(true)}
          onRequestReset={resetAll}
          pageState={pageState}
          methods={methods}
          apis={apis}
          onChangePageState={setPageState}
          onChangeMethods={setMethods}
          onChangeApis={setApis}
        />
      </Editor>

      <Modal
        open={exportOpen}
        title="导出页面配置"
        footer={null}
        width={920}
        onCancel={() => setExportOpen(false)}
      >
        <Input.TextArea rows={28} readOnly value={JSON.stringify(schema, null, 2)} />
      </Modal>

      <Modal
        open={importOpen}
        title="导入页面配置"
        okText="导入"
        width={920}
        onOk={() => {
          try {
            const nextSchema = JSON.parse(importDraft) as AppSchema;
            loadSchema(nextSchema);
            setImportOpen(false);
            message.success('配置导入成功。');
          } catch (error) {
            message.error(error instanceof Error ? error.message : '配置 JSON 无效。');
          }
        }}
        onCancel={() => setImportOpen(false)}
      >
        <Input.TextArea rows={28} value={importDraft} onChange={(event) => setImportDraft(event.target.value)} />
        <Space style={{ marginTop: 12 }}>
          <Button
            onClick={() => {
              const raw = localStorage.getItem(APP_LOCAL_STORAGE_KEY);
              if (!raw) {
                message.warning('还没有本地保存的配置。');
                return;
              }
              setImportDraft(raw);
            }}
          >
            载入本地已保存配置
          </Button>
          <Button onClick={() => setImportDraft(JSON.stringify(schema, null, 2))}>使用当前配置作为模板</Button>
        </Space>
      </Modal>
    </>
  );
}
