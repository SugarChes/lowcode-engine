# 中文低代码设计器

这是当前主线项目，基于 Craft.js landing 示例改造。

## 启动

```bash
npm install
npm start
```

如果 Windows 环境里 `npm start` 报“拒绝访问”，可以用：

```powershell
.\start-win.ps1
```

默认地址：

```text
http://localhost:3002/
```

## 目录

- `pages/`: Next.js 页面入口
- `components/`: 设计器组件
- `styles/`: 全局样式
- `public/`: 静态资源
- `reference-projects/`: 参考项目和历史方案，不是当前主线

## 参考项目

- `reference-projects/alibaba-lowcode-engine`: 原始 Alibaba lowcode-engine monorepo 结构
- `reference-projects/craft-antd-designer`: 旧的 Ant Design/Vite 备用方案
