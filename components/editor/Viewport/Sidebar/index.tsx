import { Layers } from '@craftjs/layers';
import { OrderedListOutlined, SettingOutlined } from '@ant-design/icons';
import { Tabs, Typography } from 'antd';
import React from 'react';

import { PropsPanel } from '../../../designer/PropsPanel';

export const Sidebar = () => {
  return (
    <aside className="designer-sidebar">
      <div className="designer-sidebar__header">
        <Typography.Title level={5} style={{ margin: 0 }}>
          属性与结构
        </Typography.Title>
        <Typography.Text type="secondary">
          在这里配置组件属性并查看层级树
        </Typography.Text>
      </div>
      <Tabs
        className="designer-sidebar__tabs"
        defaultActiveKey="props"
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
        ]}
      />
    </aside>
  );
};
