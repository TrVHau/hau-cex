import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger('BackendWorker');
  logger.log('Worker started');

  // giữ worker chạy liên tục
  await new Promise<void>((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  logger.log('Worker stopped');
  await app.close();
}

bootstrap().catch((error) => {
  console.error('Error starting worker:', error);
  process.exit(1);
});
