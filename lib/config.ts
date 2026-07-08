/**
 * Domínios permitidos para deploy, CORS e dev server.
 * Adicione novos hosts aqui ao publicar em outro domínio.
 */
export const ALLOWED_DOMAINS = [
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "https://code.dns.lowhost.com.br",
] as const;

export const PRIMARY_DOMAIN = "https://code.dns.lowhost.com.br";

/** Hostnames sem protocolo (para allowedDevOrigins do Next.js) */
export const ALLOWED_HOSTNAMES = ALLOWED_DOMAINS.map((url) => {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}).filter((host, index, all) => all.indexOf(host) === index);

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return true;

  if (ALLOWED_DOMAINS.some(
    (allowed) => origin === allowed || origin === `${allowed}/`
  )) {
    return true;
  }

  // Rede local via HTTP (ex: http://192.168.x.x:3000)
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol === "http:" && isPrivateHostname(hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function isPrivateHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^127\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}
