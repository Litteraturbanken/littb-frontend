#!/bin/sh
set -e

for host in lb-apache lb-webserver-a; do
    ssh "$host" 'find /home/johan/sites/red.lb.se -maxdepth 1 \( -name "*.html.gz" -o -name "*.html.br" \) -delete'
    rsync --delete -r dist/* "$host":/home/johan/sites/red.lb.se
done
