import { useEditor } from '@craftjs/core';
import {
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Button, Input, Typography } from 'antd';
import React from 'react';

import type { AppSchema } from '../../../designer/schema';
import type { AssistantRequestMessage } from '../../../../utils/ai-assistant';
import type {
  AssistantStreamEvent,
  AssistantTraceEvent,
} from '../../../../utils/ai-assistant-stream';

const { TextArea } = Input;

const MODEL_NAME = 'MiniMax-M2.7';

type ChatRole = 'assistant' | 'user';
type RunStatus = 'streaming' | 'done' | 'error' | 'aborted';

type TextEntry = {
  id: string;
  kind: 'text';
  role: ChatRole;
  content: string;
  persist: boolean;
  variant?: 'default' | 'error';
};

type RunTrace = AssistantTraceEvent & {
  id: string;
};

type RunEntry = {
  id: string;
  kind: 'run';
  content: string;
  traces: RunTrace[];
  status: RunStatus;
  persist: boolean;
  resultType?: 'reply' | 'preview' | 'clarify';
  previewTargetSummary?: string | null;
};

type ChatEntry = TextEntry | RunEntry;

type ChatErrorResponse = {
  error?: {
    message?: string;
    code?: string;
  };
};

export type AiAssistantPanelProps = {
  schema: AppSchema;
  activePageId: string;
  isPreviewing: boolean;
  previewTargetSummary?: string | null;
  onPreviewGenerated: (payload: {
    draftSchema: AppSchema;
    targetSummary: string;
    message: string;
  }) => void;
  onApplyPreview: () => void;
  onDiscardPreview: () => void;
};

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createTextEntry = (
  role: ChatRole,
  content: string,
  options?: Partial<Pick<TextEntry, 'persist' | 'variant'>>
): TextEntry => ({
  id: createId('ai-text'),
  kind: 'text',
  role,
  content,
  persist: options?.persist ?? true,
  variant: options?.variant ?? 'default',
});

const createRunEntry = (): RunEntry => ({
  id: createId('ai-run'),
  kind: 'run',
  content: '',
  traces: [],
  status: 'streaming',
  persist: false,
  previewTargetSummary: null,
});

const buildRequestHistory = (entries: ChatEntry[]): AssistantRequestMessage[] =>
  entries.flatMap((entry) => {
    if (!entry.persist) {
      return [];
    }

    if (entry.kind === 'text') {
      return [
        {
          role: entry.role,
          content: entry.content,
        },
      ];
    }

    if (!entry.content.trim()) {
      return [];
    }

    return [
      {
        role: 'assistant',
        content: entry.content.trim(),
      },
    ];
  });

const parseStreamBlock = (block: string) => {
  let eventName = 'message';
  const dataLines: string[] = [];

  block.split(/\r?\n/).forEach((line) => {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
      return;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  });

  if (!dataLines.length) {
    return null;
  }

  try {
    const payload = JSON.parse(dataLines.join('\n'));
    return {
      eventName,
      payload,
    };
  } catch {
    return null;
  }
};

const coerceStreamEvent = (
  eventName: string,
  payload: unknown
): AssistantStreamEvent | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (typeof (payload as { type?: unknown }).type === 'string') {
    return payload as AssistantStreamEvent;
  }

  if (eventName === 'trace') {
    return {
      type: 'trace',
      ...(payload as Omit<AssistantTraceEvent, 'type'>),
    } as AssistantStreamEvent;
  }

  if (eventName === 'message_token') {
    return {
      type: 'message_token',
      token: String((payload as { token?: unknown }).token || ''),
    };
  }

  return null;
};

const getRunStatusLabel = (status: RunStatus) => {
  switch (status) {
    case 'streaming':
      return '执行中';
    case 'done':
      return '已完成';
    case 'error':
      return '执行失败';
    case 'aborted':
      return '已中断';
    default:
      return '';
  }
};

const getTraceStatusLabel = (trace: AssistantTraceEvent) => {
  if (trace.detail) {
    return trace.detail;
  }

  return '';
};

