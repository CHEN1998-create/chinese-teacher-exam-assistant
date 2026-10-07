# syntax=docker/dockerfile:1
#
# 受邀环境（环境 B）生产镜像：Next.js standalone 服务端。
# 浏览器内联变量在构建期固定为受邀模式；BACKEND_URL/INTERNAL_TOKEN 由
# 运行时环境变量注入（见根仓库 deploy/frontend.env.example），不得写入镜像层。
#
# 构建策略：本机已装好 node_modules，直接 COPY 进镜像，不在容器内 npm ci——
# 规避国内服务器访问 npm 源的网络中断问题。本机需先执行 npm install。

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY node_modules ./node_modules
# Windows tar 打包丢失可执行权限，统一修复 .bin 下所有 CLI（next 等）
RUN chmod -R +x ./node_modules/.bin
COPY next.config.ts postcss.config.mjs tsconfig.json ./
# 受邀环境标识（内联进浏览器产物）：生产 + invited + 关闭演示模式
ENV NEXT_PUBLIC_APP_ENV=production
ENV NEXT_PUBLIC_AUTH_MODE=invited
ENV NEXT_PUBLIC_DEMO_MODE=false
COPY public ./public
COPY scripts ./scripts
COPY src ./src
# next build 之后 postbuild 会运行境外依赖/密钥扫描，发现阻断项直接构建失败
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
USER node
CMD ["node", "server.js"]
