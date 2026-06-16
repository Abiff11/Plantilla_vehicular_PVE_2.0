import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeRecordMainPlatesFromExcelFields1780425000000 implements MigrationInterface {
  name = 'NormalizeRecordMainPlatesFromExcelFields1780425000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH normalized AS (
        SELECT
          "id",
          CASE
            WHEN regexp_replace(upper(trim("plates2026")), '[[:space:]-]+', '', 'g') <> ''
              AND regexp_replace(upper(trim("plates2026")), '[[:space:]-]+', '', 'g') !~ '^[0-9]+$'
              AND regexp_replace(upper(trim("plates2026")), '[[:space:]-]+', '', 'g') ~ '[A-Z]'
              AND length(regexp_replace(upper(trim("plates2026")), '[[:space:]-]+', '', 'g')) >= 5
              AND regexp_replace(upper(trim("plates2026")), '[[:space:]-]+', '', 'g') NOT IN ('S/P', 'SP', 'SINPLACA', 'SINPLACAS', 'NA', 'N/A')
              THEN regexp_replace(upper(trim("plates2026")), '[[:space:]-]+', '', 'g')
            WHEN regexp_replace(upper(trim("plates2025")), '[[:space:]-]+', '', 'g') <> ''
              AND regexp_replace(upper(trim("plates2025")), '[[:space:]-]+', '', 'g') !~ '^[0-9]+$'
              AND regexp_replace(upper(trim("plates2025")), '[[:space:]-]+', '', 'g') ~ '[A-Z]'
              AND length(regexp_replace(upper(trim("plates2025")), '[[:space:]-]+', '', 'g')) >= 5
              AND regexp_replace(upper(trim("plates2025")), '[[:space:]-]+', '', 'g') NOT IN ('S/P', 'SP', 'SINPLACA', 'SINPLACAS', 'NA', 'N/A')
              THEN regexp_replace(upper(trim("plates2025")), '[[:space:]-]+', '', 'g')
            WHEN regexp_replace(upper(trim("plates2024")), '[[:space:]-]+', '', 'g') <> ''
              AND regexp_replace(upper(trim("plates2024")), '[[:space:]-]+', '', 'g') !~ '^[0-9]+$'
              AND regexp_replace(upper(trim("plates2024")), '[[:space:]-]+', '', 'g') ~ '[A-Z]'
              AND length(regexp_replace(upper(trim("plates2024")), '[[:space:]-]+', '', 'g')) >= 5
              AND regexp_replace(upper(trim("plates2024")), '[[:space:]-]+', '', 'g') NOT IN ('S/P', 'SP', 'SINPLACA', 'SINPLACAS', 'NA', 'N/A')
              THEN regexp_replace(upper(trim("plates2024")), '[[:space:]-]+', '', 'g')
            WHEN regexp_replace(upper(trim("previousPlates")), '[[:space:]-]+', '', 'g') <> ''
              AND regexp_replace(upper(trim("previousPlates")), '[[:space:]-]+', '', 'g') !~ '^[0-9]+$'
              AND regexp_replace(upper(trim("previousPlates")), '[[:space:]-]+', '', 'g') ~ '[A-Z]'
              AND length(regexp_replace(upper(trim("previousPlates")), '[[:space:]-]+', '', 'g')) >= 5
              AND regexp_replace(upper(trim("previousPlates")), '[[:space:]-]+', '', 'g') NOT IN ('S/P', 'SP', 'SINPLACA', 'SINPLACAS', 'NA', 'N/A')
              THEN regexp_replace(upper(trim("previousPlates")), '[[:space:]-]+', '', 'g')
            ELSE ''
          END AS "resolvedPlates"
        FROM "records"
      )
      UPDATE "records" AS record
      SET "plates" = normalized."resolvedPlates"
      FROM normalized
      WHERE record."id" = normalized."id"
        AND normalized."resolvedPlates" <> ''
        AND record."plates" IS DISTINCT FROM normalized."resolvedPlates";
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data normalization is intentionally not reverted.
  }
}
