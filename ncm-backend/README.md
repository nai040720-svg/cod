# 网易云音乐 API 后端 · 一键部署（Docker + Caddy 自动 HTTPS）

给酒馆里的「真·扫码登录迷你播放器」脚本提供后端。基于开源项目
**NeteaseCloudMusicApi**，仅供个人自用。

---

## 0. 前置条件

- 一台能装 Docker 的 VPS（Ubuntu/Debian 等）。
- 一个域名，并把一条 **A 记录**（比如 `ncmapi.你的域名.com`）解析到这台 VPS 的公网 IP。
  - HTTPS 必须有域名（Caddy 用它自动签证书）。手机端酒馆通常是 https，所以后端也必须 https，否则会被「混合内容」拦截。
- 放行服务器的 **80 / 443** 端口（安全组 + 防火墙）。

## 1. 安装 Docker（若未装）

```bash
curl -fsSL https://get.docker.com | sh
```

## 2. 拿到这三份文件

把本目录（`ncm-backend/`）整个上传到服务器，或在服务器上新建同名文件：
`Dockerfile`、`docker-compose.yml`、`Caddyfile`。

## 3. 改域名

编辑 `Caddyfile`，把 `ncmapi.example.com` 换成你自己的域名：

```bash
nano Caddyfile     # 改第一行的域名，保存
```

## 4. 启动

```bash
docker compose up -d --build
```

首次会构建镜像 + 自动申请证书，等 1~2 分钟。

## 5. 验证

浏览器打开（换成你的域名）：

```
https://ncmapi.你的域名.com/login/qr/key?timestamp=1
```

返回一段带 `code:200` 和 `unikey` 的 JSON 就说明成功了。

## 6. 接入酒馆脚本

打开酒馆里的「网易云迷你播放器(扫码登录版)」脚本面板 → 设置（⚙）→ 填：

```
https://ncmapi.你的域名.com
```

保存后扫码登录即可。

---

## 常用维护

```bash
docker compose logs -f ncmapi     # 看 API 日志
docker compose restart            # 重启
docker compose pull && docker compose up -d --build   # 更新
docker compose down               # 停止
```

## 安全提示（重要）

- 这个 API **没有鉴权**：任何知道你这个网址的人都能用它（以及用你登录后的 cookie，如果他拿到）。建议：
  - 用一个**不易猜的子域名**（别叫 api/music 这种）。
  - 如条件允许，套一层 Cloudflare，或在 Caddy 里加访问控制。
  - cookie 存在你浏览器的 localStorage 里，登录态请勿在公共设备使用，不用时在脚本里「退出」。
- 该项目曾因版权问题在 GitHub 下架，请仅个人学习自用，风险自负。

## 备选：构建失败怎么办

如果 `--build` 因 npm 包拉取失败，编辑 `docker-compose.yml`：注释掉 `build: .`，
改用社区镜像那一行 `image: binaryify/netease_cloud_music_api:latest`，再 `docker compose up -d`。
若该镜像也拉不到，可换其它活跃 fork 的镜像（搜索 `NeteaseCloudMusicApi docker`）。
