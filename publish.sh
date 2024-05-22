#!/bin/bash
pnpm version minor
VERSION=$(pnpm version | grep adonis-autoswagger | grep -oP '([0-9\.])*')
git tag $VERSION
# git push