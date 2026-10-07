import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const client = new Redis(redisUrl);
        client.on('error', (err) =>
          console.error('[Redis] connection error:', err),
        );
        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
