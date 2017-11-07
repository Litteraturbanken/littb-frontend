# FROM node:boron

#FROM mhart/alpine-node:8.9
# RUN apk add --no-cache make gcc g++ python

FROM webnicer/protractor-headless:latest

RUN apt-get update
RUN apt-get install -y ruby ruby-dev
RUN gem install --no-rdoc --no-ri sass -v 3.4.22
RUN gem install --no-rdoc --no-ri compass
#RUN apt-get install -y default-jre

# RUN apt-get install -y wget
# RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
# RUN echo "deb http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list

# RUN apt-get update
# RUN apt-get -y install google-chrome-stable



# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# COPY package.json .
# For npm@5 or later, copy package-lock.json as well
COPY package.json package-lock.json yarn.lock ./

RUN yarn global add grunt-cli
RUN yarn install
# RUN node_modules/protractor/bin/webdriver-manager update
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE 9000
# CMD [ "tail", "-f", "bower.json" ]
CMD [ "grunt", "test" ]
