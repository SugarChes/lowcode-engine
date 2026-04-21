import { useEditor } from '@craftjs/core';
import cx from 'classnames';
import React from 'react';

import type { AppSchema } from '../../designer/schema';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Toolbox } from './Toolbox';

export type ViewportProps = {
  children?: React.ReactNode;
  pageName: string;
  saveStatusText: string;
  aiSchema: AppSchema;
  activePageId: string;
  isAiPreviewing: boolean;
  aiPreviewTargetSummary?: string | null;
  onAiPreviewGenerated: (payload: {
    draftSchema: AppSchema;
    targetSummary: string;
    message: string;
  }) => void;
  onApplyAiPreview: () => void;
  onDiscardAiPreview: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onReset: () => void;
};

export const Viewport: React.FC<ViewportProps> = ({
  children,
  saveStatusText,
  aiSchema,
  activePageId,
  isAiPreviewing,
  aiPreviewTargetSummary,
  onAiPreviewGenerated,
  onApplyAiPreview,
  onDiscardAiPreview,
  onOpenImport,
  onOpenExport,
  onReset,
}) => {
  const [sidebarActiveKey, setSidebarActiveKey] = React.useState('props');
  const { enabled } = useEditor((state) => ({
    enabled: state.options.enabled,
  }));

  return (
    <div className="viewport">
      <div className="designer-shell">
        <Toolbox />
        <div className="page-container designer-main">
          <Header
            saveStatusText={saveStatusText}
            onOpenImport={onOpenImport}
            onOpenExport={onOpenExport}
            onOpenAiAssistant={() => setSidebarActiveKey('ai')}
            onReset={onReset}
          />
          <div
            className={cx('craftjs-renderer designer-canvas-scroll', {
              'bg-renderer-gray': enabled,
            })}
          >
            <div className="designer-canvas-stage">
              <div className="designer-canvas-frame">{children}</div>
            </div>
          </div>
        </div>
        <Sidebar
          activeKey={sidebarActiveKey}
          onActiveKeyChange={setSidebarActiveKey}
          aiAssistantProps={{
            schema: aiSchema,
            activePageId,
            isPreviewing: isAiPreviewing,
            previewTargetSummary: aiPreviewTargetSummary,
            onPreviewGenerated: onAiPreviewGenerated,
            onApplyPreview: onApplyAiPreview,
            onDiscardPreview: onDiscardAiPreview,
          }}
        />
      </div>
    </div>
  );
};
