# AGENT.md 项目上下文文档

> 依据当前仓库文件整理于 2026-10-11，请人工复核业务专属信息。本文只描述仓库事实。
> 完整跨端背景见[项目说明](./项目说明.md)，接口及原型详见 `docs/`。

## 项目简介

本仓库是正方形保险服务微信小程序，面向学生家长提供账户、产品展示和投保页面。登录、首页和个人资料存在真实服务调用；产品、订单及支付售后仍有本地配置与未接入部分。

包名称：`insurance-mini-program`；版本：`1.0.0`；独立仓库；根配置未声明 workspaces。

## 技术栈

- 框架：Taro 4.2.1、React 18.3.1。
- 语言：TypeScript；`compilerOptions.strict` 已开启。
- 样式方案：普通 CSS，Taro 尺寸转换；设计宽度 750。
- 状态管理：React Hooks 与 Taro 本地存储；未声明独立状态管理库。
- UI 组件库：Taro 原生组件；没有额外业务 UI 库。
- 构建工具：Taro CLI、Vite 4.5.5；输出目录 `dist/`。
- 测试工具：【待人工补充】自动测试框架；当前提供 TypeScript 检查脚本。
- 包管理与 Monorepo：README 使用 npm，有 `package-lock.json`；没有 packageManager 或 workspaces 声明。

### 可用脚本

| 名称 | 实际命令 |
| --- | --- |
| `build:weapp` | `taro build --type weapp` |
| `dev:weapp` | `npm run build:weapp -- --watch` |
| `typecheck` | `tsc --noEmit` |

## 目录概览

```text
Insurance-Frontend/
  AGENT.md
  项目说明.md
  config/
  docs/
    原型与功能索引.md
    接口与数据模型.md
    后续开发指南.md
  src/
    app.config.ts
    app.css
    app.ts
    assets/
    components/
    pages/
    services/
  types/
```

构建产物、缓存、依赖目录与隐藏配置目录未展开。

## 项目编码规范

- `tsconfig.json`：不允许 JavaScript 源文件、启用大小写一致性、独立模块、无输出类型检查；JSX 为 `react-jsx`。
- 现有代码惯例：React 函数组件与 Hooks、页面同目录 CSS、独立服务模块；多个样本使用单引号且不写分号。
- 【待人工补充】统一 ESLint、Prettier、EditorConfig 与测试策略；未发现相应根配置。

## 项目依赖 & 内置组件库

以下为根 `package.json` 的全部直接声明版本，未列出传递依赖。

### 运行依赖

| 依赖 | 声明版本 |
| --- | --- |
| `@tarojs/components` | `4.2.1` |
| `@tarojs/helper` | `4.2.1` |
| `@tarojs/plugin-framework-react` | `4.2.1` |
| `@tarojs/plugin-platform-weapp` | `4.2.1` |
| `@tarojs/react` | `4.2.1` |
| `@tarojs/runtime` | `4.2.1` |
| `@tarojs/shared` | `4.2.1` |
| `@tarojs/taro` | `4.2.1` |
| `react` | `18.3.1` |
| `react-dom` | `18.3.1` |

### 开发依赖

| 依赖 | 声明版本 |
| --- | --- |
| `@babel/core` | `^7.26.0` |
| `@babel/preset-react` | `^7.25.9` |
| `@tarojs/cli` | `4.2.1` |
| `@tarojs/vite-runner` | `4.2.1` |
| `@types/node` | `^22.10.0` |
| `@types/react` | `^18.3.0` |
| `@types/react-dom` | `^18.3.0` |
| `@vitejs/plugin-react` | `^4.3.4` |
| `babel-preset-taro` | `4.2.1` |
| `react-refresh` | `^0.14.2` |
| `typescript` | `^5.7.0` |
| `vite` | `^4.5.5` |

### 同级依赖

未声明。

### 可选依赖

未声明。

### 已确认的组件与工具能力

- `@tarojs/components`：页面、输入、选择器、滚动、媒体及按钮组件。
- `src/components`：地区导航与底部导航；源码为本项目本地组件，没有公开内部包声明。
- `src/services/api.ts`：统一请求、上传与响应处理；Taro 存储负责会话与资料缓存。

## 业务边界 & 业务特殊规则

跨端业务规则、原型差异和当前实现状态详见[项目说明](./项目说明.md)；本仓库 `AGENT.md` 不替代业务规格。

【待人工补充】：正式保险条款和费率、学校数据源、投保去重维度、订单及支付退款契约、发布规则、角色及数据权限。

本次新建该文件；业务源码、依赖声明与锁文件未修改。
