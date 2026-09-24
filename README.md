# 保险服务微信小程序

基于 Taro 4.2、React 18、TypeScript 和 Vite 构建的微信小程序项目。

## 环境要求

- Node.js 18 或更高版本
- npm 9 或更高版本
- 微信开发者工具

## 本地开发

```bash
npm install
npm run dev:weapp
```

随后使用微信开发者工具导入当前目录。项目已配置 AppID `wxd3500b3bea26638c`，编译产物目录为 `dist/`。

## 服务接口

登录、首页和个人信息使用 `https://www.zfxbaoxian.com/prod-api/wxmini`。登录时先获取微信 `xcxCode`，再调用 `/login` 获取 `apiToken`，通过响应中的 `header` 名称携带令牌请求后续接口。手机号通过 `/user/phone` 绑定；首页读取 `/home/bannerList` 和 `/home/companyList`；个人信息读取、更新 `/user/{userId}` 和 `/user`，头像通过 `/user/upload` 上传。

当前联调中，`/login` 的 `userId` 为 `null`，`/user/phone` 成功时 `data` 也为 `null`；而个人信息接口 `/user/{userId}` 必须传入用户标识。小程序会优先使用响应中的 `userId`，缺失时从服务端签发的 JWT 中读取 `userId`，再请求个人资料。若令牌中也没有该字段，页面才停止个人资料请求并说明原因。后端直接在登录响应中返回 `userId`，或提供按当前令牌读取本人资料的接口，会使该流程更稳定。

真机运行前，需在微信小程序管理后台配置 `www.zfxbaoxian.com` 为合法请求和上传域名。此仓库没有自动上传配置，构建后需由有权限的微信开发者工具上传体验版或正式版本。

## 常用命令

```bash
# 监听文件变更并持续编译
npm run dev:weapp

# 构建微信小程序
npm run build:weapp

# TypeScript 类型检查
npm run typecheck
```
