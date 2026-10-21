import { createHash, timingSafeEqual } from "node:crypto";

// Admin password for the export and the results page. Unset means admin access is off.
export const adminEnabled = () => Boolean(process.env.EXPORT_PASSWORD);

// Accepts HTTP Basic auth with any username and EXPORT_PASSWORD as the password.
export function authorized(request) {
  if (!adminEnabled()) return false;
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const password = decoded.slice(decoded.indexOf(":") + 1);
  const hash = (s) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(password), hash(process.env.EXPORT_PASSWORD));
}
