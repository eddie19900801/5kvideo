# 5K视频

本仓库包含 `user-web`（手机网页与 Capacitor APP）、`admin-web`（Web 管理后台）和 `server`（业务 API）三个独立工程。根目录不是 Node/Vite 工程，禁止在根目录执行 `npm run build`。详细设计见 [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)，运行方法见 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)。

分别进入三个目录执行 `npm install` 和 `npm run dev`。API 默认端口 4000，用户端 3000，管理端 5174。

项目根目录提供了明确区分目标的构建脚本：

```powershell
.\scripts\build-user-web.ps1
.\scripts\build-admin-web.ps1
.\scripts\build-server.ps1
```
