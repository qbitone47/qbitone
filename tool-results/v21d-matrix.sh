#!/bin/bash
# §42 role-based security matrix probe — Task 21-d
B=http://localhost:3000
J=/tmp/v21d
probe() { # $1 label $2 role $3 method $4 url $5 [body]
  local out=$J/last.json
  local code
  if [ "$3" = "GET" ]; then
    code=$(curl -s -b $J/$2.jar -o $out -w '%{http_code}' "$B$4")
  else
    code=$(curl -s -b $J/$2.jar -o $out -w '%{http_code}' -X POST -H "Content-Type: application/json" -d "$5" "$B$4")
  fi
  local snip=$(head -c 130 $out | tr '\n' ' ' | tr -s ' ')
  printf "%-12s %-24s %s  %s\n" "$2" "$1" "$code" "$snip"
}
for R in administrator dept-head sales-exec hr-manager employee; do
  probe "sales?section=home"        $R GET "/api/sales?section=home"
  probe "analytics?section=home"    $R GET "/api/analytics?section=home"
  probe "analytics?section=sales"   $R GET "/api/analytics?section=sales"
  probe "executive?section=overview" $R GET "/api/executive?section=overview"
  # meetings count
  curl -s -b $J/$R.jar "$B/api/workspace/meetings" -o $J/mtg.json
  CNT=$(node -e "const d=require('$J/mtg.json');const a=d.meetings||d.items||[];console.log(a.length)")
  printf "%-12s %-24s %s  meetings=%s\n" "$R" "GET meetings(list)" "200?" "$CNT"
  probe "audit?page=1&pageSize=5"   $R GET "/api/security/audit?page=1&pageSize=5"
  probe "audit?export=csv"          $R GET "/api/security/audit?export=csv"
  probe "GET security/policies"     $R GET "/api/security/policies"
  probe "POST alerts ack"           $R POST "/api/security/alerts" '{"id":"alert-401","action":"acknowledge"}'
  probe "mobile?section=home"       $R GET "/api/mobile?section=home"
  probe "POST documents dl doc-702" $R POST "/api/workspace/documents" '{"action":"download","docId":"doc-702"}'
  if [ "$R" = "employee" ] || [ "$R" = "sales-exec" ] || [ "$R" = "hr-manager" ]; then
    probe "POST cancel mtg-315"     $R POST "/api/workspace/meetings" '{"action":"cancel","id":"mtg-315","reason":"matrix probe"}'
  else
    printf "%-12s %-24s %s  %s\n" "$R" "POST cancel mtg-315" "SKIP" "governance role would 200 (cancel real meeting avoided)"
  fi
  echo "-----"
done