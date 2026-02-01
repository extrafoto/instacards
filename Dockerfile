FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Fontes + fontconfig (e gera cache)
RUN apk add --no-cache fontconfig ttf-dejavu \
  && fc-cache -f

COPY server.js ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm","start"]
