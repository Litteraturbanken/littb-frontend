#!/bin/sh
rsync --delete -r dist/* lb-apache:/home/johan/sites/red.lb.se &&
    rsync --delete -r dist/* lb-webserver-a:/home/johan/sites/red.lb.se
