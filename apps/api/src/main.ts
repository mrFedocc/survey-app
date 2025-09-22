import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, cb) => {
      // разрешаем без Origin (curl, серверные запросы)
      if (!origin) return cb(null, true);

      const ok =
        /^https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin) ||  // превью
        /^https?:\/\/([a-z0-9-]+\.)*petly\.moscow$/i.test(origin) || // твои домены
        origin === 'http://localhost:3000';

      cb(ok ? null : new Error('CORS blocked'), ok);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT || 3001, '0.0.0.0');
}
bootstrap();
