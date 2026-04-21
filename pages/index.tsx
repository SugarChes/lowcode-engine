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
const AI_PREVIEW_STATUS_TEXT = 'AI 预览中，未保存';

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

type AiPreviewState = {
  schema: AppSchema;
  targetSummary: string;
  message: string;
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
        <div className="designer-frame-recovering">正在修复画布数据，请稍候...</div>
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
  const [previewState, setPreviewState] = React.useState<AiPreviewState | null>(null);
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
  const previewStateRef = React.useRef<AiPreviewState | null>(null);
  const frameRecoverCountRef = React.useRef(0);
  const programmaticFrameUpdateRef = React.useRef(false);
  const programmaticFrameTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    previewStateRef.current = previewState;
    latestSchemaRef.current = previewState?.schema || appSchema;
  }, [appSchema, previewState]);

  React.useEffect(
    () => () => {
      if (programmaticFrameTimerRef.current !== null) {
        window.clearTimeout(programmaticFrameTimerRef.current);
      }
    },
    []
  );

  const markProgrammaticFrameUpdate = React.useCallback(() => {
    programmaticFrameUpdateRef.current = true;

    if (typeof window !== 'undefined') {
      if (programmaticFrameTimerRef.current !== null) {
        window.clearTimeout(programmaticFrameTimerRef.current);
      }

      programmaticFrameTimerRef.current = window.setTimeout(() => {
        programmaticFrameUpdateRef.current = false;
        programmaticFrameTimerRef.current = null;
      }, 80);
    }
  }, []);

  const loadSchemaIntoFrame = React.useCallback(
    (nextSchema: AppSchema) => {
      latestSchemaRef.current = nextSchema;
      markProgrammaticFrameUpdate();
      setFrameData(appSchemaToCraftNodes(nextSchema));
      setFrameVersion((current) => current + 1);
    },
    [markProgrammaticFrameUpdate]
  );

  const commitSchema = React.useCallback(
    (
      nextSchema: AppSchema,
      options?: {
        successMessage?: string;
        statusText?: string;
      }
    ) => {
      previewStateRef.current = null;
      setPreviewState(null);
      latestSchemaRef.current = nextSchema;
      setAppSchema(nextSchema);
      loadSchemaIntoFrame(nextSchema);
      setSaveStatusText(options?.statusText || getSaveStatusText());

      if (typeof window !== 'undefined') {
        writeStoredAppSchema(window.localStorage, nextSchema);
      }

      if (options?.successMessage) {
        messageApi.success(options.successMessage);
      }
    },
    [loadSchemaIntoFrame, messageApi]
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
    if (programmaticFrameUpdateRef.current) {
      return;
    }

    const nextSchema = craftNodesToAppSchema(
      query.getSerializedNodes(),
      latestSchemaRef.current
    );

    latestSchemaRef.current = nextSchema;

    if (previewStateRef.current) {
      const nextPreviewState = {
        ...previewStateRef.current,
        schema: nextSchema,
      };

      previewStateRef.current = nextPreviewState;
      setPreviewState(nextPreviewState);
      setSaveStatusText(AI_PREVIEW_STATUS_TEXT);
      return;
    }

    setAppSchema(nextSchema);
    setSaveStatusText(getSaveStatusText());

    if (typeof window !== 'undefined') {
      writeStoredAppSchema(window.localStorage, nextSchema);
    }
  }, []);

  const handleCopySchema = React.useCallback(
    async (schemaToCopy: AppSchema) => {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        messageApi.warning('当前环境不支持直接复制。');
        return;
      }

      await navigator.clipboard.writeText(stringifyAppSchema(schemaToCopy));
      messageApi.success('页面配置已复制到剪贴板。');
    },
    [messageApi]
  );

  const handleConfirmImport = React.useCallback(() => {
    try {
      const parsedSchema = parseAppSchemaText(importText);

      frameRecoverCountRef.current = 0;
      commitSchema(parsedSchema, {
        successMessage: '页面配置已导入并应用。',
      });
      setImportOpen(false);
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败，请检查 JSON 内容。');
    }
  }, [commitSchema, importText, messageApi]);

  const handleReset = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      clearStoredAppSchema(window.localStorage);
    }

    frameRecoverCountRef.current = 0;
    commitSchema(createEmptyAppSchema(), {
      successMessage: '画布已重置。',
    });
  }, [commitSchema]);

  const handleFrameRecover = React.useCallback(
    (error: Error) => {
      if (frameRecoverCountRef.current > 0) {
        messageApi.error(error?.message || '画布加载失败，请检查当前页面配置。');
        return;
      }

      frameRecoverCountRef.current += 1;

      if (typeof window !== 'undefined') {
        clearStoredAppSchema(window.localStorage);
      }

      commitSchema(createEmptyAppSchema(), {
        successMessage: '检测到异常草稿，已恢复为空白画布。',
      });
    },
    [commitSchema, messageApi]
  );

  const handleAiPreviewGenerated = React.useCallback(
    ({
      draftSchema,
      targetSummary,
      message,
    }: {
      draftSchema: AppSchema;
      targetSummary: string;
      message: string;
    }) => {
      const nextPreviewState = {
        schema: draftSchema,
        targetSummary,
        message,
      };

      previewStateRef.current = nextPreviewState;
      setPreviewState(nextPreviewState);
      latestSchemaRef.current = draftSchema;
      loadSchemaIntoFrame(draftSchema);
      setSaveStatusText(AI_PREVIEW_STATUS_TEXT);
    },
    [loadSchemaIntoFrame]
  );

  const handleApplyAiPreview = React.useCallback(() => {
    const activePreviewState = previewStateRef.current;

    if (!activePreviewState) {
      return;
    }

    frameRecoverCountRef.current = 0;
    commitSchema(activePreviewState.schema, {
      successMessage: 'AI 预览已应用到画布。',
    });
  }, [commitSchema]);

  const handleDiscardAiPreview = React.useCallback(() => {
    if (!previewStateRef.current) {
      return;
    }

    previewStateRef.current = null;
    setPreviewState(null);
    latestSchemaRef.current = appSchema;
    loadSchemaIntoFrame(appSchema);
    setSaveStatusText('已放弃 AI 预览');
    messageApi.info('已放弃 AI 预览。');
  }, [appSchema, loadSchemaIntoFrame, messageApi]);

  const currentSchema = previewState?.schema || appSchema;
  const exportText = React.useMemo(
    () => stringifyAppSchema(currentSchema),
    [currentSchema]
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
            pageName={currentSchema.pages[0]?.name || '设计页面'}
            saveStatusText={saveStatusText}
            aiSchema={currentSchema}
            activePageId={currentSchema.pages[0]?.id || 'page-1'}
            isAiPreviewing={Boolean(previewState)}
            aiPreviewTargetSummary={previewState?.targetSummary}
            onAiPreviewGenerated={handleAiPreviewGenerated}
            onApplyAiPreview={handleApplyAiPreview}
            onDiscardAiPreview={handleDiscardAiPreview}
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
        title="导出页面配置"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        okText="复制"
        cancelText="关闭"
        onOk={() => handleCopySchema(currentSchema)}
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
        title="导入页面配置"
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
          placeholder="请粘贴页面配置 JSON"
        />
      </Modal>
    </>
  );
}

export default App;
