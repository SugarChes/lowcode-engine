import { Layers } from '@craftjs/layers';
import {
  OrderedListOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Tabs } from 'antd';
import React from 'react';

import { PropsPanel } from '../../../designer/PropsPanel';
import { AiAssistantPanel } from './AiAssistantPanel';

export type SidebarProps = {
  activeKey: string;
  onActiveKeyChange: (activeKey: string) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeKey,
  onActiveKeyChange,
}) => {
  return (
    <aside className="designer-sidebar">
      <Tabs
        className="designer-sidebar__tabs"
        activeKey={activeKey}
        onChange={onActiveKeyChange}
        items={[
          {
            key: 'props',
            label: (
              <span>
                <SettingOutlined />
                属性
              </span>
            ),
            children: <PropsPanel />,
          },
          {
            key: 'layers',
            label: (
              <span>
                <OrderedListOutlined />
                大纲
              </span>
            ),
            children: (
              <div className="designer-layers-wrapper">
                <Layers expandRootOnLoad={true} />
              </div>
            ),
          },
          {
            key: 'ai',
            label: (
              <span>
                <RobotOutlined />
                AI
              </span>
            ),
            children: <AiAssistantPanel />,
          },
        ]}
      />
    </aside>
  );
};
