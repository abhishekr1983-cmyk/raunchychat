FROM node:20-alpine

WORKDIR /app

# Build React client
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && VITE_SOCKET_URL='' npm run build

# Install server deps (production only)
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy server source
COPY server/ ./server/

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
