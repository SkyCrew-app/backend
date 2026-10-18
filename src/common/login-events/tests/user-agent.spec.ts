import { rawUserAgentOf, summarizeUserAgent } from '../user-agent';
import { LoginDeviceType, MAX_USER_AGENT_LENGTH } from '../login-events';

describe('reading the user agent', () => {
  const cases: [
    string,
    string,
    string | null,
    string | null,
    LoginDeviceType,
  ][] = [
    [
      'Chrome on Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Chrome 130',
      'Windows',
      LoginDeviceType.DESKTOP,
    ],
    [
      'Edge on Windows (also says Chrome)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68',
      'Edge 130',
      'Windows',
      LoginDeviceType.DESKTOP,
    ],
    [
      'Safari on a Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
      'Safari 18',
      'macOS',
      LoginDeviceType.DESKTOP,
    ],
    [
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
      'Firefox 131',
      'Linux',
      LoginDeviceType.DESKTOP,
    ],
    [
      'Safari on an iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari 18',
      'iOS',
      LoginDeviceType.MOBILE,
    ],
    [
      'Chrome on an iPad',
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
      'Chrome 129',
      'iPadOS',
      LoginDeviceType.TABLET,
    ],
    [
      'Samsung Internet on an Android phone',
      'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
      'Samsung Internet 26',
      'Android',
      LoginDeviceType.MOBILE,
    ],
    [
      'Chrome on an Android tablet (no "Mobile")',
      'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Chrome 130',
      'Android',
      LoginDeviceType.TABLET,
    ],
    [
      'Firefox on an iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15',
      'Firefox 131',
      'iOS',
      LoginDeviceType.MOBILE,
    ],
    [
      'Opera on Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0',
      'Opera 114',
      'Windows',
      LoginDeviceType.DESKTOP,
    ],
    [
      'a headless browser',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
      'Chrome 131',
      'Linux',
      LoginDeviceType.BOT,
    ],
    ['a script', 'curl/8.7.1', 'curl 8', null, LoginDeviceType.BOT],
    ['something unknown', 'SomeApp', null, null, LoginDeviceType.UNKNOWN],
  ];

  it.each(cases)('recognises %s', (_name, header, browser, os, device) => {
    expect(summarizeUserAgent(header)).toEqual({
      browser,
      os,
      device_type: device,
    });
  });

  it('copes with no header at all', () => {
    expect(summarizeUserAgent(undefined)).toEqual({
      browser: null,
      os: null,
      device_type: LoginDeviceType.UNKNOWN,
    });
    expect(rawUserAgentOf('   ')).toBeNull();
  });

  it('keeps the raw header short', () => {
    const long = `Mozilla/5.0 ${'x'.repeat(2000)}`;
    expect(rawUserAgentOf(long)).toHaveLength(MAX_USER_AGENT_LENGTH);
    expect(rawUserAgentOf(['first', 'second'])).toBe('first');
  });
});
