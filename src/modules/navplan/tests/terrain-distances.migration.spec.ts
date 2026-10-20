import { getMetadataArgsStorage, MigrationInterface } from 'typeorm';
import { AddMinimumSafeAltitudeSettings1801000000001 } from '../../../migrations/1801000000001-AddMinimumSafeAltitudeSettings';
import { AddRunwayDistances1801000000002 } from '../../../migrations/1801000000002-AddRunwayDistances';
import { FlightPlanningSettingsEntity } from '../entity/flight-planning-settings.entity';
import { AircraftPerformanceEntity } from '../../aircraft/entity/aircraft-flight-data.entity';

type Target = abstract new (...args: never[]) => unknown;

const statementsOf = async (
  migration: MigrationInterface,
  direction: 'up' | 'down',
) => {
  const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  await migration[direction](queryRunner as any);
  return queryRunner.query.mock.calls.map(([sql]) =>
    String(sql).replace(/\s+/g, ' ').trim(),
  );
};

const columnsOf = (target: Target) =>
  getMetadataArgsStorage()
    .columns.filter((c) => c.target === target)
    .map((c) => ({
      name: c.propertyName,
      type: c.options.type,
      nullable: !!c.options.nullable,
      default:
        typeof c.options.default === 'function'
          ? c.options.default()
          : c.options.default,
    }));

describe('minimum safe altitude and runway distance migrations', () => {
  const migrations = [
    new AddMinimumSafeAltitudeSettings1801000000001(),
    new AddRunwayDistances1801000000002(),
  ];

  it('can run again and undoes itself', async () => {
    for (const migration of migrations) {
      for (const statement of await statementsOf(migration, 'up'))
        expect(statement).toMatch(/ADD COLUMN IF NOT EXISTS/);
      for (const statement of await statementsOf(migration, 'down'))
        expect(statement).toMatch(/DROP COLUMN IF EXISTS/);
    }
  });

  it('adds exactly the columns of the entities', async () => {
    const added = (
      await Promise.all(migrations.map((m) => statementsOf(m, 'up')))
    )
      .flat()
      .map((sql) => {
        const [, table, column, type, rest] =
          /ALTER TABLE "(\w+)" ADD COLUMN IF NOT EXISTS "(\w+)" (double precision|integer|jsonb)(.*)$/.exec(
            sql,
          )!;
        const fallback = /DEFAULT ([\d.]+)/.exec(rest)?.[1];
        return {
          table,
          column,
          type,
          nullable: !/NOT NULL/.test(rest),
          default: fallback === undefined ? undefined : Number(fallback),
        };
      });
    const entities: Record<string, Target> = {
      flight_planning_settings: FlightPlanningSettingsEntity,
      aircraft_performance: AircraftPerformanceEntity,
    };
    for (const column of added) {
      const entity = columnsOf(entities[column.table]).find(
        (c) => c.name === column.column,
      );
      expect(entity).toEqual({
        name: column.column,
        type: column.type,
        nullable: column.nullable,
        default: column.default,
      });
    }
    expect(added.map((c) => c.column).sort()).toEqual(
      [
        'landing',
        'landing_safety_factor',
        'msa_corridor_nm',
        'msa_margin_ft',
        'takeoff',
        'takeoff_safety_factor',
      ].sort(),
    );
  });
});
