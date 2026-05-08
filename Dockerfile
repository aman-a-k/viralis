FROM node:20-alpine

# Install FFmpeg and PM2
RUN apk add --no-cache ffmpeg
RUN npm install -g pm2

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build Next.js application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start script
CMD ["sh", "-c", "npm start & npx tsx daemon.ts"]
