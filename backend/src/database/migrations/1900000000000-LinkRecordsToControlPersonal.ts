import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkRecordsToControlPersonal1900000000000 implements MigrationInterface {
  name = 'LinkRecordsToControlPersonal1900000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "records" ADD COLUMN IF NOT EXISTS "custodianOficialId" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_RECORDS_CUSTODIAN_OFICIAL_ID" ON "records" ("custodianOficialId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_RECORDS_CUSTODIAN_OFICIAL_ID"`);
    await queryRunner.query(`ALTER TABLE "records" DROP COLUMN IF EXISTS "custodianOficialId"`);
  }
}
