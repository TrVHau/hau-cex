import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from './core/prisma/prisma.service';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  redis: 'ok' | 'error';
  uptime: number;
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async healthCheck(): Promise<HealthStatus> {
    let dbStatus: 'ok' | 'error' = 'error';
    let redisStatus: 'ok' | 'error' = 'error';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'ok';
    } catch {
      dbStatus = 'error';
    }

    try {
      const pong = await this.redis.ping();
      redisStatus = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      redisStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      redis: redisStatus,
      uptime: process.uptime(),
    };
  }
}
