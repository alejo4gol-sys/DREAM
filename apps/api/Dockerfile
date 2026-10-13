# Imagen basada en Debian (glibc): evita problemas con módulos nativos en Mac con chip Apple
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install --workspace apps/api --include-workspace-root=false --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build --workspace apps/api && mkdir -p apps/api/node_modules

FROM node:22-slim
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/drizzle ./drizzle
COPY apps/api/package.json ./
# Los archivos copiados desde el Mac pueden traer permisos restringidos: se dejan legibles para el usuario 'node'
RUN chmod -R a+rX /app/apps/api && mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
