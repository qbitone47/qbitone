// ============================================================
// Qubit One — Server signing secret (SERVER ONLY)
// ============================================================
// Single source of truth for the server-side signing secret used
// by the session token plane AND the IAM credential plane. Moved
// out of auth-server so the IAM module can derive demo credentials
// from the same secret without creating a circular import.
//
// Resolution order:
//   1. QUBIT_AUTH_SECRET env (>= 32 chars)
//   2. persisted CSPRNG hex file db/.auth-secret (mode 0600, gitignored)
//   3. per-process CSPRNG secret (ephemeral)
//
// No secret is ever hardcoded in source, logged, or shipped to the
// browser (§18 Secrets Management).
// ============================================================

const encoder = new TextEncoder();

export function secretEncoder(): TextEncoder {
  return encoder;
}

export async function getSigningSecret(): Promise<string> {
  const g = globalThis as unknown as { __qubitAuthSecret?: string };
  if (g.__qubitAuthSecret) return g.__qubitAuthSecret;

  let secret: string | undefined;
  if (process.env.QUBIT_AUTH_SECRET && process.env.QUBIT_AUTH_SECRET.length >= 32) {
    secret = process.env.QUBIT_AUTH_SECRET;
  } else {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const file = path.join(process.cwd(), "db", ".auth-secret");
      if (fs.existsSync(file)) {
        const stored = fs.readFileSync(file, "utf8").trim();
        if (stored.length >= 32) secret = stored;
      }
      if (!secret) {
        const raw = new Uint8Array(32);
        crypto.getRandomValues(raw);
        secret = Array.from(raw)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, secret, { mode: 0o600 });
      }
    } catch {
      // Filesystem unavailable — fall back to a per-process CSPRNG secret.
      const raw = new Uint8Array(32);
      crypto.getRandomValues(raw);
      secret = Array.from(raw)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  }
  g.__qubitAuthSecret = secret;
  return secret;
}
