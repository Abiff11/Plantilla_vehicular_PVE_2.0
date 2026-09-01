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

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "set_first_vehicle_photo_primary"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."isPrimary" = false AND NOT EXISTS (
          SELECT 1
          FROM "vehicle_photos"
          WHERE "recordId" = NEW."recordId"
            AND "isPrimary" = true
            AND "deletedAt" IS NULL
        ) THEN
          NEW."isPrimary" := true;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_vehicle_photos_first_primary" ON "vehicle_photos"
    `);

    await queryRunner.query(`
      CREATE TRIGGER "TRG_vehicle_photos_first_primary"
      BEFORE INSERT ON "vehicle_photos"
      FOR EACH ROW
      EXECUTE FUNCTION "set_first_vehicle_photo_primary"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_vehicle_photos_first_primary" ON "vehicle_photos"
    `);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "set_first_vehicle_photo_primary"()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vehicle_photos_primary_per_record"`);
    await queryRunner.query(`ALTER TABLE "vehicle_photos" DROP COLUMN IF EXISTS "isPrimary"`);
  }
}
