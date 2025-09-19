# -------- build stage --------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# кэш npm
RUN --mount=type=cache,target=/root/.npm npm -v >/dev/null

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install

COPY prisma ./prisma
COPY tsconfig*.json ./
COPY src ./src

# prisma client до сборки
RUN --mount=type=cache,target=/root/.npm npx prisma generate

RUN npm run build

# -------- run stage --------
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev

COPY prisma ./prisma
COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD sh -c "npx prisma migrate deploy && node dist/main.js"
