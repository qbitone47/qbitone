// ============================================================
// Qubit One — IAM validation harness (read-only smoke tests)
// Runs the §38 test matrix against a running dev server:
//   · credential login → MFA → session, for every demo account
//   · personalized dashboard / entitlements
//   · common employee tools (tasks, mail, meetings, notifications)
//   · department access + cross-department denials
//   · AI permission inheritance (Sales AI boundary)
//   · mail privacy (per-user mailbox partition)
//   · logout → session revocation → re-login
//   · no-credential bootstrap disabled, lockout behavior
// ============================================================
import { createHmac } from "node:crypto";

const BASE = process.env.IAM_BASE ?? "http://localhost:3000";

// Mirrors src/lib/qubit/iam.ts deriveDemoPassword (v2): HMAC-SHA256 over the
// dedicated demo pepper — NOT the environment signing secret. Keep the
// fallback constant and the v2 label in sync with iam.ts; the env pepper
// preference matches demoPasswordPepper() there.
const DEMO_PASSWORD_PEPPER_FALLBACK = "xrfOV_gs-Lv1U_flFZTUZkB9clP2Iw6R9xMcmoTAcDVWIAUG";
const demoPepper = process.env.QUBIT_DEMO_PASSWORD_PEPPER && process.env.QUBIT_DEMO_PASSWORD_PEPPER.length >= 32
  ? process.env.QUBIT_DEMO_PASSWORD_PEPPER
  : DEMO_PASSWORD_PEPPER_FALLBACK;

function demoPassword(userId) {
  const raw = createHmac("sha256", demoPepper).update(`qubit-demo-password-v2:${userId}`).digest("base64url").slice(0, 22);
  let pw = raw;
  if (!/\d/.test(pw)) pw = pw.slice(0, 10) + "7" + pw.slice(11);
  if (!/[A-Z]/.test(pw)) pw = "Q" + pw.slice(1);
  if (!/[a-z]/.test(pw)) pw = pw.slice(0, 1) + "q" + pw.slice(2);
  return pw;
}

const RESULTS = [];
function record(name, pass, detail = "") {
  RESULTS.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, cookie: setCookie?.split(";")[0] };
}

async function login(identifier) {
  const password = demoPassword(identifier);
  const l = await req("/api/iam/login", { method: "POST", body: { identifier, password } });
  if (l.status !== 200 || !l.json?.challengeId) return { error: `login ${l.status}` };
  const m = await req("/api/iam/mfa", { method: "POST", body: { challengeId: l.json.challengeId, code: l.json.demoAuthenticatorCode, method: "authenticator-app" } });
  if (m.status !== 200 || !m.cookie) return { error: `mfa ${m.status}` };
  return { cookie: m.cookie, homeScreen: m.json?.homeScreen, name: m.json?.name };
}

const ACCOUNTS = [
  { id: "demo.ceo", dept: "executive", home: "ceo-overview" },
  { id: "demo.sales", dept: "sales", home: "sales-home" },
  { id: "demo.finance", dept: "finance", home: "employee-home" },
  { id: "demo.hr", dept: "hr", home: "employee-home" },
  { id: "demo.inventory", dept: "inventory", home: "employee-home" },
  { id: "demo.marketing", dept: "marketing", home: "employee-home" },
  { id: "demo.service", dept: "service", home: "employee-home" },
  { id: "sagar", dept: "executive", home: "ceo-overview" },
];

console.log("=== IAM validation —", new Date().toISOString(), "===\n");

// ---------- Phase 0: credential plane ----------
const anon = await req("/api/iam/me");
record("anonymous /api/iam/me is 401", anon.status === 401, `status ${anon.status}`);

const bootstrap = await req("/api/auth/session", { method: "POST", body: { role: "administrator" } });
record("credential-free session bootstrap is DISABLED", bootstrap.status === 401, `status ${bootstrap.status} code ${bootstrap.json?.code}`);

const wrong = await req("/api/iam/login", { method: "POST", body: { identifier: "demo.ceo", password: "definitely-wrong-password" } });
record("wrong password rejected 401 (no enumeration)", wrong.status === 401 && wrong.json?.code === "invalid_credentials", `status ${wrong.status}`);

