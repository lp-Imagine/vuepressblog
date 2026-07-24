#!/usr/bin/env sh
set -e

push_addr=$(git remote get-url --push origin)
commit_info=$(git describe --all --always --long)
dist_path=website/.vitepress/dist
push_branch=gh-pages

npm run build

cd "$dist_path"
git init
git add -A
git commit -m "deploy, $commit_info"
git push -f "$push_addr" "HEAD:$push_branch"
cd -
rm -rf "$dist_path"
