import type { Request, Response } from 'express';
import { clientIpOf } from './client-ip';

export interface GraphqlContext {
  req: Request;
  res: Response;
  // The visitor's address, as worked out from the trusted proxies only.
  clientIp: string | null;
}

export const graphqlContext = ({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): GraphqlContext => ({
  req,
  res,
  clientIp: clientIpOf(req),
});
