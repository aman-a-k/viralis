FROM node:20-slim

# ffmpeg for cutting/reframing/burning captions; python3 + curl to fetch yt-dlp;
# build-essential/cmake/git to compile whisper.cpp (self-hosted transcription —
# YouTube's caption endpoint now requires a proof-of-origin token that neither
# cookies nor plain scraping can produce, so we transcribe the audio ourselves).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      curl \
      ca-certificates \
      git \
      build-essential \
      cmake \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git /opt/whisper.cpp \
    && cmake -B /opt/whisper.cpp/build -S /opt/whisper.cpp -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /opt/whisper.cpp/build -j --config Release --target whisper-cli \
    && cp /opt/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli \
    && mkdir -p /opt/whisper-models \
    && sh /opt/whisper.cpp/models/download-ggml-model.sh tiny.en /opt/whisper-models \
    && rm -rf /opt/whisper.cpp/build/CMakeFiles /opt/whisper.cpp/.git \
    && apt-get remove -y build-essential cmake git \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=8080
ENV WHISPER_BIN=/usr/local/bin/whisper-cli
ENV WHISPER_MODEL=/opt/whisper-models/ggml-tiny.en.bin
EXPOSE 8080
CMD ["npm", "start"]
