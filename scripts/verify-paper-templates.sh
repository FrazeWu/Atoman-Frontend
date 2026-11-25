#!/bin/bash
# Opt-in local test of only generated fixtures. No production data, database,
# network, credentials or compilation service is used.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$(mktemp -d /var/tmp/papers-template-fixtures.XXXXXXXX)"
trap 'rm -rf "$root"' EXIT
chmod 0755 "$root"
TEMPLATE_FIXTURES="$root" bun -e 'import {paperTemplates,paperTemplateFiles} from "./src/components/papers/templateCatalog.ts"; import {mkdirSync,writeFileSync} from "node:fs"; import {dirname,join} from "node:path"; for(const t of paperTemplates){const root=join(process.env.TEMPLATE_FIXTURES!,t.id);for(const [path,content] of Object.entries(paperTemplateFiles(t.id))){const dest=join(root,path);mkdirSync(dirname(dest),{recursive:true,mode:0o755});writeFileSync(dest,content,{mode:0o644})}console.log(t.id+" "+t.compiler)}' > "$root/manifest.txt"
chmod -R a+rX "$root"
while read -r name engine; do
  tag=atoman-papers-texlive:academic-verified-20261124
  if [ "$engine" = xelatex ]; then tag=atoman-papers-texlive:academic-cjk-candidate-20261125; fi
  echo "TEMPLATE=$name ENGINE=$engine"
  docker run --rm --pull=never --network none --read-only --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges --memory 768m --memory-swap 768m --cpus 1 --pids-limit 128 --tmpfs /tmp:rw,nosuid,nodev,noexec,size=128m,mode=1777 -e HOME=/tmp --mount "type=bind,source=$root/$name,target=/fixture,readonly" --entrypoint /bin/sh "$tag" -c '
    set -eu
    cd /tmp
    cp -R /fixture/. .
    compile() {
      "$1" -no-shell-escape -interaction=nonstopmode -halt-on-error -file-line-error main.tex > build.log 2>&1 || { tail -n 35 build.log; exit 1; }
    }
    compile "$1"
    bibtex main > bib.log 2>&1 || { tail -n 30 bib.log; exit 1; }
    compile "$1"
    compile "$1"
    test -s main.pdf
    if grep -E "Missing character:|Citation .* undefined|There were undefined references" main.log; then exit 1; fi
    ls -l main.pdf
    echo TEMPLATE_COMPILE_OK
  ' sh "$engine"
done < "$root/manifest.txt"
