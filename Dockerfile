FROM node:boron

#FROM mhart/alpine-node:8.9
# RUN apk add --no-cache make gcc g++ python
RUN apt-get update
RUN apt-get install -y ruby ruby-dev
RUN gem install --no-rdoc --no-ri sass -v 3.4.22
RUN gem install --no-rdoc --no-ri compass
# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# COPY package.json .
# For npm@5 or later, copy package-lock.json as well
COPY package.json package-lock.json ./

RUN yarn global add grunt-cli
RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE 9000
CMD [ "grunt", "server" ]
