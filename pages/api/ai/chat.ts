import type { NextApiRequest, NextApiResponse } from 'next';

const DEFAULT_MODEL = 'MiniMax-M2.7' as const;
const DEFAULT_BASE_URL = 'https://api.minimaxi.com/v1';
const REQUEST_TIMEOUT_MS = 45000;

type ChatRole = 'assistant' | 'user';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
  scope?: string;
  selectedNodeName?: string | null;
};

type ChatSuccessResponse = {
  message: {
    role: 'assistant';
    content: string;
  };
  model: typeof DEFAULT_MODEL;
};

type ChatErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

const isChatRole = (value: unknown): value is ChatRole =>
  value === 'assistant' || value === 'user';

const normalizeBaseUrl = (value?: string) =>
  (value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');

const sendError = (
  res: NextApiResponse<ChatSuccessResponse | ChatErrorResponse>,
  status: number,
  code: string,
  message: string
) => res.status(status).json({ error: { code, message } });

const sanitizeMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;

      if (!isChatRole(role) || typeof content !== 'string') {
        return null;
      }

      const normalizedContent = content.trim();

      if (!normalizedContent) {
        return null;
      }

      return {
        role,
        content: normalizedContent,
      };
    })
    .filter(Boolean) as ChatMessage[];
};

const buildSystemPrompt = (scope: string, selectedNodeName?: string | null) =>
  [
    '你是一个中文低代码设计器中的布局建议助手。',
    '你的任务是根据当前画布上下文，给出页面结构、组件组织、间距层级、文案区块和交互建议。',
    '你不能声称自己已经修改了画布，也不要输出 Schema、JSON 或代码块，除非用户明确要求。',
    '默认输出简洁、可执行、偏产品设计与布局规划的建议。',
    '请优先使用自然语言短段落或简单编号表达，不要使用 Markdown 标题、表格、代码块或 ASCII 结构图。',
    `当前作用域：${scope}`,
    `当前选中组件：${selectedNodeName || '未选中组件'}`,
  ].join('\n');

const extractTextContent = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      if (!item || typeof item !== 'object') {
        return '';
      }

      const text = (item as { text?: unknown }).text;

      return typeof text === 'string' ? text : '';
    })
    .join('');
};

const stripThinkingContent = (value: string) =>
  value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatSuccessResponse | ChatErrorResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', '仅支持 POST 请求。');
  }

  const apiKey = process.env.MINIMAX_API_KEY?.trim();

  if (!apiKey) {
    return sendError(
      res,
      503,
      'CONFIG_MISSING',
      'AI 服务未配置，请在服务端设置 MINIMAX_API_KEY。'
    );
  }

  let requestBody: ChatRequestBody = {};

  try {
    requestBody =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return sendError(
      res,
      400,
      'INVALID_JSON',
      '请求内容格式不正确，请稍后重试。'
    );
  }

  const messages = sanitizeMessages(requestBody.messages);

  if (!messages.length) {
    return sendError(
      res,
      400,
      'EMPTY_MESSAGES',
      '请先输入内容再发送。'
    );
  }

  const scope =
    typeof requestBody.scope === 'string' && requestBody.scope.trim()
      ? requestBody.scope.trim()
      : '当前画布';
  const selectedNodeName =
    typeof requestBody.selectedNodeName === 'string' &&
    requestBody.selectedNodeName.trim()
      ? requestBody.selectedNodeName.trim()
      : null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(
      `${normalizeBaseUrl(process.env.MINIMAX_BASE_URL)}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          stream: false,
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(scope, selectedNodeName),
            },
            ...messages,
          ],
        }),
        signal: controller.signal,
      }
    );

    const rawResponseText = await upstreamResponse.text();
    let rawResponseJson: any = null;

    try {
      rawResponseJson = rawResponseText ? JSON.parse(rawResponseText) : null;
    } catch {
      rawResponseJson = null;
    }

    if (!upstreamResponse.ok) {
      if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
        return sendError(
          res,
          502,
          'UPSTREAM_AUTH_FAILED',
          'MiniMax 鉴权失败，请检查服务端 MINIMAX_API_KEY。'
        );
      }

      if (upstreamResponse.status === 429) {
        return sendError(
          res,
          429,
          'RATE_LIMITED',
          'MiniMax 请求过于频繁，请稍后再试。'
        );
      }

      return sendError(
        res,
        502,
        'UPSTREAM_FAILED',
        'MiniMax 服务暂时不可用，请稍后重试。'
      );
    }

    const assistantContent = stripThinkingContent(
      extractTextContent(rawResponseJson?.choices?.[0]?.message?.content)
    );

    if (!assistantContent) {
      return sendError(
        res,
        502,
        'EMPTY_UPSTREAM_CONTENT',
        'AI 暂时没有返回有效内容，请稍后重试。'
      );
    }

    return res.status(200).json({
      message: {
        role: 'assistant',
        content: assistantContent,
      },
      model: DEFAULT_MODEL,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      return sendError(
        res,
        504,
        'REQUEST_TIMEOUT',
        'AI 响应超时，请稍后重试。'
      );
    }

    return sendError(
      res,
      502,
      'REQUEST_FAILED',
      'AI 服务暂时不可用，请稍后重试。'
    );
  } finally {
    clearTimeout(timeout);
  }
}
