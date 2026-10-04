import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 受邀部署中 Nginx 终止 TLS 并以 /api/* 反向代理到本服务。
  // 显式设置 trust proxy，Express 才会信任代理设置的 X-Forwarded-*，
  // 后续安全 Cookie（secure）与真实客户端 IP 判断才正确。
  // 默认关闭（本地直连开发）；部署在反向代理后时设 TRUST_PROXY=true。
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
  });

  const port = Number(process.env.PORT ?? 3000);
  // 默认监听全部网卡以兼容容器；NestJS 与 Nginx 同机裸进程部署时，
  // 应设置 HOST=127.0.0.1，使后端端口不直接暴露公网。
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
}
await bootstrap();
