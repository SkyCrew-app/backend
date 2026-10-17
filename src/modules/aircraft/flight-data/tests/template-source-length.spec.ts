import { AIRCRAFT_TEMPLATES } from '../aircraft-templates';

describe('aircraft templates', () => {
  it('have a source short enough to be saved through the API', () => {
    for (const template of AIRCRAFT_TEMPLATES) {
      const source =
        JSON.stringify(template).match(/"source":"((?:[^"\\]|\\.)*)"/g) ?? [];
      for (const s of source)
        expect(JSON.parse(`{${s}}`).source.length).toBeLessThanOrEqual(2000);
    }
  });
});
