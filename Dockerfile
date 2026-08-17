FROM node:24-alpine AS build

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install all dependencies (need devDeps for build)
# --ignore-scripts skips the husky prepare hook
RUN npm ci --workspace=shared --workspace=backend --ignore-scripts

# Copy source
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared first, then backend
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

# --- Production stage ---
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install production deps only
RUN NODE_ENV=production npm ci --workspace=shared --workspace=backend --omit=dev

# Copy built output from build stage
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist

EXPOSE 3000

CMD ["node", "backend/dist/app.js"]
