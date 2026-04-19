import { Editor, Frame, useEditor } from '@craftjs/core';
import { Input, Modal, message } from 'antd';
import Head from 'next/head';
import React from 'react';

import { DESIGNER_RESOLVER } from '../components/designer/materials';
import {
  APP_SCHEMA_STORAGE_KEY,
  AppSchema,
  appSchemaToCraftNodes,
  clearStoredAppSchema,
  createEmptyAppSchema,
  craftNodesToAppSchema,
  parseAppSchemaText,
  readStoredAppSchema,
  stringifyAppSchema,
  writeStoredAppSchema,
} from '../components/designer/schema';
import { RenderNode, Viewport } from '../components/editor';

const { TextArea } = Input;

const EDITOR_INSTANCE_KEY = 'designer-editor-resolver-v2';

const getResolvedName = (node: any) => {
  const type = node?.type;

  if (typeof type === 'string') {
    return type;
  }

  return type?.resolvedName;
};

const sanitizeFrameDataForResolver = (frameData: Record<string, any>) => {
  const resolverNames = new Set(Object.keys(DESIGNER_RESOLVER));

  if (!resolverNames.has('Container')) {
    return frameData;
  }

  return Object.fromEntries(
    Object.entries(frameData).map(([nodeId, node]) => {
      const resolvedName = getResolvedName(node);

      if (!resolvedName || resolverNames.has(resolvedName)) {
        return [nodeId, node];
      }

      return [
        nodeId,
        {
          ...node,
          type: {
            resolvedName: 'Container',
          },
          displayName: node?.displayName || '容器',
          custom: {
            ...(node?.custom || {}),
            displayName: node?.custom?.displayName || node?.displayName || '容器',
          },
          props: {
            title: node?.displayName || '容器',
            width: '100%',
            height: 'auto',
            minHeight: 96,
            margin: [1, 1, 1, 1],
            padding: [1, 1, 1, 1],
            backgroundColor: '#ffffff',
            borderColor: '#d9d9d9',
            borderRadius: 8,
            direction: 'column',
            align: 'stretch',
            justify: 'flex-start',
            gap: 1,
            ...(node?.props || {}),
          },
          isCanvas: true,
        },
      ];
    })
  );
};

type FrameErrorBoundaryProps = {
  children: React.ReactNode;
  onRecover: (error: Error) => void;
};

type FrameErrorBoundaryState = {
  hasError: boolean;
};

class FrameErrorBoundary extends React.Component<
  FrameErrorBoundaryProps,
  FrameErrorBoundaryState
> {
  state: FrameErrorBoundaryState = {
    hasError: false,
  };

  componentDidCatch(error: Error) {
    this.setState({ hasError: true });

    window.setTimeout(() => {
      this.props.onRecover(error);
    }, 0);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="designer-frame-recovering">
          正在修复画布数据，请稍候...
        </div>
      );
    }

    return this.props.children;
  }
}

const FrameDataSync: React.FC<{
  data: Record<string, any>;
  version: number;
}> = ({ data, version }) => {
  const { actions } = useEditor();
  const lastVersionRef = React.useRef(version);

  React.useEffect(() => {
    if (lastVersionRef.current === version) {
      return;
    }

    lastVersionRef.current = version;
    (actions.history.ignore() as any).deserialize(data);
  }, [actions, data, version]);

  return null;
};

