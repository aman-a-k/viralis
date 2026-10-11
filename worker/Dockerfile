# Viralis media worker: ffmpeg + yt-dlp + whisper.cpp.
# Every external tool is pinned so builds are reproducible and reviewable;
# bump the ARGs deliberately (and re-test) to upgrade.
FROM node:22-slim

ARG YTDLP_VERSION=2026.08.19
ARG DENO_VERSION=v2.9.6
ARG WHISPER_CPP_VERSION=v1.9.5
# Multilingual model (Hindi, Kannada, Tamil, ... and English). base-q5_1 fits a
# 512MB-1GB instance; set WHISPER_MODEL_NAME=small-q5_1 on a 2GB+ instance for
# noticeably better accuracy on Indian languages.
ARG WHISPER_MODEL_NAME=base-q5_1

# ffmpeg: cutting/reframing/encoding. fonts-noto-core: Latin + Indic scripts
# for burned-in captions (libass falls back across Noto families). python3 is
# yt-dlp's runtime; deno is the JS runtime yt-dlp needs for YouTube's web
# client. build-essential/cmake/git compile whisper.cpp and are removed after.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg fonts-noto-core fontconfig python3 curl unzip ca-certificates git build-essential cmake \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- --yes "${DENO_VERSION}" \
    && git clone --depth 1 --branch "${WHISPER_CPP_VERSION}" https://github.com/ggml-org/whisper.cpp.git /opt/whisper.cpp \
    && cmake -B /opt/whisper.cpp/build -S /opt/whisper.cpp -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
    && cmake --build /opt/whisper.cpp/build -j --config Release --target whisper-cli \
    && cp /opt/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli \
    && mkdir -p /opt/whisper-models \
    && sh /opt/whisper.cpp/models/download-ggml-model.sh "${WHISPER_MODEL_NAME}" /opt/whisper-models \
    && rm -rf /opt/whisper.cpp \
    && apt-get remove -y build-essential cmake git unzip \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js media.js ./

ENV PORT=8080
ENV WHISPER_BIN=/usr/local/bin/whisper-cli
ENV WHISPER_MODEL=/opt/whisper-models/ggml-${WHISPER_MODEL_NAME}.bin
EXPOSE 8080
USER node
CMD ["node", "server.js"]
