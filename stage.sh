#!/bin/sh
rsync --delete -r dist/* lb-apache:/home/johan/sites/red.lb.se && \
yarn test
