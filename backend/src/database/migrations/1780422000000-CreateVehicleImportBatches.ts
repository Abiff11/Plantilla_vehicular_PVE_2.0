import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVehicleImportBatches1780422000000 implements MigrationInterface {
  name = 'CreateVehicleImportBatches1780422000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "vehicle_import_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "fileName" character varying NOT NULL, "sheetName" character varying NOT NULL DEFAULT '', "totalRows" integer NOT NULL DEFAULT 0, "validRows" integer NOT NULL DEFAULT 0, "invalidRows" integer NOT NULL DEFAULT 0, "importedRows" integer NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'PREVIEWED', "sourceSections" jsonb NOT NULL DEFAULT '[]', "pendingCatalogValues" jsonb NOT NULL DEFAULT '[]', "finishedAt" TIMESTAMP, "createdById" uuid NOT NULL, CONSTRAINT "PK_vehicle_import_batches" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "vehicle_import_errors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "rowNumber" integer NOT NULL, "section" character varying NOT NULL DEFAULT '', "columnName" character varying NOT NULL DEFAULT '', "rawValue" text NOT NULL DEFAULT '', "errorType" character varying NOT NULL DEFAULT 'VALIDATION', "message" text NOT NULL, "batchId" uuid NOT NULL, CONSTRAINT "PK_vehicle_import_errors" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "vehicle_import_batches" ADD CONSTRAINT "FK_vehicle_import_batches_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "vehicle_import_errors" ADD CONSTRAINT "FK_vehicle_import_errors_batch" FOREIGN KEY ("batchId") REFERENCES "vehicle_import_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicle_import_batches_status" ON "vehicle_import_batches" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicle_import_errors_batch" ON "vehicle_import_errors" ("batchId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_vehicle_import_errors_batch"`);
    await queryRunner.query(`DROP INDEX "IDX_vehicle_import_batches_status"`);
    await queryRunner.query(`ALTER TABLE "vehicle_import_errors" DROP CONSTRAINT "FK_vehicle_import_errors_batch"`);
    await queryRunner.query(`ALTER TABLE "vehicle_import_batches" DROP CONSTRAINT "FK_vehicle_import_batches_created_by"`);
    await queryRunner.query(`DROP TABLE "vehicle_import_errors"`);
    await queryRunner.query(`DROP TABLE "vehicle_import_batches"`);
  }
}
