import { getMetadataArgsStorage } from 'typeorm';
import { AddShowcaseRefreshDate1802000000002 } from '../../../migrations/1802000000002-AddShowcaseRefreshDate';
import { ShowcaseState } from '../showcase.entity';

describe('showcase refresh date migration', () => {
  const statementsOf = async (direction: 'up' | 'down') => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    await new AddShowcaseRefreshDate1802000000002()[direction](
      queryRunner as any,
    );
    return queryRunner.query.mock.calls.map(([sql]) =>
      String(sql).replace(/\s+/g, ' ').trim(),
    );
  };

  it('adds the column of the entity, can run again and undoes itself', async () => {
    expect(await statementsOf('up')).toEqual([
      'ALTER TABLE "showcase_state" ADD COLUMN IF NOT EXISTS "refreshed_at" TIMESTAMP WITH TIME ZONE',
    ]);
    expect(await statementsOf('down')).toEqual([
      'ALTER TABLE "showcase_state" DROP COLUMN IF EXISTS "refreshed_at"',
    ]);
    const column = getMetadataArgsStorage().columns.find(
      (c) => c.target === ShowcaseState && c.propertyName === 'refreshed_at',
    );
    expect(column?.options).toMatchObject({
      type: 'timestamptz',
      nullable: true,
    });
    expect(column?.options.default).toBeUndefined();
  });
});
