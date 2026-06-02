import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDynamicCatalogs1780421000000 implements MigrationInterface {
  name = 'CreateDynamicCatalogs1780421000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE TABLE "catalog_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "code" character varying NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "isSystem" boolean NOT NULL DEFAULT false, "sortOrder" integer NOT NULL DEFAULT 0, CONSTRAINT "UQ_catalog_groups_code" UNIQUE ("code"), CONSTRAINT "PK_catalog_groups" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "catalog_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "code" character varying NOT NULL, "label" character varying NOT NULL, "normalizedValue" character varying NOT NULL DEFAULT '', "metadata" jsonb NOT NULL DEFAULT '{}', "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT 0, "groupId" uuid NOT NULL, CONSTRAINT "PK_catalog_items" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_catalog_items_group_code" ON "catalog_items" ("groupId", "code") WHERE "deletedAt" IS NULL`);
    await queryRunner.query(`CREATE TABLE "catalog_aliases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "rawValue" character varying NOT NULL, "normalizedRawValue" character varying NOT NULL, "source" character varying NOT NULL DEFAULT 'manual', "catalogItemId" uuid NOT NULL, CONSTRAINT "PK_catalog_aliases" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_catalog_aliases_item_normalized_raw" ON "catalog_aliases" ("catalogItemId", "normalizedRawValue") WHERE "deletedAt" IS NULL`);
    await queryRunner.query(`ALTER TABLE "catalog_items" ADD CONSTRAINT "FK_catalog_items_group" FOREIGN KEY ("groupId") REFERENCES "catalog_groups"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "catalog_aliases" ADD CONSTRAINT "FK_catalog_aliases_catalog_item" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalog_aliases" DROP CONSTRAINT "FK_catalog_aliases_catalog_item"`);
    await queryRunner.query(`ALTER TABLE "catalog_items" DROP CONSTRAINT "FK_catalog_items_group"`);
    await queryRunner.query(`DROP INDEX "IDX_catalog_aliases_item_normalized_raw"`);
    await queryRunner.query(`DROP TABLE "catalog_aliases"`);
    await queryRunner.query(`DROP INDEX "IDX_catalog_items_group_code"`);
    await queryRunner.query(`DROP TABLE "catalog_items"`);
    await queryRunner.query(`DROP TABLE "catalog_groups"`);
  }
}
