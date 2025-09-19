# -------- build stage --------
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV CI=true NEXT_TELEMETRY_DISABLED=1

# кэш npm
RUN --mount=type=cache,target=/root/.npm npm -v >/dev/null

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install
COPY . .

RUN npm run build

# -------- run stage --------
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.* ./ 2>/dev/null || true
COPY --from=build /app/package*.json ./

EXPOSE 3000
CMD ["npm","run","start"]
