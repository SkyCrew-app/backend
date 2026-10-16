import { EntityManager } from 'typeorm';

// Removing the showcase: the rows listed in "showcase_items" are deleted,
// and nothing else unless the operator says so. The foreign keys of the
// database tell in which order (children first) and which rows written
// since by someone else point at a showcase row.

export interface ForeignKey {
  table: string;
  column: string;
  refTable: string;
  refColumn: string;
  nullable: boolean;
  // Postgres confdeltype: a = no action, r = restrict, c = cascade, n = set null, d = set default.
  onDelete: string;
}

export interface Schema {
  foreignKeys: ForeignKey[];
  // Primary key columns of each table.
  primaryKeys: Map<string, string[]>;
}

export const readSchema = async (manager: EntityManager): Promise<Schema> => {
  const fks: {
    table: string;
    column: string;
    ref_table: string;
    ref_column: string;
    nullable: boolean;
    on_delete: string;
  }[] = await manager.query(`
    SELECT c.conrelid::regclass::text AS table,
           a.attname AS column,
           c.confrelid::regclass::text AS ref_table,
           ra.attname AS ref_column,
           NOT a.attnotnull AS nullable,
           c.confdeltype AS on_delete
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace AND n.nspname = current_schema()
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`);
  const pks: { table: string; column: string }[] = await manager.query(`
    SELECT i.indrelid::regclass::text AS table, a.attname AS column
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = current_schema()
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indisprimary`);
  const unquote = (name: string) => name.replace(/^"|"$/g, '');
  const primaryKeys = new Map<string, string[]>();
  for (const pk of pks) {
    const table = unquote(pk.table);
    primaryKeys.set(table, [...(primaryKeys.get(table) ?? []), pk.column]);
  }
  return {
    foreignKeys: fks.map((fk) => ({
      table: unquote(fk.table),
      column: fk.column,
      refTable: unquote(fk.ref_table),
      refColumn: fk.ref_column,
      nullable: fk.nullable,
      onDelete: fk.on_delete,
    })),
    primaryKeys,
  };
};

// The order to delete the tables in: a table before the tables it points
// to. Foreign keys that may be emptied are emptied first (rows of the
// showcase only), so only the mandatory ones order the deletion.
export const deletionOrder = (
  tables: string[],
  foreignKeys: ForeignKey[],
): string[] => {
  const set = new Set(tables);
  // child -> parents it must be deleted before
  const before = new Map<string, Set<string>>();
  for (const table of tables) before.set(table, new Set());
  for (const fk of foreignKeys) {
    if (!set.has(fk.table) || !set.has(fk.refTable)) continue;
    if (fk.table === fk.refTable || fk.nullable) continue;
    before.get(fk.table)!.add(fk.refTable);
  }
  const order: string[] = [];
  const remaining = new Set(tables);
  while (remaining.size > 0) {
    // A table nobody left still points to can go.
    const ready = [...remaining]
      .filter(
        (table) =>
          ![...remaining].some(
            (other) => other !== table && before.get(other)!.has(table),
          ),
      )
      .sort();
    if (ready.length === 0) {
      throw new Error(
        `Showcase removal: circular mandatory foreign keys between ${[...remaining].join(', ')}`,
      );
    }
    for (const table of ready) {
      order.push(table);
      remaining.delete(table);
    }
  }
  return order;
};

export interface Dependent {
  table: string;
  via: string;
  onDelete: string;
  ids: string[];
}

const CHUNK = 1000;

const chunks = <T>(items: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK)
    out.push(items.slice(i, i + CHUNK));
  return out;
};

// The rows that are not the showcase's but point at one of its rows
// (written during the demonstration: a booking made live, a notification
// from the scheduler...). Link tables without a key of their own are left
// out: their rows only join two rows.
export const findDependents = async (
  manager: EntityManager,
  schema: Schema,
  rows: Map<string, Set<string>>,
): Promise<Dependent[]> => {
  const found: Dependent[] = [];
  for (const fk of schema.foreignKeys) {
    const parents = rows.get(fk.refTable);
    if (!parents || parents.size === 0) continue;
    const pk = schema.primaryKeys.get(fk.table) ?? [];
    if (pk.length !== 1) continue;
    const own = rows.get(fk.table) ?? new Set<string>();
    const ids: string[] = [];
    for (const slice of chunks([...parents])) {
      const result: { id: string }[] = await manager.query(
        `SELECT "${pk[0]}"::text AS id FROM "${fk.table}" WHERE "${fk.column}"::text = ANY($1::text[])`,
        [slice],
      );
      for (const { id } of result) if (!own.has(id)) ids.push(id);
    }
    if (ids.length > 0) {
      found.push({
        table: fk.table,
        via: `${fk.column} → ${fk.refTable}`,
        onDelete: fk.onDelete,
        ids: [...new Set(ids)],
      });
    }
  }
  return found;
};

export interface RemovalReport {
  deleted: Record<string, number>;
  dependents: Dependent[];
  dryRun: boolean;
}

