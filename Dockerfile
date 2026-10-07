# syntax=docker/dockerfile:1
# 构建策略：本机已装好 node_modules（含平台无关 JS 依赖），直接 COPY 进镜像，
# 不在容器内 npm ci——规避国内服务器访问 npm 源的网络中断问题。
# 仅适用于 JS 纯依赖（无原生编译模块）；本机需先执行 npm install 且 lockfile 与 node_modules 一致。

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY node_modules ./node_modules
# Windows tar 打包丢失可执行权限，统一修复 .bin 下所有 CLI（nest/tsc 等）
RUN chmod -R +x ./node_modules/.bin
COPY prisma ./prisma
# Prisma Client 已由本机 npm install 时生成（node_modules/.prisma），直接复用，跳过 prisma generate
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
