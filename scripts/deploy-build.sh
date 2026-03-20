#!/bin/bash
set -e
node scripts/build-web.js
npm run server:build
