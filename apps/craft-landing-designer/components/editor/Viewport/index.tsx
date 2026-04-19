import { useEditor } from '@craftjs/core';
import cx from 'classnames';
import React from 'react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Toolbox } from './Toolbox';

export type ViewportProps = {
  children?: React.ReactNode;
  pageName: string;
  saveStatusText: string;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onReset: () => void;
};

export const Viewport: React.FC<ViewportProps> = ({
  children,
  pageName,
  saveStatusText,
  onOpenImport,
  onOpenExport,
  onReset,
}) => {
  const {
    enabled,
    connectors,
    actions: { setOptions },
  } = useEditor((state) => ({
    enabled: state.options.enabled,
  }));

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      setTimeout(() => {
        setOptions((options) => {
          options.enabled = true;
        });
      }, 200);
    });
  }, [setOptions]);

  return (
    <div className="viewport">
      <div className="designer-shell">
        <Toolbox />
        <div className="page-container designer-main">
          <Header
            pageName={pageName}
            saveStatusText={saveStatusText}
            onOpenImport={onOpenImport}
            onOpenExport={onOpenExport}
            onReset={onReset}
          />
          <div
            className={cx('craftjs-renderer designer-canvas-scroll', {
              'bg-renderer-gray': enabled,
            })}
            ref={(ref) => {
              connectors.select(connectors.hover(ref, null), null);
            }}
          >
            <div className="designer-canvas-stage">
              <div className="designer-canvas-frame">{children}</div>
            </div>
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
};
