import { MigrationInterface, QueryRunner } from 'typeorm';

const INDEX_PREFIX = 'IDX_perf_';
const FILTER_COLUMNS = [
  'created_at',
  'updated_at',
  'createdAt',
  'updatedAt',
  'fecha',
  'date',
  'dateFrom',
  'dateTo',
  'status',
  'estado',
  'activo',
  'region_id',
  'regionId',
  'delegation_id',
  'delegationId',
  'delegacion_id',
  'delegacionId',
  'catalog_group_id',
  'catalogGroupId',
  'user_id',
  'userId',
  'created_by_id',
  'createdById',
  'mainPlate',
  'main_plate',
  'serialNumber',
  'serial_number',
  'economicNumber',
  'economic_number',
];

type ColumnRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
};

type IndexRow = {
  schemaname: string;
  indexname: string;
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function buildIndexName(tableName: string, columnName: string): string {
  return `${INDEX_PREFIX}${tableName}_${columnName}`.slice(0, 63);
}

export class GenericPerformanceIndexes1790000000000 implements MigrationInterface {
  name = 'GenericPerformanceIndexes1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(
      `
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = ANY($1)
      `,
      [FILTER_COLUMNS],
    ) as ColumnRow[];

    for (const column of columns) {
      const indexName = buildIndexName(column.table_name, column.column_name);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(indexName)} ON ${quoteIdentifier(column.table_schema)}.${quoteIdentifier(column.table_name)} (${quoteIdentifier(column.column_name)})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indexes = await queryRunner.query(
      `
        SELECT schemaname, indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname LIKE $1
      `,
      [`${INDEX_PREFIX}%`],
    ) as IndexRow[];

    for (const index of indexes) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS ${quoteIdentifier(index.schemaname)}.${quoteIdentifier(index.indexname)}`,
      );
    }
  }
}
