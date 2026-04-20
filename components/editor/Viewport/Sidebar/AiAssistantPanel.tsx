import { useEditor } from '@craftjs/core';
import { LoadingOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Input, Space, Typography } from 'antd';
import React from 'react';

const { TextArea } = Input;

const MODEL_NAME = 'MiniMax-M2.7';
const DEFAULT_SCOPE = '当前画布';

type ChatRole = 'assistant' | 'user';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  persist: boolean;
  variant?: 'default' | 'error';
};

type ChatRequestMessage = {
  role: ChatRole;
  content: string;
};

type ChatResponse = {
  message: {
    role: 'assistant';
    content: string;
  };
  model: string;
};

type ChatErrorResponse = {
  error?: {
    message?: string;
    code?: string;
  };
};

const createMessageId = () =>
  `ai-message-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createAssistantMessage = (
  content: string,
  options?: Partial<Pick<ChatMessage, 'persist' | 'variant'>>
): ChatMessage => ({
  id: createMessageId(),
  role: 'assistant',
  content,
  persist: options?.persist ?? true,
  variant: options?.variant ?? 'default',
});

const createUserMessage = (content: string): ChatMessage => ({
  id: createMessageId(),
  role: 'user',
  content,
  persist: true,
});

const buildRequestHistory = (messages: ChatMessage[]) =>
  messages
    .filter((message) => message.persist)
    .map(({ role, content }) => ({ role, content }));

const isChatResponse = (
  value: ChatResponse | ChatErrorResponse | null
): value is ChatResponse => Boolean(value && 'message' in value);

const isChatErrorResponse = (
  value: ChatResponse | ChatErrorResponse | null
): value is ChatErrorResponse => Boolean(value && 'error' in value);

const getNodeDisplayName = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return null;
};

export const AiAssistantPanel = () => {
  const [draft, setDraft] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    createAssistantMessage(
      '告诉我你想要的页面结构或布局目标，我会结合当前画布给出可执行的布局建议。',
      { persist: false }
    ),
  ]);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  const selectedContext = useEditor((state, query) => {
    const selectedId = query.getEvent('selected').first();
    const node = selectedId ? state.nodes[selectedId] : null;
    const selectedNodeName =
      getNodeDisplayName(node?.data.custom?.displayName) ||
      getNodeDisplayName(node?.data.displayName) ||
      getNodeDisplayName(node?.data.name) ||
      null;

    if (!selectedId || !node) {
      return {
        scope: DEFAULT_SCOPE,
        selectedNodeName: null,
      };
    }

    return {
      scope: '选中组件',
      selectedNodeName,
    };
  });

  const selectedNodeName = selectedContext.selectedNodeName;
  const scope = selectedContext.scope;
  const selectedText = selectedNodeName
    ? `上下文：${scope} · ${selectedNodeName}`
    : `上下文：${scope}`;

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [isSubmitting, messages]);

  const sendPrompt = React.useCallback(
    async (promptText: string) => {
      const normalizedPrompt = promptText.trim();

      if (isSubmitting) {
        return;
      }

      if (!normalizedPrompt) {
        setMessages((current) => [
          ...current,
          createAssistantMessage('请先输入内容再发送。', {
            persist: false,
            variant: 'error',
          }),
        ]);
        return;
      }

      const nextUserMessage = createUserMessage(normalizedPrompt);
      const requestMessages: ChatRequestMessage[] = [
        ...buildRequestHistory(messages),
        { role: nextUserMessage.role, content: nextUserMessage.content },
      ];

      setMessages((current) => [...current, nextUserMessage]);
      setDraft('');
      setIsSubmitting(true);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: requestMessages,
            scope,
            selectedNodeName,
          }),
        });

        const responseData =
          ((await response.json().catch(() => null)) as
            | ChatResponse
            | ChatErrorResponse
            | null) || null;

        if (!response.ok) {
          throw new Error(
            (isChatErrorResponse(responseData) && responseData.error?.message) ||
              'AI 服务暂时不可用，请稍后重试。'
          );
        }

        const assistantContent = isChatResponse(responseData)
          ? responseData.message.content.trim()
          : '';

        if (!assistantContent) {
          throw new Error('AI 返回内容为空，请稍后重试。');
        }

        setMessages((current) => [
          ...current,
          createAssistantMessage(assistantContent),
        ]);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'AI 请求失败，请稍后重试。';

        setMessages((current) => [
          ...current,
          createAssistantMessage(errorMessage, {
            persist: false,
            variant: 'error',
          }),
        ]);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, messages, scope, selectedNodeName]
  );

  return (
    <div className="designer-ai-panel">
      <div className="designer-ai-panel__top">
        <Space direction="vertical" size={8}>
          <Typography.Text strong>AI 布局助手</Typography.Text>
          <Typography.Text type="secondary">{selectedText}</Typography.Text>
        </Space>
      </div>

      <div className="designer-ai-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`designer-ai-message designer-ai-message--${message.role}${
              message.variant === 'error' ? ' designer-ai-message--error' : ''
            }`}
          >
            <div className="designer-ai-message__meta">
              <span className="designer-ai-message__role">
                {message.role === 'assistant' ? 'AI 助手' : '你'}
              </span>
            </div>
            <Typography.Paragraph style={{ margin: 0 }}>
              {message.content}
            </Typography.Paragraph>
          </div>
        ))}

        {isSubmitting ? (
          <div className="designer-ai-message designer-ai-message--assistant">
            <div className="designer-ai-message__meta">
              <span className="designer-ai-message__role">AI 助手</span>
            </div>
            <Typography.Paragraph style={{ margin: 0 }}>
              <LoadingOutlined /> 正在整理布局建议...
            </Typography.Paragraph>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="designer-ai-composer">
        <TextArea
          value={draft}
          autoSize={{ minRows: 4, maxRows: 6 }}
          disabled={isSubmitting}
          placeholder="例如：把当前页面改成品牌介绍 + 卖点 + 表单转化的结构"
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
            icon={<SendOutlined />}
            loading={isSubmitting}
            disabled={!draft.trim()}
            onClick={() => sendPrompt(draft)}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};