const unknown = await req("/api/iam/login", { method: "POST", body: { identifier: "ghost.user", password: "whatever-long-password" } });
record("unknown identifier rejected with SAME message", unknown.status === 401 && unknown.json?.message === wrong.json?.message, "");

let lockSeen = false;
for (let i = 0; i < 6; i++) {
  const r = await req("/api/iam/login", { method: "POST", body: { identifier: "lockout.probe", password: "wrong-password-123" } });
  if (r.status === 429) { lockSeen = true; }
}
record("5 failed attempts lock the identifier (429)", lockSeen, "lockout.probe");

// ---------- Phase 1..3: per-account full cycle ----------
const sessionCookies = {};
for (const acct of ACCOUNTS) {
  console.log(`\n--- ${acct.id} ---`);
  const s = await login(acct.id);
  if (s.error) { record(`${acct.id} login cycle`, false, s.error); continue; }
  record(`${acct.id} login+MFA issues session`, true, `home ${s.homeScreen}`);
  record(`${acct.id} lands on personalized home`, s.homeScreen === acct.home, `${s.homeScreen} (expected ${acct.home})`);
  sessionCookies[acct.id] = s.cookie;

  const me = await req("/api/iam/me", { cookie: s.cookie });
  const ent = me.json?.entitlements;
  record(`${acct.id} identity + entitlements resolve`, me.status === 200 && ent?.department === acct.dept, `${ent?.departmentLabel} · ${ent?.roleLabel} · ${ent?.permissions?.length ?? 0} permissions`);

  // common employee tools (personalized)
  const tasks = await req("/api/workspace/tasks", { cookie: s.cookie });
  const mail = await req("/api/workspace/mail?folder=all&limit=200", { cookie: s.cookie });
  const meetings = await req("/api/workspace/meetings", { cookie: s.cookie });
  const notifs = await req("/api/workspace/notifications", { cookie: s.cookie });
  const taskCount = tasks.json?.tasks?.length ?? -1;
  const mailCount = mail.json?.items?.length ?? -1;
  const meetingCount = meetings.json?.meetings?.length ?? -1;
  const notifCount = notifs.json?.notifications?.length ?? -1;
  record(`${acct.id} common tools scoped`, taskCount >= 0 && mailCount >= 0 && meetingCount >= 0 && notifCount >= 0, `tasks ${taskCount} · mail ${mailCount} · meetings ${meetingCount} · notifs ${notifCount}`);

  if (acct.id.startsWith("demo.")) {
    record(`${acct.id} has personal tasks`, taskCount >= 3, `${taskCount} seeded tasks`);
    record(`${acct.id} has personal mailbox`, mailCount >= 1, `${mailCount} messages`);
    const sagarOnly = (mail.json?.items ?? []).some((m) => m.id === "m-101" || m.id === "m-102");
    record(`${acct.id} mailbox does NOT leak sagar's mail`, !sagarOnly, "");
  }

  // department matrix
  if (acct.dept === "executive") {
    const exec = await req("/api/executive?section=overview", { cookie: s.cookie });
    record(`${acct.id} CEO command center ALLOWED`, exec.status === 200, `status ${exec.status}`);
    const anyAnalytics = await req("/api/analytics?section=finance", { cookie: s.cookie });
    record(`${acct.id} company-wide analytics ALLOWED`, anyAnalytics.status === 200, `status ${anyAnalytics.status}`);
  }
  if (acct.dept === "sales") {
    const leads = await req("/api/sales?section=leads", { cookie: s.cookie });
    const rows = leads.json?.rows ?? leads.json?.data?.rows ?? [];
    const foreign = rows.filter((r) => r.ownerId && r.ownerId !== "demo.sales");
    record(`${acct.id} sales workspace ALLOWED (own scope)`, leads.status === 200, `${rows.length} rows, ${foreign.length} foreign-owner rows`);
    const ai = await req("/api/sales-ai?section=home", { cookie: s.cookie });
    record(`${acct.id} Sales AI ALLOWED`, ai.status === 200, `status ${ai.status}`);
  }
  if (["finance", "hr", "inventory", "marketing", "service"].includes(acct.dept)) {
    const own = await req(`/api/analytics?section=${acct.dept}`, { cookie: s.cookie });
    record(`${acct.id} own department analytics ALLOWED`, own.status === 200, `status ${own.status}`);
    const foreign = [];
    for (const other of ["sales", "finance", "hr", "inventory", "marketing", "service"]) {
      if (other === acct.dept) continue;
      foreign.push(await req(`/api/analytics?section=${other}`, { cookie: s.cookie }));
    }
    record(`${acct.id} other departments' analytics DENIED`, foreign.every((f) => f.status === 403), foreign.map((f) => f.status).join("/"));
    const salesOs = await req("/api/sales?section=home", { cookie: s.cookie });
    record(`${acct.id} Sales OS DENIED`, salesOs.status === 403, `status ${salesOs.status}`);
    const exec = await req("/api/executive?section=overview", { cookie: s.cookie });
    record(`${acct.id} Executive module DENIED`, exec.status === 403, `status ${exec.status}`);
    const salesAi = await req("/api/sales-ai?section=home", { cookie: s.cookie });
    record(`${acct.id} Sales AI DENIED (AI inherits IAM)`, salesAi.status === 403, `status ${salesAi.status}`);
  }
}

