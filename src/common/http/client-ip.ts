// The address of the visitor, as Express worked it out from the trusted
// proxies (see config/trust-proxy.config.ts). Never read X-Forwarded-For or
// X-Real-IP here: anybody can send those headers.
export const MAX_IP_LENGTH = 45;

interface RequestWithAddress {
  ip?: string | null;
  socket?: { remoteAddress?: string | null } | null;
}

export const normalizeIp = (
  address: string | null | undefined,
): string | null => {
  const value = (address ?? '').trim();
  if (!value) {
    return null;
  }
  // An IPv4 visitor seen through an IPv6 socket: "::ffff:203.0.113.7".
  const plain = value.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
  return plain.slice(0, MAX_IP_LENGTH);
};

export const clientIpOf = (
  req: RequestWithAddress | null | undefined,
): string | null => {
  if (!req) {
    return null;
  }
  try {
    return normalizeIp(req.ip ?? req.socket?.remoteAddress ?? null);
  } catch {
    return null;
  }
};
