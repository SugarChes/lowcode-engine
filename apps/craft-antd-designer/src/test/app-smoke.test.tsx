import React from 'react';
import { render, screen } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { describe, expect, it } from 'vitest';
import App from '../app/App';

describe('designer app shell', () => {
  it('renders the core workbench panels', () => {
    render(
      <ConfigProvider>
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>,
    );

    expect(screen.getByText('组件库')).toBeTruthy();
    expect(screen.getByText('页面大纲')).toBeTruthy();
    expect(screen.getAllByText('属性').length).toBeGreaterThan(0);
  });
});
