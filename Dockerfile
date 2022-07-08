FROM node

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npx npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

# Build the app
COPY tsconfig.json ./
RUN npx npm run build

EXPOSE 8000
CMD [ "node", "public/client-sync/index.js" ]