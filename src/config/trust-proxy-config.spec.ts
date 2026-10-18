import * as express from 'express';
import * as request from 'supertest';
import { PRIVATE_PROXY_RANGES, trustProxySetting } from './trust-proxy.config';
import { clientIpOf, normalizeIp } from '../common/http/client-ip';
import { graphqlContext } from '../common/http/graphql-context';

// An API configured like main.ts does, answering with the address it
// believes the visitor has.
const apiWith = (setting = trustProxySetting(undefined)) => {
  const app = express();
  app.set('trust proxy', setting);
  app.get('/ip', (req, res) => {
    res.json({ ip: clientIpOf(req) });
  });
  return app;
};

// The same, for a request reaching the API from any socket address (the
// test client always connects from the loopback).
const ipSeenFrom = (
  remoteAddress: string,
  forwardedFor?: string,
  setting = trustProxySetting(undefined),
): string | null => {
  const app = apiWith(setting);
  const req = Object.create(app.request);
  req.app = app;
  req.headers = forwardedFor ? { 'x-forwarded-for': forwardedFor } : {};
  req.connection = { remoteAddress };
  req.socket = req.connection;
  return clientIpOf(req);
};

describe('client address behind the proxies', () => {
  describe('setting', () => {
    it('trusts the private ranges by default and for the older hop counts', () => {
      expect(trustProxySetting(undefined)).toEqual(PRIVATE_PROXY_RANGES);
      expect(trustProxySetting('')).toEqual(PRIVATE_PROXY_RANGES);
      expect(trustProxySetting('private')).toEqual(PRIVATE_PROXY_RANGES);
      expect(trustProxySetting('1')).toEqual(PRIVATE_PROXY_RANGES);
      expect(trustProxySetting('2')).toEqual(PRIVATE_PROXY_RANGES);
      expect(PRIVATE_PROXY_RANGES).toEqual([
        'loopback',
        'linklocal',
        'uniquelocal',
      ]);
    });

    it('can trust no proxy, or exactly the ones listed', () => {
      expect(trustProxySetting('false')).toBe(false);
      expect(trustProxySetting('0')).toBe(false);
      expect(trustProxySetting('none')).toBe(false);
      expect(trustProxySetting(' 10.0.0.2 , 172.18.0.0/16 ')).toEqual([
        '10.0.0.2',
        '172.18.0.0/16',
      ]);
    });
  });

  // nginx on the host sets X-Forwarded-For to "<what the visitor sent>,
  // <visitor>", Caddy adds the address nginx came from (the Docker
  // gateway), and the API receives the request from Caddy's container.
  describe('header chains', () => {
    it('reads the visitor behind nginx and Caddy', async () => {
      const response = await request(apiWith())
        .get('/ip')
        .set('X-Forwarded-For', '198.51.100.23, 172.18.0.1');
      expect(response.body.ip).toBe('198.51.100.23');
    });

    it('ignores what the visitor wrote in the header themselves', async () => {
      const response = await request(apiWith())
        .get('/ip')
        .set('X-Forwarded-For', '6.6.6.6, 1.1.1.1, 198.51.100.23, 172.18.0.1')
        .set('X-Real-IP', '6.6.6.6');
      expect(response.body.ip).toBe('198.51.100.23');
    });

    it('reads the visitor behind Caddy alone', async () => {
      const response = await request(apiWith())
        .get('/ip')
        .set('X-Forwarded-For', '2001:db8::7');
      expect(response.body.ip).toBe('2001:db8::7');
    });

    it('stops at the first public address, even with private ones on its left', () => {
      expect(
        ipSeenFrom(
          '172.18.0.5',
          '10.1.2.3, 203.0.113.9, 192.168.1.1, 127.0.0.1',
        ),
      ).toBe('203.0.113.9');
    });

    it('believes no header when the API is reached directly from the Internet', () => {
      expect(ipSeenFrom('203.0.113.50', '1.2.3.4')).toBe('203.0.113.50');
      expect(ipSeenFrom('203.0.113.50')).toBe('203.0.113.50');
    });

    it('believes no header at all when no proxy is trusted', () => {
      expect(ipSeenFrom('172.18.0.5', '198.51.100.23', false)).toBe(
        '172.18.0.5',
      );
    });

    it('shows an IPv4 visitor seen through an IPv6 socket plainly', () => {
      expect(ipSeenFrom('::ffff:203.0.113.50')).toBe('203.0.113.50');
      expect(normalizeIp('::ffff:10.0.0.1')).toBe('10.0.0.1');
      expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1');
      expect(normalizeIp('')).toBeNull();
    });
  });

  it('gives the address to every GraphQL operation through the context', () => {
    const app = apiWith();
    const req = Object.create(app.request);
    req.app = app;
    req.headers = { 'x-forwarded-for': '198.51.100.23, 172.18.0.1' };
    req.connection = { remoteAddress: '172.18.0.4' };
    req.socket = req.connection;
    const res = {} as any;

    expect(graphqlContext({ req, res })).toEqual({
      req,
      res,
      clientIp: '198.51.100.23',
    });
  });
});
