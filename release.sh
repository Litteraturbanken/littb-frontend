#!/bin/sh
set -e

for host in lb-apache lb-webserver-a; do
    # Vite does not emit these, and stale precompressed HTML can mask a fresh deploy.
    ssh "$host" "rm -f sites/lb.se/index.html.br sites/lb.se/index.html.gz"
    rsync --delete -r dist/* "$host:sites/lb.se"
done
