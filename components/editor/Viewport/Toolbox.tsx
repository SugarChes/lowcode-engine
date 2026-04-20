import { useEditor } from '@craftjs/core';
import { Typography } from 'antd';
import React from 'react';

import { MATERIALS } from '../../designer/materials';

const TOOLBOX_GROUPS = [
  {
    key: 'basic',
    title: '基础控件',
    componentNames: ['ButtonMaterial', 'InputMaterial'],
  },
  {
    key: 'advanced',
    title: '高级控件',
    componentNames: ['TabsMaterial', 'TableMaterial', 'FormGroupMaterial'],
  },
  {
    key: 'layout',
    title: '布局控件',
    componentNames: [
      'Container',
      'RowMaterial',
      'ColMaterial',
      'FlexMaterial',
      'SpaceMaterial',
    ],
  },
];

export const Toolbox = () => {
  const {
    enabled,
    connectors: { create },
  } = useEditor((state) => ({
    enabled: state.options.enabled,
  }));

  return (
    <aside className="designer-toolbox">
      <div className="designer-toolbox__header">
        <Typography.Title level={5} style={{ margin: 0 }}>
          组件库
        </Typography.Title>
      </div>
      <div className="designer-toolbox__body">
        {TOOLBOX_GROUPS.map((group) => (
          <section key={group.key} className="designer-toolbox__section">
            <div className="designer-toolbox__section-title">{group.title}</div>
            <div className="designer-material-grid">
              {MATERIALS.filter((material) =>
                group.componentNames.includes(material.componentName)
              ).map((material) => (
                <div
                  key={`${material.componentName}-${enabled ? 'enabled' : 'disabled'}`}
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
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
};
