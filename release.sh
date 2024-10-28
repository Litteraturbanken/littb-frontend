#!/bin/sh
rsync --delete -r dist/* lb-apache:sites/lb.se
rsync --delete -r dist/* lb-webserver-a:sites/lb.se
