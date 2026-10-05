import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { InternalTokenGuard } from './internal-token.guard.js';
import { PrismaModule } from './prisma.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { OpportunitiesModule } from './opportunities/opportunities.module.js';

@Module({
  imports: [PrismaModule, AnnouncementsModule, OpportunitiesModule],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: InternalTokenGuard },
  ],
})
export class AppModule {}
