import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { InternalTokenGuard } from './internal-token.guard.js';
import { PrismaService } from './prisma.service.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';

@Module({
  imports: [AnnouncementsModule],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: InternalTokenGuard },
  ],
})
export class AppModule {}
