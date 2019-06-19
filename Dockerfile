FROM node:10.10-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# COPY package.json .
# For npm@5 or later, copy package-lock.json as well

RUN yarn global add protractor && \
    yarn global add npm-run-all && \
    yarn global add wait-on && \
    webdriver-manager update --standalone false --gecko false

COPY package.json yarn.lock ./
RUN yarn install --ignore-optional
#RUN node_modules/protractor/bin/webdriver-manager update
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

