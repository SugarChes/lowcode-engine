import React from 'react';
import { ROOT_NODE, useEditor } from '@craftjs/core';
import { DownOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { createSnippet, MATERIAL_DND_TYPE, MaterialBadge, materialMetas } from '../../materials/defs';

type LibraryTab = 'components' | 'templates';

const GROUP_ORDER = ['布局', '基础控件', '复杂控件'];
const GROUP_LABELS: Record<string, string> = {
  布局: '容器',
  基础控件: '基础字段',
  复杂控件: '业务组件',
};

const TEMPLATE_ITEMS = [
  { key: 'template-query-form', title: '查询表单', componentName: 'FormGroup' },
  { key: 'template-two-columns', title: '双列布局', componentName: 'Row' },
  { key: 'template-tabs-page', title: '标签布局', componentName: 'Tabs' },
  { key: 'template-data-table', title: '数据表格', componentName: 'Table' },
];

function findInsertTarget(selectedNodeId: string | null, query: ReturnType<typeof useEditor>['query']) {
  if (!selectedNodeId) {
    return ROOT_NODE;
  }

  if (query.node(selectedNodeId).isCanvas()) {
    return selectedNodeId;
  }

  const ancestors = query.node(selectedNodeId).ancestors(true);
  const canvasAncestor = ancestors.find((ancestorId) => query.node(ancestorId).isCanvas());

  return canvasAncestor || ROOT_NODE;
}

export default function MaterialPanel() {
  const { actions, query, selectedNodeId } = useEditor((state) => {
    const firstSelected = Array.from(state.events.selected)[0];
    return { selectedNodeId: firstSelected ?? null };
  });

  const [activeTab, setActiveTab] = React.useState<LibraryTab>('components');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({
    布局: false,
    基础控件: false,
    复杂控件: false,
  });
  const skipNextClickRef = React.useRef(false);

  const grouped = React.useMemo(() => {
    const baseGroups = materialMetas.reduce<Record<string, typeof materialMetas>>((acc, meta) => {
      acc[meta.group] = acc[meta.group] || [];
      acc[meta.group].push(meta);
      return acc;
    }, {});

    return GROUP_ORDER.filter((groupName) => baseGroups[groupName]?.length).map((groupName) => ({
      key: groupName,
      title: GROUP_LABELS[groupName] || groupName,
      items: baseGroups[groupName],
    }));
  }, []);

  const insertSnippet = React.useCallback(
    (componentName: string) => {
      const targetParentId = findInsertTarget(selectedNodeId, query);
      const targetNode = query.node(targetParentId).get();
      const nextIndex = targetNode.data.nodes.length;
      const tree = query.parseReactElement(createSnippet(componentName)).toNodeTree();

      actions.addNodeTree(tree, targetParentId, nextIndex);
      actions.selectNode(tree.rootNodeId);
    },
    [actions, query, selectedNodeId],
  );

  const toggleSection = (groupKey: string) => {
    setCollapsed((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const onMaterialClick = (componentName: string) => {
    if (skipNextClickRef.current) {
      skipNextClickRef.current = false;
      return;
    }
    insertSnippet(componentName);
  };

  const onMaterialDragStart = (event: React.DragEvent<HTMLElement>, componentName: string) => {
    skipNextClickRef.current = true;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(MATERIAL_DND_TYPE, componentName);
    event.dataTransfer.setData('text/plain', componentName);
  };

  return (
    <div className="material-panel">
      <div className="material-panel__tabs">
        <button
          className={`material-panel__tab ${activeTab === 'components' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('components')}
          type="button"
        >
          组件库
        </button>
        <button
          className={`material-panel__tab ${activeTab === 'templates' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('templates')}
          type="button"
        >
          表单模板
        </button>
      </div>

      <div className="material-panel__body">
        {activeTab === 'components' ? (
          grouped.map((group) => {
            const isCollapsed = Boolean(collapsed[group.key]);
            return (
              <section className="material-section" key={group.key}>
                <button className="material-section__header" onClick={() => toggleSection(group.key)} type="button">
                  <span>{group.title}</span>
                  {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                </button>
                {!isCollapsed ? (
                  <div className="material-grid">
                    {group.items.map((meta) => (
                      <div
                        key={meta.componentName}
                        className="material-item"
                        draggable
                        role="button"
                        tabIndex={0}
                        title={meta.snippetTitle}
                        onClick={() => onMaterialClick(meta.componentName)}
                        onDragStart={(event) => onMaterialDragStart(event, meta.componentName)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            insertSnippet(meta.componentName);
                          }
                        }}
                      >
                        <MaterialBadge icon={meta.icon} title={meta.title} />
                        <span className="material-item__action">
                          <PlusOutlined />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <>
            <section className="material-section">
              <button className="material-section__header" type="button">
                <span>模板片段</span>
                <DownOutlined />
              </button>
              <div className="material-grid">
                {TEMPLATE_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="material-item"
                    draggable
                    role="button"
                    tabIndex={0}
                    onClick={() => onMaterialClick(item.componentName)}
                    onDragStart={(event) => onMaterialDragStart(event, item.componentName)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        insertSnippet(item.componentName);
                      }
                    }}
                  >
                    <MaterialBadge icon="模" title={item.title} />
                    <span className="material-item__action">
                      <PlusOutlined />
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <div className="material-panel__empty">支持拖拽到画布，也支持点一下直接插入到当前选中的容器或页面画布。</div>
          </>
        )}
      </div>
    </div>
  );
}