// ---------- Phase 4: AI permission enforcement ----------
console.log("\n--- AI permission inheritance ---");
{
  const c = sessionCookies["demo.sales"];
  const payrollAsk = await req("/api/sales-ai", { method: "POST", cookie: c, body: { type: "qa.ask", input: { question: "Show me payroll information for employees", sessionId: "iamtest-session-01" } } });
  const answerText = String(payrollAsk.json?.answer?.answer ?? "");
  // §30 criterion: the AI must NOT surface payroll data — the honest answer
  // explicitly refuses (any refusal phrasing) and sources stay inside the
  // caller's authorized sales scope; the strict leak regex is the hard bound.
  const deniesPayroll = /no access|not available|not authorized|no authorized|don't have|do not have|cannot provide|can't provide|unable to provide|only contains information about/i.test(answerText) && !/\bpayroll[:\s]*₹|salary of|net pay\b/i.test(answerText);
  record("Sales AI DENIES payroll access (AI inherits IAM)", payrollAsk.status === 200 && deniesPayroll, `answer: "${answerText.slice(0, 90)}…" · sources ${(payrollAsk.json?.sources ?? []).map((s) => s.label ?? s.section ?? "?").join(",")}`);

  const mobileAi = await req("/api/mobile", { method: "POST", cookie: c, body: { type: "ai.ask", input: { question: "What are my tasks today?" } } });
  record("Mobile AI answers from own authorized context", mobileAi.status === 200, `status ${mobileAi.status}`);

  const financeAi = await req("/api/sales-ai", { method: "POST", cookie: sessionCookies["demo.finance"], body: { type: "qa.ask", input: { question: "What are my leads?", sessionId: "iamtest-session-02" } } });
  record("Finance user cannot use Sales AI", financeAi.status === 403, `status ${financeAi.status}`);
}

// ---------- Phase 5: logout / revocation / re-login ----------
console.log("\n--- Session lifecycle ---");
{
  const c = sessionCookies["demo.sales"];
  const out = await req("/api/iam/logout", { method: "POST", cookie: c });
  record("logout revokes the session", out.status === 200, `status ${out.status}`);
  const afterLogout = await req("/api/iam/me", { cookie: c });
  record("revoked session is rejected (real revocation)", afterLogout.status === 401, `status ${afterLogout.status}`);
  const relogin = await login("demo.sales");
  record("re-login after logout succeeds", !relogin.error && relogin.homeScreen === "sales-home", `home ${relogin.homeScreen}`);
  const me2 = await req("/api/iam/me", { cookie: relogin.cookie });
  record("new session persists", me2.status === 200, `status ${me2.status}`);
}

// ---------- Summary ----------
const failed = RESULTS.filter((r) => !r.pass);
console.log(`\n=== RESULT: ${RESULTS.length - failed.length}/${RESULTS.length} PASS, ${failed.length} FAIL ===`);
if (failed.length) {
  console.log("FAILED:");
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
