#!/bin/sh
grunt && rsync --delete -r dist/* johanrox@demo.spraakdata.gu.se:/export/htdocs_littb
