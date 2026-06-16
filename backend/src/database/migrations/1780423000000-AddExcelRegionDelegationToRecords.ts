import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExcelRegionDelegationToRecords1780423000000 implements MigrationInterface {
  name = 'AddExcelRegionDelegationToRecords1780423000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "records" ADD "regionName" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "records" ADD "delegationName" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`UPDATE "records" SET "delegationName" = "adscription" WHERE "delegationName" = '' AND "adscription" <> ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "delegationName"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN "regionName"`);
  }
}
