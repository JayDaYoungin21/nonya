FROM node:18-bullseye

ENV DEBIAN_FRONTEND=noninteractive

RUN echo 'APT::Sandbox::User "root";' > /etc/apt/apt.conf.d/99no-sandbox
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    curl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxext6 \
    libx11-6 \
    libxcb1 \
    libxshmfence1 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./
RUN npm install --omit=dev

COPY . .
RUN mkdir -p /app/outputs

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV DISPLAY=:99

RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "index.js"]
