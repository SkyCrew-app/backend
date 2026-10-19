import { EnginePoint } from './engine';

// How a point is written on the nav log: a VFR reporting point with its
// aerodrome ("LFPN S", never a bare "S": 66 points of AIRAC 2610 are "S"),
// anything else by its identifier.
export const pointLabel = (
  point: Pick<EnginePoint, 'type' | 'ident' | 'aerodromeIcao'>,
): string =>
  point.type === 'VRP' && point.aerodromeIcao
    ? `${point.aerodromeIcao} ${point.ident}`
    : point.ident;
