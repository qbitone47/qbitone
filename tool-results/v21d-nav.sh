#!/bin/bash
# palette navigation (clean reload first): $1 query, $2 option substring
agent-browser reload >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1; agent-browser wait 400
agent-browser press Control+k >/dev/null 2>&1; agent-browser wait 600
REF=$(agent-browser snapshot -i -c 2>&1 | rg -o 'combobox \[expanded=true, ref=(e[0-9]+)\]' -r '$1' | head -1)
agent-browser click @$REF >/dev/null 2>&1
for ((i=0; i<${#1}; i++)); do
  CH="${1:i:1}"
  if [ "$CH" = " " ]; then agent-browser press Space >/dev/null 2>&1; else agent-browser press "$CH" >/dev/null 2>&1; fi
  sleep 0.04
done
agent-browser wait 800
REF2=$(agent-browser snapshot -i -c 2>&1 | rg -o "option \"[^\"]*$2[^\"]*\" \[?(selected, )?ref=(e[0-9]+)" -r '$2' | head -1)
if [ -z "$REF2" ]; then echo "OPTION-NOT-FOUND for: $2"; agent-browser snapshot -i -c 2>&1 | rg "option" | head -4; exit 1; fi
agent-browser click @$REF2 >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser wait 700
agent-browser eval "JSON.stringify({h1:document.querySelector('h1')?.innerText?.slice(0,60)||'(none)'})"
