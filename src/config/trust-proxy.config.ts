// Which proxies the API believes when they say who the visitor is.
//
// In production the request goes nginx (on the host) → Caddy (container) →
// API (container): every hop in front of the API sits on the loopback or a
// private network, and each one appends the address it received the request
// from to X-Forwarded-For. Express reads that header from the right and
// stops at the first address that is not a trusted proxy: that address is
// `req.ip`. Trusting the private ranges only means a visitor on the Internet
// cannot choose their address by sending X-Forwarded-For themselves: what
// they put on the left of the chain is never reached, and when they reach
// the API directly the header is ignored altogether.
//
// TRUST_PROXY (optional):
//   unset, "private" or a number (the older hop count) → the private ranges;
//   "false", "off" or "none"                            → no proxy trusted;
//   a comma-separated list of addresses or CIDR ranges  → exactly those.
// The hop count is no longer honoured on purpose: a count trusts whatever
// address sits at that position, private or not.
export const PRIVATE_PROXY_RANGES = ['loopback', 'linklocal', 'uniquelocal'];

const NO_PROXY = new Set(['false', 'off', 'none', 'no']);

export type TrustProxySetting = string[] | false;

export const trustProxySetting = (
  value: string | undefined | null = process.env.TRUST_PROXY,
): TrustProxySetting => {
  const setting = (value ?? '').trim();
  if (
    setting === '' ||
    setting.toLowerCase() === 'private' ||
    setting.toLowerCase() === 'true' ||
    /^\d+$/.test(setting)
  ) {
    // "0" used to mean "no proxy": keep that meaning.
    return setting === '0' ? false : [...PRIVATE_PROXY_RANGES];
  }
  if (NO_PROXY.has(setting.toLowerCase())) {
    return false;
  }
  return setting
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};
