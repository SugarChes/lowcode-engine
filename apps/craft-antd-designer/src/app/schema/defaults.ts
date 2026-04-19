import type { SerializedNodes } from '@craftjs/core';
import { ROOT_NODE } from '@craftjs/core';
import type { ApiSchema, MethodSchema } from './types';

export const DEFAULT_PAGE_STATE: Record<string, unknown> = {
  searchText: '',
  activeTab: 'overview',
  selectedRowCount: 0,
};

export const DEFAULT_METHODS: MethodSchema[] = [
  {
    id: 'method-log-selection',
    name: 'logSelection',
    description: '将当前页面状态快照输出到浏览器控制台。',
  },
];

export const DEFAULT_APIS: ApiSchema[] = [
  {
    id: 'api-load-users',
    name: 'loadUsers',
    url: '/api/users',
    method: 'GET',
    mockResponse: [
      { key: '1', name: '林青', title: '设计师', status: '启用' },
      { key: '2', name: '王睿', title: '工程师', status: '待处理' },
      { key: '3', name: '赵宁', title: '产品经理', status: '启用' },
    ],
  },
];

export function createDefaultSerializedNodes(): SerializedNodes {
  return {
    [ROOT_NODE]: {
      type: { resolvedName: 'CanvasRoot' },
      isCanvas: true,
      props: {
        title: '页面画布',
        style: {
          minHeight: '100%',
          padding: '8px',
        },
      },
      displayName: 'CanvasRoot',
      custom: {
        locked: true,
        eventFlows: [],
      },
      hidden: false,
      nodes: ['container-main'],
      linkedNodes: {},
      parent: null,
    },
    'container-main': {
      type: { resolvedName: 'Container' },
      isCanvas: true,
      props: {
        title: '查询工作区',
        style: {
          backgroundColor: '#ffffff',
          padding: '16px',
          borderRadius: 6,
          minHeight: '280px',
          boxShadow: '0 6px 24px rgba(15, 23, 42, 0.08)',
        },
      },
      displayName: 'Container',
      custom: {
        locked: false,
        eventFlows: [],
      },
      hidden: false,
      nodes: ['row-search', 'table-users'],
      linkedNodes: {},
      parent: ROOT_NODE,
    },
    'row-search': {
      type: { resolvedName: 'Row' },
      isCanvas: true,
      props: {
        gutter: 16,
        style: {
          marginBottom: '16px',
        },
      },
      displayName: 'Row',
      custom: {
        locked: false,
        eventFlows: [],
      },
      hidden: false,
      nodes: ['col-input', 'col-button'],
      linkedNodes: {},
      parent: 'container-main',
    },
    'col-input': {
      type: { resolvedName: 'Col' },
      isCanvas: true,
      props: {
        span: 18,
      },
      displayName: 'Col',
      custom: {
        locked: false,
        eventFlows: [],
      },
      hidden: false,
      nodes: ['input-search'],
      linkedNodes: {},
      parent: 'row-search',
    },
    'col-button': {
      type: { resolvedName: 'Col' },
      isCanvas: true,
      props: {
        span: 6,
      },
      displayName: 'Col',
      custom: {
        locked: false,
        eventFlows: [],
      },
      hidden: false,
      nodes: ['button-search'],
      linkedNodes: {},
      parent: 'row-search',
    },
    'input-search': {
      type: { resolvedName: 'Input' },
      isCanvas: false,
      props: {
        placeholder: '输入姓名后搜索',
        value: '',
        allowClear: true,
      },
      displayName: 'Input',
      custom: {
        locked: false,
        eventFlows: [
          {
            nodeId: 'input-search',
            eventName: 'onChange',
            actions: [
              {
                id: 'action-set-search',
                type: 'setState',
                key: 'searchText',
                value: { kind: 'eventParam', path: 'value' },
              },
            ],
          },
        ],
      },
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: 'col-input',
    },
    'button-search': {
      type: { resolvedName: 'Button' },
      isCanvas: false,
      props: {
        label: '执行搜索',
        buttonType: 'primary',
        block: true,
      },
      displayName: 'Button',
      custom: {
        locked: false,
        eventFlows: [
          {
            nodeId: 'button-search',
            eventName: 'onClick',
            actions: [
              {
                id: 'action-check-search',
                type: 'if',
                condition: {
                  left: { kind: 'state', key: 'searchText' },
                  operator: 'truthy',
                },
                then: [
                  {
                    id: 'action-show-message',
                    type: 'message',
                    level: 'success',
                    content: { kind: 'literal', value: '已应用搜索条件。' },
                  },
                ],
                else: [
                  {
                    id: 'action-warn-message',
                    type: 'message',
                    level: 'warning',
                    content: { kind: 'literal', value: '请先输入搜索内容。' },
                  },
                ],
              },
            ],
          },
        ],
      },
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: 'col-button',
    },
    'table-users': {
      type: { resolvedName: 'Table' },
      isCanvas: false,
      props: {
        title: '用户列表',
        columns: [
          { title: '姓名', dataIndex: 'name', key: 'name' },
          { title: '角色', dataIndex: 'title', key: 'title' },
          { title: '状态', dataIndex: 'status', key: 'status' },
        ],
        dataSource: [
          { key: '1', name: '林青', title: '设计师', status: '启用' },
          { key: '2', name: '王睿', title: '工程师', status: '待处理' },
        ],
        pagination: false,
      },
      displayName: 'Table',
      custom: {
        locked: false,
        eventFlows: [
          {
            nodeId: 'table-users',
            eventName: 'onSelectRow',
            actions: [
              {
                id: 'action-set-selected-count',
                type: 'setState',
                key: 'selectedRowCount',
                value: { kind: 'eventParam', path: 'selectedRowKeys.length' },
              },
            ],
          },
        ],
      },
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: 'container-main',
    },
  };
}
