FROM node:20-slim

# ffmpeg for cutting/reframing/burning captions; python3 + curl to fetch yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      curl \
      ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
