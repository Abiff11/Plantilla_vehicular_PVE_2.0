import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrimaryVehiclePhoto1910000000000 implements MigrationInterface {
  name = "AddPrimaryVehiclePhoto1910000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vehicle_photos"
      ADD COLUMN IF NOT EXISTS "isPrimary" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "recordId"
            ORDER BY "createdAt" ASC, "id" ASC
          ) AS row_number
        FROM "vehicle_photos"
        WHERE "deletedAt" IS NULL
      )
      UPDATE "vehicle_photos" AS photo
      SET "isPrimary" = true
      FROM ranked
      WHERE photo."id" = ranked."id"
        AND ranked.row_number = 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vehicle_photos_primary_per_record"
      ON "vehicle_photos" ("recordId")
      WHERE "isPrimary" = true AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vehicle_photos_primary_per_record"`);
    await queryRunner.query(`ALTER TABLE "vehicle_photos" DROP COLUMN IF EXISTS "isPrimary"`);
  }
}