const getSaveStatusText = () =>
  `已自动保存 ${new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [appSchema, setAppSchema] = React.useState<AppSchema>(() =>
    createEmptyAppSchema()
  );
  const [frameData, setFrameData] = React.useState(() =>
    appSchemaToCraftNodes(createEmptyAppSchema())
  );
  const [frameVersion, setFrameVersion] = React.useState(0);
  const [bootstrapped, setBootstrapped] = React.useState(false);
  const [saveStatusText, setSaveStatusText] = React.useState('尚未保存');
  const [exportOpen, setExportOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const latestSchemaRef = React.useRef(appSchema);
  const frameRecoverCountRef = React.useRef(0);

  React.useEffect(() => {
    latestSchemaRef.current = appSchema;
  }, [appSchema]);

  const applySchema = React.useCallback(
    (nextSchema: AppSchema, successMessage?: string) => {
      const nextFrameData = appSchemaToCraftNodes(nextSchema);

      latestSchemaRef.current = nextSchema;
      setAppSchema(nextSchema);
      setFrameData(nextFrameData);
      setFrameVersion((current) => current + 1);
      setSaveStatusText(getSaveStatusText());

      if (typeof window !== 'undefined') {
        writeStoredAppSchema(window.localStorage, nextSchema);
      }

      if (successMessage) {
        messageApi.success(successMessage);
      }
    },
    [messageApi]
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      setBootstrapped(true);
      return;
    }

    const storedDraft = readStoredAppSchema(window.localStorage);

    if (!storedDraft) {
      setBootstrapped(true);
      return;
    }

    if (storedDraft.reset) {
      const emptySchema = createEmptyAppSchema();

      latestSchemaRef.current = emptySchema;
      setAppSchema(emptySchema);
      setFrameData(appSchemaToCraftNodes(emptySchema));
      writeStoredAppSchema(window.localStorage, emptySchema);
      setSaveStatusText('已清理旧草稿并恢复为空白画布');
      setBootstrapped(true);
      return;
    }

    latestSchemaRef.current = storedDraft.schema;
    setAppSchema(storedDraft.schema);
    setFrameData(appSchemaToCraftNodes(storedDraft.schema));
    setSaveStatusText(
      storedDraft.sourceKey === APP_SCHEMA_STORAGE_KEY
        ? '已从本地草稿恢复'
        : '已清理旧草稿并恢复编辑状态'
    );

    if (storedDraft.sourceKey !== APP_SCHEMA_STORAGE_KEY) {
      writeStoredAppSchema(window.localStorage, storedDraft.schema);
    }

    setBootstrapped(true);
  }, []);

  const handleNodesChange = React.useCallback((query: any) => {
    const nextSchema = craftNodesToAppSchema(
      query.getSerializedNodes(),
      latestSchemaRef.current
    );

    latestSchemaRef.current = nextSchema;
    setAppSchema(nextSchema);
    setSaveStatusText(getSaveStatusText());

    if (typeof window !== 'undefined') {
      writeStoredAppSchema(window.localStorage, nextSchema);
    }
  }, []);

  const handleCopySchema = React.useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      messageApi.warning('当前环境不支持直接复制。');
      return;
    }

    await navigator.clipboard.writeText(stringifyAppSchema(appSchema));
    messageApi.success('Schema 已复制到剪贴板。');
  }, [appSchema, messageApi]);

  const handleConfirmImport = React.useCallback(() => {
    try {
      const parsedSchema = parseAppSchemaText(importText);
      applySchema(parsedSchema, 'Schema 已导入并应用。');
      setImportOpen(false);
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败，请检查 JSON 内容。');
    }
  }, [applySchema, importText, messageApi]);

  const handleReset = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      clearStoredAppSchema(window.localStorage);
    }

    frameRecoverCountRef.current = 0;
    applySchema(createEmptyAppSchema(), '画布已重置。');
    return;

    Modal.confirm({
      title: '确定要重置画布吗？',
      content: '当前页面会恢复为一个空白容器，现有布局将被清空。',
      okText: '重置',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        if (typeof window !== 'undefined') {
          clearStoredAppSchema(window.localStorage);
        }
        applySchema(createEmptyAppSchema(), '画布已重置。');
      },
    });
  }, [applySchema]);

  const handleFrameRecover = React.useCallback(
    (error: Error) => {
      if (frameRecoverCountRef.current > 0) {
        messageApi.error(
          error?.message || '画布加载失败，请检查当前 Schema。'
        );
        return;
      }

      frameRecoverCountRef.current += 1;

      if (typeof window !== 'undefined') {
        clearStoredAppSchema(window.localStorage);
      }

      applySchema(createEmptyAppSchema(), '检测到异常草稿，已恢复为空白画布。');
    },
    [applySchema, messageApi]
  );

  const exportText = React.useMemo(
    () => stringifyAppSchema(appSchema),
    [appSchema]
  );
  const safeFrameData = React.useMemo(
    () => sanitizeFrameDataForResolver(frameData),
    [frameData]
  );

  return (
    <>
      <Head>
        <title>低代码设计器</title>
      </Head>
      {contextHolder}
      {!bootstrapped ? (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#595959',
            fontSize: 14,
            background: '#f5f5f5',
          }}
        >
          正在加载设计器...
        </div>
      ) : (
      <Editor
        key={EDITOR_INSTANCE_KEY}
        resolver={DESIGNER_RESOLVER}
        enabled
        onRender={RenderNode}
        onNodesChange={handleNodesChange}
      >
        <Viewport
          pageName={appSchema.pages[0]?.name || '设计页面'}
          saveStatusText={saveStatusText}
          onOpenImport={() => {
            setImportText(exportText);
            setImportOpen(true);
          }}
          onOpenExport={() => setExportOpen(true)}
          onReset={handleReset}
        >
          <FrameDataSync data={safeFrameData} version={frameVersion} />
          <FrameErrorBoundary
            key={`frame-boundary-${frameVersion}`}
            onRecover={handleFrameRecover}
          >
            <Frame key={frameVersion} data={safeFrameData} />
          </FrameErrorBoundary>
        </Viewport>
      </Editor>
      )}

      <Modal
        title="导出 AppSchema"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        okText="复制"
        cancelText="关闭"
        onOk={handleCopySchema}
        width={840}
      >
        <TextArea
          className="designer-json-textarea"
          autoSize={{ minRows: 16, maxRows: 24 }}
          value={exportText}
          readOnly
        />
      </Modal>

      <Modal
        title="导入 AppSchema"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={handleConfirmImport}
        okText="应用"
        cancelText="取消"
        width={840}
      >
        <TextArea
          className="designer-json-textarea"
          autoSize={{ minRows: 16, maxRows: 24 }}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          placeholder="请粘贴 AppSchema JSON"
        />
      </Modal>
    </>
  );
}

export default App;
