import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExcelImportFieldsToRecords1780420000000 implements MigrationInterface {
  name = 'AddExcelImportFieldsToRecords1780420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "records" ADD "civ" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "previousPlates" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "plates2024" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "plates2025" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "plates2026" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "cylinders" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "fuelCapacityLiters" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "adscription" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "color" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "rawCirculationStatus" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "realLocation" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "sourceSection" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "sourceRowNumber" integer`);
    await queryRunner.query(`ALTER TABLE "records" ADD "importBatchId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "importBatchId"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "sourceRowNumber"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "sourceSection"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "realLocation"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "rawCirculationStatus"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "color"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "adscription"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "fuelCapacityLiters"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "cylinders"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "plates2026"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "plates2025"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "plates2024"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "previousPlates"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "civ"`);
  }
}
