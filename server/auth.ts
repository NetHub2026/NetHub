import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export class Authentication {
  private salt = randomBytes(32);
  private hash: Buffer;
  private sessions = new Map<string, { expires: number; csrf: string }>();
  private failures = new Map<string, { count: number; until: number }>();
  constructor(
    password: string,
    private now = () => Date.now(),
  ) {
    if (password.length < 12 || password.length > 256)
      throw new Error("La contraseña del servidor debe tener entre 12 y 256 caracteres.");
    this.hash = scryptSync(password, this.salt, 64);
  }
  login(password: unknown, address: string): { token: string; csrf: string } | null {
    const now = this.now();
    for (const [key, value] of this.failures) if (value.until < now) this.failures.delete(key);
    for (const [key, value] of this.sessions) if (value.expires < now) this.sessions.delete(key);
    const attempts = this.failures.get(address);
    if (attempts && attempts.count >= 5 && attempts.until > now)
      throw new Error("Demasiados intentos. Espera 15 minutos.");
    if (
      typeof password !== "string" ||
      password.length > 256 ||
      !timingSafeEqual(this.hash, scryptSync(password, this.salt, 64))
    ) {
      if (this.failures.size >= 1000) this.failures.delete(this.failures.keys().next().value!);
      this.failures.set(address, { count: (attempts?.count ?? 0) + 1, until: now + 15 * 60_000 });
      return null;
    }
    this.failures.delete(address);
    if (this.sessions.size >= 100) this.sessions.delete(this.sessions.keys().next().value!);
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    this.sessions.set(token, { expires: now + 12 * 3600_000, csrf });
    return { token, csrf };
  }
  session(cookie: string | undefined) {
    const token = cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("nethub_session="))
      ?.slice(15);
    const session = token ? this.sessions.get(token) : undefined;
    return session && session.expires > this.now() ? { ...session, token: token! } : null;
  }
  logout(token: string) {
    this.sessions.delete(token);
  }
}
