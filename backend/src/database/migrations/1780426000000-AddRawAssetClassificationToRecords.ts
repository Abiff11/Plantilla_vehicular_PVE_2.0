import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRawAssetClassificationToRecords1780426000000
  implements MigrationInterface
{
  name = "AddRawAssetClassificationToRecords1780426000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "records" ADD "rawAssetClassification" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`
      UPDATE "records"
      SET
        "rawAssetClassification" = CASE
          WHEN "observation" ~ '\\[Anotacion general Excel:' THEN regexp_replace(
            "observation",
            '^.*\\[Anotacion general Excel: ([^\\]]+)\\].*$',
            '\\1'
          )
          ELSE "assetClassification"
        END,
        "observation" = regexp_replace(
          "observation",
          '\\s*\\[Anotacion general Excel: [^\\]]+\\]',
          '',
          'g'
        )
      WHERE "rawAssetClassification" = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "records" DROP COLUMN "rawAssetClassification"`,
    );
  }
}
