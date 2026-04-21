import type { NextApiRequest, NextApiResponse } from 'next';

import type { AssistantRequestBody, AssistantRequestMessage, AssistantResponse } from '../../../utils/ai-assistant';
import { normalizeAssistantSchema } from '../../../utils/ai-assistant';
import { runAssistantGraphStream } from '../../../utils/ai-assistant-langgraph';
import type { AssistantStreamEvent } from '../../../utils/ai-assistant-stream';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

const isChatRole = (value: unknown): value is AssistantRequestMessage['role'] =>
  value === 'assistant' || value === 'user';

const sendError = (
  res: NextApiResponse<AssistantResponse | ErrorResponse>,
  status: number,
  code: string,
  message: string
) => res.status(status).json({ error: { code, message } });

const sanitizeMessages = (value: unknown): AssistantRequestMessage[] => {
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
    .filter(Boolean) as AssistantRequestMessage[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssistantResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', '仅支持 POST 请求。');
  }

  let requestBody: AssistantRequestBody = {};

  try {
    requestBody =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return sendError(res, 400, 'INVALID_JSON', '请求体不是有效的 JSON。');
  }

  const messages = sanitizeMessages(requestBody.messages);

  if (!messages.length) {
    return sendError(res, 400, 'EMPTY_MESSAGES', '请输入内容后再发送。');
  }

  const apiKey = process.env.MINIMAX_API_KEY?.trim();

  if (!apiKey) {
    return sendError(
      res,
      503,
      'CONFIG_MISSING',
      'AI 服务未配置，请先在服务端设置 MINIMAX_API_KEY。'
    );
  }

  let finalEvent:
    | Extract<AssistantStreamEvent, { type: 'preview_ready' }>
    | Extract<AssistantStreamEvent, { type: 'reply_ready' }>
    | Extract<AssistantStreamEvent, { type: 'clarify_ready' }>
    | null = null;

  try {
    await runAssistantGraphStream({
      messages,
      schema: normalizeAssistantSchema(requestBody.schema),
      activePageId:
        typeof requestBody.activePageId === 'string'
          ? requestBody.activePageId
          : undefined,
      selectedNodeId:
        typeof requestBody.selectedNodeId === 'string'
          ? requestBody.selectedNodeId
          : null,
      onEvent: (event) => {
        if (
          event.type === 'preview_ready' ||
          event.type === 'reply_ready' ||
          event.type === 'clarify_ready'
        ) {
          finalEvent = event;
        }
      },
    });
  } catch (error) {
    return sendError(
      res,
      502,
      'REQUEST_FAILED',
      error instanceof Error ? error.message : 'AI 请求失败。'
    );
  }

  if (!finalEvent) {
    return sendError(res, 502, 'EMPTY_RESULT', 'AI 暂时没有返回可用结果。');
  }

  if (finalEvent.type === 'preview_ready') {
    return res.status(200).json({
      type: 'preview',
      model: 'MiniMax-M2.7',
      message: {
        role: 'assistant',
        content: finalEvent.message,
      },
      targetSummary: finalEvent.targetSummary,
      draftSchema: finalEvent.draftSchema,
    });
  }

  if (finalEvent.type === 'clarify_ready') {
    return res.status(200).json({
      type: 'clarify',
      model: 'MiniMax-M2.7',
      message: {
        role: 'assistant',
        content: finalEvent.message,
      },
    });
  }

  return res.status(200).json({
    type: 'reply',
    model: 'MiniMax-M2.7',
    message: {
      role: 'assistant',
      content: finalEvent.message,
    },
  });
}
