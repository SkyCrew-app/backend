import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { ShowcaseItem } from './showcase.entity';

const CHUNK = 250;

// Writes rows and records each of them in "showcase_items" (its table and
// its primary key), in the same transaction: a row the showcase wrote is
// always listed, and nothing else ever is.
export class ShowcaseTracker {
  readonly counts = new Map<string, number>();

  constructor(private readonly manager: EntityManager) {}

  async track(table: string, ids: (string | number)[]): Promise<void> {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      if (slice.length === 0) continue;
      await this.manager
        .createQueryBuilder()
        .insert()
        .into(ShowcaseItem)
        .values(slice.map((id) => ({ entity: table, row_id: String(id) })))
        .execute();
    }
    this.counts.set(table, (this.counts.get(table) ?? 0) + ids.length);
  }

  // Inserts the rows (never an update) and returns their primary keys, in
  // the order of the rows.
  async insert<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
    rows: Partial<T>[],
  ): Promise<number[]> {
    const metadata = this.manager.connection.getMetadata(entity);
    if (metadata.primaryColumns.length !== 1) {
      throw new Error(
        `Showcase: ${metadata.tableName} has no single primary key`,
      );
    }
    const ids: number[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      if (slice.length === 0) continue;
      const result = await this.manager
        .createQueryBuilder()
        .insert()
        .into(entity)
        .values(slice as never)
        .returning(`"${metadata.primaryColumns[0].databaseName}"`)
        .execute();
      const returned = (result.raw as Record<string, unknown>[]).map((row) =>
        Number(row[metadata.primaryColumns[0].databaseName]),
      );
      if (
        returned.length !== slice.length ||
        returned.some((id) => !Number.isFinite(id))
      ) {
        throw new Error(
          `Showcase: ${metadata.tableName} did not return its keys`,
        );
      }
      ids.push(...returned);
      // TypeORM writes now() into creation / update date columns whatever
      // the row says: the dates of the showcase's own rows are set again.
      const pk = metadata.primaryColumns[0].databaseName;
      for (const column of [
        metadata.createDateColumn,
        metadata.updateDateColumn,
      ]) {
        if (!column) continue;
        for (const [index, row] of slice.entries()) {
          const value = (row as Record<string, unknown>)[column.propertyName];
          if (value instanceof Date) {
            await this.manager.query(
              `UPDATE "${metadata.tableName}" SET "${column.databaseName}" = $1 WHERE "${pk}" = $2`,
              [value, returned[index]],
            );
          }
        }
      }
    }
    await this.track(metadata.tableName, ids);
    return ids;
  }
}
