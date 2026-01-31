#!/bin/sh

set -ex

apt-get update

apt-get install jq parallel su-exec --yes

rm -rf /var/lib/apt/lists/*
