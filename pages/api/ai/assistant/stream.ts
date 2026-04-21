import type { NextApiRequest, NextApiResponse } from 'next';

import type { AssistantRequestBody, AssistantRequestMessage } from '../../../../utils/ai-assistant';
import { normalizeAssistantSchema } from '../../../../utils/ai-assistant';
import { runAssistantGraphStream } from '../../../../utils/ai-assistant-langgraph';
import type { AssistantStreamEvent } from '../../../../utils/ai-assistant-stream';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

const isChatRole = (value: unknown): value is AssistantRequestMessage['role'] =>
  value === 'assistant' || value === 'user';

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

const sendJsonError = (
  res: NextApiResponse<ErrorResponse>,
  status: number,
  code: string,
  message: string
) => res.status(status).json({ error: { code, message } });

const writeEvent = (res: NextApiResponse, event: AssistantStreamEvent) => {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJsonError(res, 405, 'METHOD_NOT_ALLOWED', '仅支持 POST 请求。');
  }

  let requestBody: AssistantRequestBody = {};

  try {
    requestBody =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return sendJsonError(res, 400, 'INVALID_JSON', '请求体不是有效的 JSON。');
  }

  const messages = sanitizeMessages(requestBody.messages);

  if (!messages.length) {
    return sendJsonError(res, 400, 'EMPTY_MESSAGES', '请输入内容后再发送。');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const controller = new AbortController();
  const abortStream = () => {
    controller.abort();
  };

  req.socket?.on('close', abortStream);

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
      signal: controller.signal,
      onEvent: (event) => {
        if (!controller.signal.aborted) {
          writeEvent(res, event);
        }
      },
    });
  } catch (error) {
    if (!controller.signal.aborted) {
      writeEvent(res, {
        type: 'error',
        code: 'REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'AI 请求失败。',
      });
    }
  } finally {
    if (!controller.signal.aborted) {
      writeEvent(res, {
        type: 'done',
      });
    }

    req.socket?.off('close', abortStream);
    res.end();
  }
}
