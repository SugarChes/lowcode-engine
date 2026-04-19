import { useEditor } from '@craftjs/core';
import {
  DeleteOutlined,
  DownloadOutlined,
  RedoOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Space, Tag, Typography } from 'antd';
import React from 'react';

export type HeaderProps = {
  pageName: string;
  saveStatusText: string;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onReset: () => void;
};

export const Header: React.FC<HeaderProps> = ({
  pageName,
  saveStatusText,
  onOpenImport,
  onOpenExport,
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
        <Space size={8}>
          <Tag color="blue">{pageName}</Tag>
          <Typography.Text type="secondary">{saveStatusText}</Typography.Text>
        </Space>
      </div>
      <Space size={8} wrap>
        <Button
          icon={<UndoOutlined />}
          disabled={!canUndo}
          onClick={() => actions.history.undo()}
        >
          撤销
        </Button>
        <Button
          icon={<RedoOutlined />}
          disabled={!canRedo}
          onClick={() => actions.history.redo()}
        >
          重做
        </Button>
        <Button icon={<UploadOutlined />} onClick={onOpenImport}>
          导入 Schema
        </Button>
        <Button type="primary" icon={<DownloadOutlined />} onClick={onOpenExport}>
          导出 Schema
        </Button>
        <Button danger icon={<DeleteOutlined />} onClick={onReset}>
          重置画布
        </Button>
      </Space>
    </header>
  );
};
