import type { AppSchema } from '../components/designer/schema';

export type AssistantTracePhase =
  | 'plan'
  | 'locate'
  | 'tool'
  | 'validate'
  | 'finalize';

export type AssistantTraceStatus = 'start' | 'progress' | 'end' | 'error';

export type AssistantTraceEvent = {
  phase: AssistantTracePhase;
  status: AssistantTraceStatus;
  title: string;
  detail?: string;
};

export type AssistantStreamEvent =
  | {
      type: 'run_started';
      model: string;
    }
  | ({
      type: 'trace';
    } & AssistantTraceEvent)
  | {
      type: 'message_token';
      token: string;
    }
  | {
      type: 'preview_ready';
      message: string;
      targetSummary: string;
      draftSchema: AppSchema;
    }
  | {
      type: 'reply_ready';
      message: string;
    }
  | {
      type: 'clarify_ready';
      message: string;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    }
  | {
      type: 'done';
    };

export type FindNodesInput = {
  query: string;
};

export type InsertNodeInput = {
  command: Record<string, unknown>;
};

export type ReplaceNodeInput = {
  command: Record<string, unknown>;
};

export type UpdatePropsInput = {
  command: Record<string, unknown>;
};

export type DeleteNodeInput = {
  command: Record<string, unknown>;
};
