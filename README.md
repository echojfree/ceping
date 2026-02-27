# CareerVerse（职境纪元）本地可跑版本

这是一个面向 **中职学生 / 校外人员 / 中小学生** 的职业兴趣与岗位倾向测评系统，参考了仓库内原型 `index.html` 与 `PRD.md` 的 Persona5 / 赛博交互风格，并把测评、报告、任务、AI 教练与后台管理做成一个可落地的本地系统。

## 运行

1. 安装依赖
   - `npm i`
2. 启动
- `npm run dev`
3. 打开
   - 用户端：`http://localhost:5180/`
   - 通用测评：`http://localhost:5180/quiz`
   - 管理端：`http://localhost:5180/admin`

首次启动会在 `data/` 目录创建本地数据库文件，并按 `.env`（或默认值）创建管理员账号。

## 本地 AI（可选）

默认内置“规则型职业教练”，无需模型也能用。
如需接入本地大模型，可安装并运行 Ollama，然后配置：

- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

系统会自动探测可用性，失败则回退到规则型教练。

## 静态打包（Nginx 部署）

如果你希望由 Nginx 直接托管前端页面（静态文件），可以导出一个 `dist/` 目录：

1. 生成静态产物
   - `npm i`
   - `npm run build:static`
2. 产物结构
   - `dist/index.html`（首页）
   - `dist/quiz/index.html`（`/quiz`）
   - `dist/admin/index.html`（`/admin`）
   - `dist/tasks/index.html`（`/tasks`）
   - `dist/public/*`（脚本/页面资源）
   - `dist/assets/*`（如有）
3. Nginx 配置示例
   - 见 `deploy/nginx.conf.example`

注意：导出静态文件后，页面依旧会请求 `/api/*`（登录/结果/AI 等接口）。如果需要这些功能，请在服务器上保留 Node 后端，并在 Nginx 中把 `/api/` 反向代理到后端进程（示例配置已在 `deploy/nginx.conf.example` 注释给出）。
