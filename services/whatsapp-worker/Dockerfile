FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable
RUN corepack prepare pnpm@9.12.3 --activate
RUN pnpm install --filter @repo/whatsapp-worker...
CMD ["pnpm", "--filter", "@repo/whatsapp-worker", "dev"]
