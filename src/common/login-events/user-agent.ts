import { LoginDeviceType, MAX_USER_AGENT_LENGTH } from './login-events';

// A short reading of the User-Agent header, enough for a member to
// recognise their own device ("Firefox · Windows · ordinateur"). Done here
// rather than with a library: only the common browsers and systems matter,
// and an unknown one is simply shown as such.
export interface UserAgentSummary {
  browser: string | null;
  os: string | null;
  device_type: LoginDeviceType;
}

// Order matters: Edge, Opera and Samsung Internet also say "Chrome", and
// Chrome also says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
  [/\b(?:OPR|Opera|OPiOS)\/(\d+)/, 'Opera'],
  [/\bSamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/\b(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
  [/\bVivaldi\/(\d+)/, 'Vivaldi'],
  [/\bYaBrowser\/(\d+)/, 'Yandex'],
  [/\b(?:HeadlessChrome|Chrome|CriOS|Chromium)\/(\d+)/, 'Chrome'],
  [/\bVersion\/(\d+)(?:\.\d+)*.*\bSafari\//, 'Safari'],
  [/\b(?:MSIE |Trident\/.*rv:)(\d+)/, 'Internet Explorer'],
  [/\bcurl\/(\d+)/i, 'curl'],
];

const BOT =
  /bot\b|crawler|spider|slurp|headless|python-requests|curl\/|wget|go-http-client|postman/i;

const osOf = (ua: string): string | null => {
  if (/\bWindows Phone\b/.test(ua)) return 'Windows Phone';
  if (/\bWindows\b/.test(ua)) return 'Windows';
  if (/\biPad\b/.test(ua)) return 'iPadOS';
  if (/\b(?:iPhone|iPod)\b/.test(ua)) return 'iOS';
  if (/\bCrOS\b/.test(ua)) return 'ChromeOS';
  if (/\bAndroid\b/.test(ua)) return 'Android';
  if (/\bMac OS X\b|\bMacintosh\b/.test(ua)) return 'macOS';
  if (/\bLinux\b|\bX11\b/.test(ua)) return 'Linux';
  return null;
};

const deviceOf = (ua: string): LoginDeviceType => {
  if (BOT.test(ua)) return LoginDeviceType.BOT;
  if (/\biPad\b|\bTablet\b/.test(ua)) return LoginDeviceType.TABLET;
  // An Android tablet does not say "Mobile".
  if (/\bAndroid\b/.test(ua) && !/\bMobile\b/.test(ua)) {
    return LoginDeviceType.TABLET;
  }
  if (/\bMobi|\biPhone\b|\biPod\b|\bWindows Phone\b/.test(ua)) {
    return LoginDeviceType.MOBILE;
  }
  if (/\bWindows\b|\bMacintosh\b|\bX11\b|\bCrOS\b|\bLinux\b/.test(ua)) {
    return LoginDeviceType.DESKTOP;
  }
  return LoginDeviceType.UNKNOWN;
};

export const summarizeUserAgent = (
  header: string | string[] | null | undefined,
): UserAgentSummary => {
  const ua = (Array.isArray(header) ? header[0] : (header ?? '')).slice(
    0,
    MAX_USER_AGENT_LENGTH * 2,
  );
  if (!ua.trim()) {
    return { browser: null, os: null, device_type: LoginDeviceType.UNKNOWN };
  }
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua));
  const version = browser ? browser[0].exec(ua)?.[1] : null;
  return {
    browser: browser
      ? version
        ? `${browser[1]} ${version}`
        : browser[1]
      : null,
    os: osOf(ua),
    device_type: deviceOf(ua),
  };
};

// The header itself, kept short: it helps an administrator tell two
// devices apart, and nothing in it is a secret.
export const rawUserAgentOf = (
  header: string | string[] | null | undefined,
): string | null => {
  const ua = (Array.isArray(header) ? header[0] : (header ?? '')).trim();
  return ua ? ua.slice(0, MAX_USER_AGENT_LENGTH) : null;
};
