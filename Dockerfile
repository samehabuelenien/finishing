FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data uploads
EXPOSE 3000
VOLUME ["/app/data", "/app/uploads"]
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
