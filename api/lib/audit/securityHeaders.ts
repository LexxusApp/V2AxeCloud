/**
 * Avalia os headers de segurança HTTP e atribui uma nota de A a F.
 *
 * Critérios (similares ao securityheaders.com):
 *   - Content-Security-Policy (peso 25)
 *   - Strict-Transport-Security (peso 20)
 *   - X-Frame-Options (peso 10)
 *   - X-Content-Type-Options (peso 10)
 *   - Referrer-Policy (peso 10)
 *   - Permissions-Policy (peso 10)
 *   - Cross-Origin-Opener-Policy (peso 5)
 *   - Cross-Origin-Resource-Policy (peso 5)
 *   - Cross-Origin-Embedder-Policy (peso 5)
 *
 * Total possível = 100.
 *   90+   = A+
 *   80–89 = A
 *   70–79 = B
 *   55–69 = C
 *   40–54 = D
 *   <40   = F
 */

export type SecurityCheckKey =
  | "content-security-policy"
  | "strict-transport-security"
  | "x-frame-options"
  | "x-content-type-options"
  | "referrer-policy"
  | "permissions-policy"
  | "cross-origin-opener-policy"
  | "cross-origin-resource-policy"
  | "cross-origin-embedder-policy";

export type SecurityCheck = {
  key: SecurityCheckKey;
  present: boolean;
  value: string | null;
  weight: number;
  awarded: number;
  note: string;
};

export type SecurityGrade = {
  score: number;
  maxScore: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  checks: SecurityCheck[];
};

const WEIGHTS: Record<SecurityCheckKey, number> = {
  "content-security-policy": 25,
  "strict-transport-security": 20,
  "x-frame-options": 10,
  "x-content-type-options": 10,
  "referrer-policy": 10,
  "permissions-policy": 10,
  "cross-origin-opener-policy": 5,
  "cross-origin-resource-policy": 5,
  "cross-origin-embedder-policy": 5,
};

function evaluate(key: SecurityCheckKey, value: string | null): { awarded: number; note: string } {
  const weight = WEIGHTS[key];
  if (!value) return { awarded: 0, note: "Header ausente." };
  const v = value.toLowerCase();

  switch (key) {
    case "content-security-policy":
      if (v.includes("'unsafe-inline'") || v.includes("'unsafe-eval'"))
        return { awarded: Math.round(weight * 0.5), note: "CSP presente mas permite unsafe-inline/eval." };
      return { awarded: weight, note: "CSP presente." };
    case "strict-transport-security": {
      const maxAge = /max-age=(\d+)/.exec(v)?.[1];
      const age = maxAge ? Number(maxAge) : 0;
      if (age >= 31536000) return { awarded: weight, note: `HSTS forte (max-age=${age}).` };
      if (age > 0) return { awarded: Math.round(weight * 0.6), note: `HSTS curto (max-age=${age}).` };
      return { awarded: Math.round(weight * 0.4), note: "HSTS sem max-age explícito." };
    }
    case "x-frame-options":
      if (v === "deny" || v === "sameorigin") return { awarded: weight, note: "X-Frame-Options OK." };
      return { awarded: Math.round(weight * 0.6), note: "X-Frame-Options com valor não recomendado." };
    case "x-content-type-options":
      return v.includes("nosniff")
        ? { awarded: weight, note: "nosniff ativo." }
        : { awarded: 0, note: "Não está como nosniff." };
    case "referrer-policy":
      if (
        v.includes("no-referrer") ||
        v.includes("strict-origin") ||
        v.includes("same-origin")
      )
        return { awarded: weight, note: "Referrer-Policy adequada." };
      return { awarded: Math.round(weight * 0.6), note: "Referrer-Policy fraca." };
    case "permissions-policy":
      return { awarded: weight, note: "Permissions-Policy presente." };
    case "cross-origin-opener-policy":
      if (v.includes("same-origin")) return { awarded: weight, note: "COOP same-origin." };
      return { awarded: Math.round(weight * 0.6), note: "COOP presente mas não same-origin." };
    case "cross-origin-resource-policy":
      return { awarded: weight, note: "CORP presente." };
    case "cross-origin-embedder-policy":
      return { awarded: weight, note: "COEP presente." };
  }
}

export function gradeSecurityHeaders(headers: Record<string, string>): SecurityGrade {
  const keys = Object.keys(WEIGHTS) as SecurityCheckKey[];
  let score = 0;
  let maxScore = 0;
  const checks: SecurityCheck[] = keys.map((key) => {
    const value = headers[key] ?? null;
    const weight = WEIGHTS[key];
    const { awarded, note } = evaluate(key, value);
    score += awarded;
    maxScore += weight;
    return {
      key,
      present: value != null,
      value,
      weight,
      awarded,
      note,
    };
  });

  const pct = (score / maxScore) * 100;
  let grade: SecurityGrade["grade"] = "F";
  if (pct >= 90) grade = "A+";
  else if (pct >= 80) grade = "A";
  else if (pct >= 70) grade = "B";
  else if (pct >= 55) grade = "C";
  else if (pct >= 40) grade = "D";

  return { score, maxScore, grade, checks };
}
