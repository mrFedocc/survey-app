import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://5.129.253.61:3000'], // временно можно ['*'] если без куки
    credentials: false,
  });

  await app.listen(process.env.PORT || 3001, '0.0.0.0');
}
bootstrap();
