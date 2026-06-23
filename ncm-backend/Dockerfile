# 从 npm 构建 NeteaseCloudMusicApi（无需克隆已下架的仓库）
FROM node:18-alpine

WORKDIR /app

# 安装网易云音乐 API 服务（个人自用）
RUN npm install NeteaseCloudMusicApi@latest && npm cache clean --force

ENV PORT=3000
EXPOSE 3000

# 该包自带 app.js，直接作为服务启动
CMD ["node", "node_modules/NeteaseCloudMusicApi/app.js"]
