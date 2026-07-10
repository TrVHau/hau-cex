import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  const port: number = Number(process.env.PORT ?? 3000);

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap().catch((error): unknown => {
  console.error('Error during application bootstrap:', error);
  process.exit(1);
});
