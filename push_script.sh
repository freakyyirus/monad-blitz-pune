#!/bin/bash

# Get all modified, deleted, and untracked files
files=$( (git diff --name-only; git ls-files --others --exclude-standard; git diff --name-only --cached) | sort | uniq )

for file in $files; do
  if [ -e "$file" ] || git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
    echo "Processing $file..."
    git add "$file"
    git commit -m "update $file"
    git push
    echo "Waiting 5 seconds..."
    sleep 5
  fi
done

echo "Done!"
