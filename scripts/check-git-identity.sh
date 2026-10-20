#!/usr/bin/env sh
# Blocks commits made with an identity other than the repo owner's personal account.
# Override for collaborators: CODZEE_ALLOWED_EMAILS="a@x.com,b@y.com"
allowed="${CODZEE_ALLOWED_EMAILS:-srivastavyash7@gmail.com}"
email="$(git config user.email)"

case ",$allowed," in
  *",$email,"*) exit 0 ;;
esac

echo "✖ Commit blocked: git user.email is '$email'."
echo "  This repo must be committed as: $allowed"
echo "  Fix with: git config user.email \"srivastavyash7@gmail.com\" && git config user.name \"Yash Shrivastava\""
exit 1
