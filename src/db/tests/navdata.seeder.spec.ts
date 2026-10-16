import { seedNavdataBaseline } from '../navdata.seeder';

describe('seedNavdataBaseline', () => {
  const make = (cycle: unknown) => {
    const calls: string[] = [];
    const importService = {
      ensureData: jest.fn(async () => {
        calls.push('ensureData');
      }),
    };
    const navdata = {
      invalidate: jest.fn(() => calls.push('invalidate')),
      activeCycle: jest.fn(async () => cycle as never),
    };
    return { calls, importService, navdata };
  };

  it('forgets the cycle cached before the tables were emptied, then imports the baseline', async () => {
    const { calls, importService, navdata } = make({ id: 1 });
    await seedNavdataBaseline(importService, navdata);
    expect(calls).toEqual(['invalidate', 'ensureData', 'invalidate']);
    expect(navdata.activeCycle).toHaveBeenCalled();
  });

  it('stops the seed when no cycle is active afterwards', async () => {
    const { importService, navdata } = make(null);
    await expect(seedNavdataBaseline(importService, navdata)).rejects.toThrow(
      'No navigation data',
    );
  });
});
