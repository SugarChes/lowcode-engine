import React from 'react';
import { useEditor, useNode } from '@craftjs/core';
import { ROOT_NODE } from '@craftjs/utils';
import ReactDOM from 'react-dom';
import { ArrowUpOutlined, DeleteOutlined, DragOutlined } from '@ant-design/icons';
import { describeMaterial } from '../../materials/defs';

type RenderNodeProps = {
  render: React.ReactElement;
};

export default function RenderNode({ render }: RenderNodeProps) {
  const { id } = useNode();
  const { actions, query, isActive } = useEditor((_, queryMethods) => ({
    isActive: queryMethods.getEvent('selected').contains(id),
  }));

  const {
    isHover,
    dom,
    displayName,
    moveable,
    deletable,
    connectors: { drag },
    parentId,
  } = useNode((node) => ({
    isHover: node.events.hovered,
    dom: node.dom as HTMLElement | null,
    displayName: node.data.custom?.displayName || node.data.displayName || node.data.name,
    moveable: query.node(node.id).isDraggable(),
    deletable: query.node(node.id).isDeletable(),
    parentId: node.data.parent,
  }));

  const currentRef = React.useRef<HTMLDivElement | null>(null);
  const label = React.useMemo(() => describeMaterial(displayName).title || displayName, [displayName]);

  React.useEffect(() => {
    if (!dom) return undefined;

    if (isActive || isHover) {
      dom.classList.add('component-selected');
    } else {
      dom.classList.remove('component-selected');
    }

    return () => {
      dom.classList.remove('component-selected');
    };
  }, [dom, isActive, isHover]);

  const getPos = React.useCallback((targetDom: HTMLElement | null) => {
    const { top, left, bottom } = targetDom ? targetDom.getBoundingClientRect() : { top: 0, left: 0, bottom: 0 };

    return {
      top: `${top > 0 ? top : bottom}px`,
      left: `${left}px`,
    };
  }, []);

  const syncToolbarPosition = React.useCallback(() => {
    const currentDom = currentRef.current;
    if (!currentDom) return;

    const { top, left } = getPos(dom);
    currentDom.style.top = top;
    currentDom.style.left = left;
  }, [dom, getPos]);

  React.useEffect(() => {
    const renderer = document.querySelector('.craftjs-renderer');
    if (!renderer) return undefined;

    renderer.addEventListener('scroll', syncToolbarPosition);
    window.addEventListener('resize', syncToolbarPosition);

    return () => {
      renderer.removeEventListener('scroll', syncToolbarPosition);
      window.removeEventListener('resize', syncToolbarPosition);
    };
  }, [syncToolbarPosition]);

  const portalHost = document.querySelector('.page-container');

  return (
    <>
      {portalHost && (isHover || isActive) && dom
        ? ReactDOM.createPortal(
            <div
              ref={currentRef}
              className="render-node-toolbar"
              style={{
                left: getPos(dom).left,
                top: getPos(dom).top,
              }}
            >
              <span className="render-node-toolbar__title">{label}</span>
              {moveable ? (
                <button
                  className="render-node-toolbar__button"
                  ref={(button) => {
                    if (button) {
                      drag(button);
                    }
                  }}
                  title="拖动组件"
                  type="button"
                >
                  <DragOutlined />
                </button>
              ) : null}
              {id !== ROOT_NODE ? (
                <button
                  className="render-node-toolbar__button"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (parentId) {
                      actions.selectNode(parentId);
                    }
                  }}
                  title="选中父级"
                  type="button"
                >
                  <ArrowUpOutlined />
                </button>
              ) : null}
              {deletable ? (
                <button
                  className="render-node-toolbar__button"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    actions.delete(id);
                  }}
                  title="删除组件"
                  type="button"
                >
                  <DeleteOutlined />
                </button>
              ) : null}
            </div>,
            portalHost,
          )
        : null}
      {render}
    </>
  );
}
