import { useEditor } from '@craftjs/core';
import {
  DeleteOutlined,
  DownloadOutlined,
  RedoOutlined,
  RobotOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React from 'react';

export type HeaderProps = {
  saveStatusText: string;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenAiAssistant: () => void;
  onReset: () => void;
};

export const Header: React.FC<HeaderProps> = ({
  saveStatusText,
  onOpenImport,
  onOpenExport,
  onOpenAiAssistant,
  onReset,
}) => {
  const { canUndo, canRedo, actions } = useEditor((_, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));

  return (
    <header className="designer-header">
      <div className="designer-header__brand">
        <Typography.Title level={5} style={{ margin: 0 }}>
          低代码设计器
        </Typography.Title>
        <Typography.Text type="secondary">{saveStatusText}</Typography.Text>
      </div>
      <div className="designer-header__actions">
        <Button
          icon={<UndoOutlined />}
          disabled={!canUndo}
          title="撤销"
          aria-label="撤销"
          onClick={() => actions.history.undo()}
        />
        <Button
          icon={<RedoOutlined />}
          disabled={!canRedo}
          title="重做"
          aria-label="重做"
          onClick={() => actions.history.redo()}
        />
        <Button icon={<RobotOutlined />} onClick={onOpenAiAssistant}>
          AI 布局
        </Button>
        <Button icon={<UploadOutlined />} onClick={onOpenImport}>
          导入
        </Button>
        <Button type="primary" icon={<DownloadOutlined />} onClick={onOpenExport}>
          导出
        </Button>
        <Button danger icon={<DeleteOutlined />} onClick={onReset}>
          重置
        </Button>
      </div>
    </header>
  );
};
