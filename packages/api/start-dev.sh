#!/bin/bash
set -a
source ../../.env
set +a
exec bun --watch src/server.ts
