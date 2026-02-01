FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# instala fontes (essencial!)
RUN apk add --no-cache fontconfig ttf-dejavu

COPY server.js ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
