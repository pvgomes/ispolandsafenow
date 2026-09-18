FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
RUN npm install

COPY . .

EXPOSE 8787

ENTRYPOINT ["sh", "docker/dev-entrypoint.sh"]
