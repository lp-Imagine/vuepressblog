#!/usr/bin/env bash
# Trigger Daily AI News workflow via GitHub API.
# Usage: GITHUB_TOKEN=ghp_xxx bash scripts/trigger-daily-news.sh
set -euo pipefail

: "${GITHUB_TOKEN:?Set GITHUB_TOKEN (PAT with repo/workflow scope)}"
REPO="${GITHUB_REPO:-lp-Imagine/penn-notes}"
REF="${GITHUB_REF:-master}"

curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/${REPO}/actions/workflows/daily-news.yml/dispatches" \
  -d "{\"ref\":\"${REF}\"}"

echo ""
echo "Triggered daily-news on ${REPO}@${REF}"
