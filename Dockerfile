# Container for deploying to a VPS (or any Docker host).
#   docker build -t lead-demo .
#   docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... lead-demo
# Optionally add: -e GHL_API_KEY=... -e GHL_LOCATION_ID=...
FROM node:22-alpine
WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# App source (node_modules and .env excluded via .dockerignore)
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
