
### Готовый `README.md` (вставь как есть в корень репо)

```markdown
# Survey App (monorepo)

Монорепозиторий: **Next.js (apps/web)** + **NestJS (apps/api)** + **PostgreSQL (infra)**.  
Локально: фронт на `http://localhost:3000`, API на `http://localhost:3001`, БД — Docker.

## Архитектура
```

survey-app/
├─ apps/
│  ├─ web/   (Next.js 15 + Tailwind)
│  └─ api/   (NestJS + Prisma)
├─ infra/
│  └─ docker-compose.yml (Postgres + pgAdmin)
├─ pnpm-workspace.yaml
└─ README.md

````

## Требования
- **Node.js 20+** (рекомендовано LTS)
- **PNPM 10+** (через corepack — без `sudo`)
- **Docker Desktop** (для Postgres)
- **Git**

## Установка PNPM (без прав админа)
```bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm -v
````

## Быстрый старт (TL;DR)

```bash
git clone <URL_ВАШЕГО_РЕПО>
cd survey-app

# 1) поднимаем БД
docker compose -f infra/docker-compose.yml up -d

# 2) переменные окружения
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3) применяем миграции + генерим клиент Prisma
pnpm -C apps/api dlx prisma migrate dev --name init --schema prisma/schema.prisma
pnpm -C apps/api dlx prisma generate --schema prisma/schema.prisma

# 4) запускаем API и WEB (в двух терминалах)
pnpm -C apps/api start:dev
pnpm -C apps/web dev
```

**Проверка:**

* API: `GET http://localhost:3001/survey/health` → `{"ok":true}`
* Фронт: `http://localhost:3000`

## .env

**apps/api/.env.example**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/survey?schema=public"
SHADOW_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/survey_shadow?schema=public"
PORT=3001
```

**apps/web/.env.example** (локально кладём как `.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Сидинг и тестовый ответ

Создаём опрос и вопрос, получаем `questionId`:

```bash
curl -s -X POST http://localhost:3001/survey/seed -H 'Content-Type: application/json'
# -> {"surveyId":"...","questionId":"<ID>"}
```

Отправляем тестовый ответ:

```bash
curl -i -X POST http://localhost:3001/survey/answer \
  -H 'Content-Type: application/json' \
  -d '{"questionId":"ПОДСТАВЬ_ID_ИЗ_SEED","value":"10"}'
```

Открыть базу в GUI:

```bash
pnpm -C apps/api dlx prisma studio
```

## Скрипты, которые мы используем чаще всего

```bash
# БД
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps

# Prisma
pnpm -C apps/api dlx prisma migrate dev
pnpm -C apps/api dlx prisma generate
pnpm -C apps/api dlx prisma studio

# API / WEB
pnpm -C apps/api start:dev
pnpm -C apps/web dev
```

## Git-флоу (рекомендация)

* Ветки фич: `feat/<кратко>`; баги: `fix/<кратко>`
* PR в `main` через review
* Коммиты по смыслу: `feat: ...`, `fix: ...`, `chore: ...`

## Частые проблемы и решения

* **404 на `GET /survey/answer`** — это POST-маршрут. Отправляйте POST.
* **`Question not found` (404)** — неверный `questionId`. Сначала выполните `/survey/seed`.
* **`P1001 Can't reach database`** — не запущен Docker или порт Postgres другой.

  * Проверьте порт: `docker compose -f infra/docker-compose.yml port db 5432` → должен быть `0.0.0.0:5432`
  * Проверьте `apps/api/.env` — порт должен совпадать.
* **500 при сохранении ответа** — почти всегда FK-ошибка (нет такого вопроса). Сделайте `/survey/seed` и используйте новый `questionId`.
* **Порт занят** — узнайте PID: `lsof -ti :3000 | xargs -r kill -9` (или `:3001`).
* **Mac Postgres.app мешает** — закройте Postgres.app или измените порт в `.env` и `docker-compose`.

## Полезно

* pgAdmin: `http://localhost:5050` (логин `admin@example.com`, пароль `admin`)
* Swagger (подключим позже при выравнивании версий): `/docs`

````

---

### Как добавить нового разработчика (пошагово)

**A) Владелец репо**
1. GitHub → ваш репозиторий → **Settings** → **Collaborators and teams**.  
2. **Add people** → введите ник/почту коллеги → роль **Write** → **Add**.  

**B) Новый разработчик**
1. Сгенерировать SSH-ключ (если нет):  
   ```bash
   ssh-keygen -t ed25519 -C "you@example.com"
   cat ~/.ssh/id_ed25519.pub
````

Добавить ключ в GitHub: **Settings → SSH and GPG keys → New SSH key**.
2\. Клонировать и запустить:

```bash
git clone git@github.com:<ORG_OR_USER>/survey-app.git
cd survey-app
corepack enable && corepack prepare pnpm@10 --activate
docker compose -f infra/docker-compose.yml up -d
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm -C apps/api dlx prisma migrate dev --name init --schema prisma/schema.prisma
pnpm -C apps/api dlx prisma generate --schema prisma/schema.prisma
pnpm -C apps/api start:dev     # терминал 1
pnpm -C apps/web dev           # терминал 2
```

Проверить:

* `http://localhost:3001/survey/health` → `{"ok":true}`
* `http://localhost:3000` — фронт открыт.

3. (Опционально) Сидинг:

   ```bash
   curl -s -X POST http://localhost:3001/survey/seed -H 'Content-Type: application/json'
   ```

**C) Работа с кодом**

```bash
git checkout -b feat/multi-step-survey
# правим код...
git add .
git commit -m "feat: multi-step survey (NPS → reasons → comment)"
git push --set-upstream origin feat/multi-step-survey
# создаём Pull Request в GitHub
```

