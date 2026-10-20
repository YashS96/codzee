#!/usr/bin/env sh
# Lightweight staged-diff secret scan. Not a replacement for gitleaks, but catches the obvious.
patterns='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{32,})'
hits="$(git diff --cached -U0 --diff-filter=ACM | grep -E '^\+' | grep -Ev '^\+\+\+' | grep -En "$patterns")"
if [ -n "$hits" ]; then
  echo "✖ Possible secret in staged changes:"
  echo "$hits"
  exit 1
fi
if git diff --cached --name-only | grep -Eq '(^|/)\.env$'; then
  echo "✖ Refusing to commit a .env file."
  exit 1
fi
