import { TranslationKey } from '../../common/i18n/fr';
import { Language } from '../../common/i18n/languages';
import { renderTranslation } from '../../common/i18n/translate';
import { airspaceView } from '../navdata/navdata.service';
import { FlightPlanResult, LegResult } from './engine/engine';
import { MessageRef } from './engine/types';

// The engine's result as the API returns it: messages written out in the
// language of the request, dates as dates (a saved result comes back from
// JSON), airspaces with their limit labels and GeoJSON outline.

const MOMENTS = new Set(['takeoff', 'landing']);
const ROLES = new Set(['departure', 'destination', 'alternate']);

export function renderMessage(language: Language, message: MessageRef): string {
  const params = { ...(message.params ?? {}) };
  if (typeof params.moment === 'string' && MOMENTS.has(params.moment)) {
    params.moment = renderTranslation(
      language,
      `navplan.mb.moment.${params.moment}` as TranslationKey,
    );
  }
  if (typeof params.role === 'string' && ROLES.has(params.role)) {
    params.role = renderTranslation(
      language,
      `navplan.role.${params.role}` as TranslationKey,
    );
  }
  return renderTranslation(language, message.key as TranslationKey, params);
}

const date = (value: Date | string | null | undefined): Date | null =>
  value === null || value === undefined ? null : new Date(value);

function renderLeg(leg: LegResult, language: Language) {
  return {
    ...leg,
    eta: date(leg.eta),
    wind: { ...leg.wind, validAt: date(leg.wind.validAt) },
    segments: leg.segments.map((s) => ({
      ...s,
      startAltFt: Math.round(s.startAltFt),
      endAltFt: Math.round(s.endAltFt),
    })),
    crossings: leg.crossings.map((crossing) => ({
      ...crossing,
      airspace: airspaceView(crossing.airspace),
      requirement:
        renderMessage(language, crossing.requirement) +
        (crossing.relation === 'UNKNOWN_VERTICAL'
          ? ` ${renderTranslation(language, 'navplan.airspace.checkHeight')}`
          : ''),
    })),
  };
}

export function renderResult(result: FlightPlanResult, language: Language) {
  return {
    ...result,
    legs: result.legs.map((leg) => renderLeg(leg, language)),
    alternateLeg: result.alternateLeg
      ? renderLeg(result.alternateLeg, language)
      : null,
    profile: result.profile.map((p) => ({
      ...p,
      altitudeFt: Math.round(p.altitudeFt),
    })),
    fuel: {
      ...result.fuel,
      reserveCase: result.fuel.reserveCase ?? null,
      messages: result.fuel.messages.map((m) => renderMessage(language, m)),
    },
    massBalance: {
      ...result.massBalance,
      lines: result.massBalance.lines.map((line) => ({
        ...line,
        label:
          line.stationId === 'EMPTY'
            ? renderTranslation(language, 'navplan.pdf.mb.empty')
            : line.label,
      })),
      messages: result.massBalance.messages.map((m) =>
        renderMessage(language, m),
      ),
    },
    weather: result.weather.map((w) => ({
      ...w,
      observedAt: date(w.observedAt),
      tafValidFrom: date(w.tafValidFrom),
      tafValidTo: date(w.tafValidTo),
    })),
    qnhSource: result.qnhSource ?? null,
    qnhStation: result.qnhStation ?? null,
    qnhObservedAt: date(result.qnhObservedAt),
    daylight: result.daylight
      ? {
          ...result.daylight,
          nightFrom: date(result.daylight.nightFrom),
          aerodromes: result.daylight.aerodromes.map((a) => ({
            ...a,
            at: date(a.at),
            civilDawn: date(a.civilDawn),
            sunrise: date(a.sunrise),
            sunset: date(a.sunset),
            civilDusk: date(a.civilDusk),
          })),
        }
      : null,
    navdata: {
      ...result.navdata,
      effectiveFrom: date(result.navdata.effectiveFrom),
      effectiveTo: date(result.navdata.effectiveTo),
    },
    notices: result.notices.map((n) => ({
      code: n.code,
      status: n.status,
      message: renderMessage(language, n.message),
    })),
  };
}
