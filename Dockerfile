FROM node:boron

#FROM mhart/alpine-node:8.9
# RUN apk add --no-cache make gcc g++ python

# RUN echo "deb http://http.debian.net/debian jessie-backports main" | \
#       tee --append /etc/apt/sources.list.d/jessie-backports.list > /dev/null
# RUN apt-get update
# RUN apt-get install -y -t  jessie-backports openjdk-8-jdk

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# COPY package.json .
# For npm@5 or later, copy package-lock.json as well
COPY package.json yarn.lock ./

RUN yarn global add protractor
RUN yarn global add npm-run-all
RUN yarn global add wait-on
RUN webdriver-manager update --standalone false
RUN yarn install
#RUN node_modules/protractor/bin/webdriver-manager update
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

