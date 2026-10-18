// Só valores que parecem segredo de verdade. Um padrão como "token: string" em código TypeScript NÃO é segredo.
export function contemSegredoReal(texto: string): boolean {
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/,
    /\bpk_live_[A-Za-z0-9]{16,}/,
    /\b(ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}/,
    /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bwhsec_[A-Za-z0-9]{16,}/,
    /(?:api[_-]?key|secret|password|senha|token)["']?\s*[:=]\s*["'][A-Za-z0-9+/_-]{24,}["']/i,
  ].some((r) => r.test(texto));
}