// The trace of administrators' actions refuses DELETE through a trigger;
// it is set aside for the showcase's own lines only, inside the
// transaction (a failure restores it).
const APPEND_ONLY = {
  table: 'admin_actions',
  trigger: 'TRG_admin_actions_append_only',
};

export const removeShowcase = async (
  manager: EntityManager,
  options: { withDependents: boolean; dryRun: boolean },
): Promise<RemovalReport> => {
  const items: { entity: string; row_id: string }[] = await manager.query(
    `SELECT "entity", "row_id" FROM "showcase_items"`,
  );
  const rows = new Map<string, Set<string>>();
  for (const item of items) {
    const set = rows.get(item.entity) ?? new Set<string>();
    set.add(item.row_id);
    rows.set(item.entity, set);
  }
  const schema = await readSchema(manager);

  // Rows written since that point at the showcase: refused unless asked.
  // Asked, they go with it (and what points at them, and so on); rows that
  // merely let go of it (ON DELETE SET NULL) stay.
  const allDependents: Dependent[] = [];
  const seen = new Set<string>();
  let frontier = await findDependents(manager, schema, rows);
  while (frontier.length > 0) {
    allDependents.push(...frontier);
    frontier.forEach((d) => seen.add(`${d.table}|${d.via}|${d.ids.join(',')}`));
    if (!options.withDependents) break;
    for (const d of frontier.filter((x) => x.onDelete !== 'n')) {
      const set = rows.get(d.table) ?? new Set<string>();
      d.ids.forEach((id) => set.add(id));
      rows.set(d.table, set);
    }
    frontier = (await findDependents(manager, schema, rows)).filter(
      (d) => !seen.has(`${d.table}|${d.via}|${d.ids.join(',')}`),
    );
  }
  if (allDependents.length > 0 && !options.withDependents && !options.dryRun) {
    const list = allDependents
      .map((d) => `  ${d.table} (${d.via}): ${d.ids.length} row(s)`)
      .join('\n');
    throw new Error(
      `Rows written since the showcase was created point at it:\n${list}\nNothing was removed. Run again with --with-dependents to remove them with the showcase (--dry-run to look first).`,
    );
  }

  const tables = [...rows.keys()].filter((t) => (rows.get(t)?.size ?? 0) > 0);
  const deleted: Record<string, number> = {};
  if (options.dryRun) {
    for (const table of tables) deleted[table] = rows.get(table)!.size;
    return { deleted, dependents: allDependents, dryRun: true };
  }

  // Link rows (no key of their own) that join a row being removed.
  for (const fk of schema.foreignKeys) {
    const pk = schema.primaryKeys.get(fk.table) ?? [];
    const parents = rows.get(fk.refTable);
    if (pk.length === 1 || !parents) continue;
    for (const slice of chunks([...parents])) {
      const result = await manager.query(
        `DELETE FROM "${fk.table}" WHERE "${fk.column}"::text = ANY($1::text[])`,
        [slice],
      );
      deleted[fk.table] = (deleted[fk.table] ?? 0) + Number(result?.[1] ?? 0);
    }
  }
  // Optional keys between rows being removed are emptied first: no cycle
  // can then block the deletion.
  for (const fk of schema.foreignKeys) {
    if (!fk.nullable) continue;
    const own = rows.get(fk.table);
    const parents = rows.get(fk.refTable);
    const pk = schema.primaryKeys.get(fk.table) ?? [];
    if (!own || !parents || pk.length !== 1) continue;
    for (const slice of chunks([...own])) {
      await manager.query(
        `UPDATE "${fk.table}" SET "${fk.column}" = NULL WHERE "${pk[0]}"::text = ANY($1::text[]) AND "${fk.column}" IS NOT NULL`,
        [slice],
      );
    }
  }
  for (const table of deletionOrder(tables, schema.foreignKeys)) {
    const pk = schema.primaryKeys.get(table) ?? [];
    if (pk.length !== 1) {
      throw new Error(`Showcase removal: ${table} has no single primary key`);
    }
    const appendOnly = table === APPEND_ONLY.table;
    if (appendOnly) {
      await manager.query(
        `ALTER TABLE "${APPEND_ONLY.table}" DISABLE TRIGGER "${APPEND_ONLY.trigger}"`,
      );
    }
    for (const slice of chunks([...rows.get(table)!])) {
      const result = await manager.query(
        `DELETE FROM "${table}" WHERE "${pk[0]}"::text = ANY($1::text[])`,
        [slice],
      );
      deleted[table] = (deleted[table] ?? 0) + Number(result?.[1] ?? 0);
    }
    if (appendOnly) {
      await manager.query(
        `ALTER TABLE "${APPEND_ONLY.table}" ENABLE TRIGGER "${APPEND_ONLY.trigger}"`,
      );
    }
  }
  await manager.query(`DELETE FROM "showcase_items"`);
  await manager.query(`DELETE FROM "showcase_state"`);
  return { deleted, dependents: allDependents, dryRun: false };
};
