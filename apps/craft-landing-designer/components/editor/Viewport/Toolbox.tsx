import { useEditor } from '@craftjs/core';
import { Collapse, Typography } from 'antd';
import React from 'react';

import { MATERIAL_GROUPS, MATERIALS } from '../../designer/materials';

export const Toolbox = () => {
  const {
    connectors: { create },
  } = useEditor();

  return (
    <aside className="designer-toolbox">
      <div className="designer-toolbox__header">
        <Typography.Title level={5} style={{ margin: 0 }}>
          组件库
        </Typography.Title>
        <Typography.Text type="secondary">
          拖拽组件到中间画布进行布局
        </Typography.Text>
      </div>
      <Collapse
        bordered={false}
        defaultActiveKey={MATERIAL_GROUPS.map((group) => group.key)}
        items={MATERIAL_GROUPS.map((group) => ({
          key: group.key,
          label: group.title,
          children: (
            <div className="designer-material-grid">
              {MATERIALS.filter((material) => material.group === group.key).map(
                (material) => (
                  <div
                    key={material.componentName}
                    ref={(ref) => {
                      if (ref) {
                        create(ref, material.snippet());
                      }
                    }}
                    className="designer-material-card"
                  >
                    <div className="designer-material-card__icon">{material.icon}</div>
                    <div className="designer-material-card__title">
                      {material.title}
                    </div>
                  </div>
                )
              )}
            </div>
          ),
        }))}
      />
    </aside>
  );
};