const isChatErrorResponse = (
  value: ChatErrorResponse | null
): value is ChatErrorResponse => Boolean(value && 'error' in value);

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  schema,
  activePageId,
  isPreviewing,
  previewTargetSummary,
  onPreviewGenerated,
  onApplyPreview,
  onDiscardPreview,
}) => {
  const [draft, setDraft] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [entries, setEntries] = React.useState<ChatEntry[]>([
    createTextEntry(
      'assistant',
      '直接告诉我你想怎么改界面。我会先生成预览草稿，再由你决定是否应用。',
      { persist: false }
    ),
  ]);
  const [latestPreviewRunId, setLatestPreviewRunId] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const activeRunIdRef = React.useRef<string | null>(null);

  const { selectedNodeId } = useEditor((_, query) => ({
    selectedNodeId: query.getEvent('selected').first() || null,
  }));

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [entries, isPreviewing, isSubmitting]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const updateRunEntry = React.useCallback(
    (
      runId: string,
      updater: (entry: RunEntry) => RunEntry
    ) => {
      setEntries((current) =>
        current.map((entry) => {
          if (entry.kind !== 'run' || entry.id !== runId) {
            return entry;
          }

          return updater(entry);
        })
      );
    },
    []
  );

  const markRunAborted = React.useCallback(
    (runId: string) => {
      updateRunEntry(runId, (entry) => ({
        ...entry,
        status: entry.status === 'done' ? entry.status : 'aborted',
      }));
    },
    [updateRunEntry]
  );

  const handleAssistantEvent = React.useCallback(
    (runId: string, event: AssistantStreamEvent) => {
      switch (event.type) {
        case 'trace':
          updateRunEntry(runId, (entry) => ({
            ...entry,
            traces: [
              ...entry.traces,
              {
                id: createId('trace'),
                phase: event.phase,
                status: event.status,
                title: event.title,
                detail: event.detail,
              },
            ],
          }));
          break;
        case 'message_token':
          if (!event.token) {
            break;
          }
          updateRunEntry(runId, (entry) => ({
            ...entry,
            content: `${entry.content}${event.token}`,
          }));
          break;
        case 'preview_ready':
          setLatestPreviewRunId(runId);
          updateRunEntry(runId, (entry) => ({
            ...entry,
            status: 'done',
            persist: true,
            resultType: 'preview',
            previewTargetSummary: event.targetSummary,
            content: entry.content.trim() || event.message,
          }));
          onPreviewGenerated({
            draftSchema: event.draftSchema,
            targetSummary: event.targetSummary,
            message: event.message,
          });
          break;
        case 'reply_ready':
          updateRunEntry(runId, (entry) => ({
            ...entry,
            status: 'done',
            persist: true,
            resultType: 'reply',
            content: entry.content.trim() || event.message,
          }));
          break;
        case 'clarify_ready':
          updateRunEntry(runId, (entry) => ({
            ...entry,
            status: 'done',
            persist: true,
            resultType: 'clarify',
            content: entry.content.trim() || event.message,
          }));
          break;
        case 'error':
          updateRunEntry(runId, (entry) => ({
            ...entry,
            status: 'error',
            persist: false,
            content: entry.content.trim() || event.message,
          }));
          break;
        case 'done':
          updateRunEntry(runId, (entry) => ({
            ...entry,
            status: entry.status === 'streaming' ? 'done' : entry.status,
          }));
          break;
        default:
          break;
      }
    },
    [onPreviewGenerated, updateRunEntry]
  );

  const consumeEventStream = React.useCallback(
    async (
      response: Response,
      runId: string
    ) => {
      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('AI 流式响应不可用。');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), {
          stream: !done,
        });

        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';

        blocks.forEach((block) => {
          const parsed = parseStreamBlock(block);

          if (!parsed) {
            return;
          }

          const event = coerceStreamEvent(parsed.eventName, parsed.payload);

          if (!event) {
            return;
          }

          handleAssistantEvent(runId, event);
        });

        if (done) {
          break;
        }
      }
    },
    [handleAssistantEvent]
  );

  const sendPrompt = React.useCallback(
    async (promptText: string) => {
      const normalizedPrompt = promptText.trim();

      if (!normalizedPrompt) {
        setEntries((current) => [
          ...current,
          createTextEntry('assistant', '请先输入内容再发送。', {
            persist: false,
            variant: 'error',
          }),
        ]);
        return;
      }

      if (abortControllerRef.current && activeRunIdRef.current) {
        abortControllerRef.current.abort();
        markRunAborted(activeRunIdRef.current);
      }

      const nextUserEntry = createTextEntry('user', normalizedPrompt);
      const nextRunEntry = createRunEntry();
      const requestMessages = [
        ...buildRequestHistory(entries),
        {
          role: nextUserEntry.role,
          content: nextUserEntry.content,
        },
      ];

      setEntries((current) => [...current, nextUserEntry, nextRunEntry]);
      setDraft('');
      setIsSubmitting(true);
      activeRunIdRef.current = nextRunEntry.id;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch('/api/ai/assistant/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: requestMessages,
            schema,
            activePageId,
            selectedNodeId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload =
            ((await response.json().catch(() => null)) as ChatErrorResponse | null) ||
            null;
          throw new Error(
            (isChatErrorResponse(payload) && payload.error?.message) ||
              'AI 服务暂时不可用，请稍后重试。'
          );
        }

        await consumeEventStream(response, nextRunEntry.id);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          markRunAborted(nextRunEntry.id);
          return;
        }

        updateRunEntry(nextRunEntry.id, (entry) => ({
          ...entry,
          status: 'error',
          persist: false,
          content:
            error instanceof Error ? error.message : 'AI 请求失败，请稍后重试。',
        }));
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        if (activeRunIdRef.current === nextRunEntry.id) {
          activeRunIdRef.current = null;
        }

        setIsSubmitting(false);
      }
    },
    [
      activePageId,
      consumeEventStream,
      entries,
      markRunAborted,
      schema,
      selectedNodeId,
      updateRunEntry,
    ]
  );

  const handleApplyPreview = React.useCallback(() => {
    onApplyPreview();
    setLatestPreviewRunId(null);
    setEntries((current) => [
      ...current,
      createTextEntry('assistant', '已将当前预览应用到画布。', {
        persist: false,
      }),
    ]);
  }, [onApplyPreview]);

  const handleDiscardPreview = React.useCallback(() => {
    onDiscardPreview();
    setLatestPreviewRunId(null);
    setEntries((current) => [
      ...current,
      createTextEntry('assistant', '已放弃当前预览。', {
        persist: false,
      }),
    ]);
  }, [onDiscardPreview]);

  return (
    <div className="designer-ai-panel">
      <div className="designer-ai-messages">
        {entries.map((entry) => {
          if (entry.kind === 'text') {
            return (
              <div
                key={entry.id}
                className={`designer-ai-message designer-ai-message--${entry.role}${
                  entry.variant === 'error' ? ' designer-ai-message--error' : ''
                }`}
              >
                <div className="designer-ai-message__meta">
                  <span className="designer-ai-message__role">
                    {entry.role === 'assistant' ? 'AI 助手' : '你'}
                  </span>
                </div>
                <Typography.Paragraph style={{ margin: 0 }}>
                  {entry.content}
                </Typography.Paragraph>
              </div>
            );
          }

          return (
            <div
              key={entry.id}
              className={`designer-ai-run-card designer-ai-run-card--${entry.status}`}
            >
              <div className="designer-ai-run-card__meta">
                <span className="designer-ai-run-card__role">AI 助手</span>
                <span className="designer-ai-run-card__status">
                  {getRunStatusLabel(entry.status)}
                </span>
              </div>

              <div className="designer-ai-run-card__section">
                <div className="designer-ai-run-card__title">执行过程</div>
                <div className="designer-ai-run-trace">
                  {entry.traces.length ? (
                    entry.traces.map((trace) => (
                      <div
                        key={trace.id}
                        className={`designer-ai-trace-row designer-ai-trace-row--${trace.status}`}
                      >
                        <div className="designer-ai-trace-row__title">
                          {trace.title}
                        </div>
                        {getTraceStatusLabel(trace) ? (
                          <div className="designer-ai-trace-row__detail">
                            {getTraceStatusLabel(trace)}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="designer-ai-trace-row designer-ai-trace-row--start">
                      <div className="designer-ai-trace-row__title">等待执行...</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="designer-ai-run-card__section">
                <div className="designer-ai-run-card__title">结果输出</div>
                <Typography.Paragraph
                  className="designer-ai-run-output"
                  style={{ margin: 0 }}
                >
                  {entry.content || (entry.status === 'streaming' ? '正在生成...' : '暂无内容')}
                </Typography.Paragraph>
              </div>

              {isPreviewing &&
              latestPreviewRunId === entry.id &&
              entry.resultType === 'preview' ? (
                <div className="designer-ai-run-card__preview">
                  <div className="designer-ai-run-card__preview-meta">
                    <Typography.Text strong>预览中</Typography.Text>
                    <Typography.Text type="secondary">
                      {previewTargetSummary || entry.previewTargetSummary || '当前页面'}
                    </Typography.Text>
                  </div>
                  <div className="designer-ai-run-card__actions">
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={handleApplyPreview}
                    >
                      应用到画布
                    </Button>
                    <Button icon={<CloseOutlined />} onClick={handleDiscardPreview}>
                      放弃
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="designer-ai-composer">
        <TextArea
          value={draft}
          autoSize={{ minRows: 4, maxRows: 6 }}
          disabled={isSubmitting}
          placeholder="比如：把右上角的按钮换成输入框，或者新增一个两页签布局。"
          onChange={(event) => setDraft(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              sendPrompt(draft);
            }
          }}
        />

        <div className="designer-ai-composer__footer">
          <div className="designer-ai-composer__model">{MODEL_NAME}</div>
          <Button
            type="primary"
            icon={isSubmitting ? <StopOutlined /> : <SendOutlined />}
            disabled={!draft.trim() || isSubmitting}
            onClick={() => sendPrompt(draft)}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};
