import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignCentroWorkCenters1780424000000 implements MigrationInterface {
  name = 'AlignCentroWorkCenters1780424000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "regions" ("id", "createdAt", "updatedAt", "name", "code", "sortOrder")
      SELECT uuid_generate_v4(), now(), now(), 'CENTRO', 'REGION_CENTRO', 10
      WHERE NOT EXISTS (
        SELECT 1 FROM "regions" WHERE "code" = 'REGION_CENTRO' OR upper("name") = 'CENTRO'
      )
    `);

    await queryRunner.query(`
      WITH centro_region AS (
        SELECT "id" FROM "regions"
        WHERE "code" = 'REGION_CENTRO' OR upper("name") = 'CENTRO'
        ORDER BY "sortOrder" ASC
        LIMIT 1
      ), work_centers(display_name, match_name, sort_order) AS (
        VALUES
          ('DIRECCIÓN OPERATIVA PLAZA', 'DIRECCION OPERATIVA PLAZA', 1),
          ('PROYECTOS Y DESPLIEGUES', 'PROYECTOS Y DESPLIEGUES', 2),
          ('ENCARGADO DEL ÁREA DE LOGÍSTICA', 'ENCARGADO DEL AREA DE LOGISTICA', 3),
          ('DEPARTAMENTO DE ALCOHOLIMETRO', 'DEPARTAMENTO DE ALCOHOLIMETRO', 4),
          ('OPERATIVO PLAZA/ ALCOHOLIMETRO', 'OPERATIVO PLAZA/ ALCOHOLIMETRO', 5),
          ('OPERATIVO/EDUCACION VIAL', 'OPERATIVO/EDUCACION VIAL', 6),
          ('PERITOS', 'PERITOS', 7),
          ('DELEGACIÓN PLAZA', 'DELEGACION PLAZA', 8),
          ('PATRULLEROS', 'PATRULLEROS', 9),
          ('OPERATIVO PLAZA', 'OPERATIVO PLAZA', 10),
          ('DIRECCIÓN GENERAL', 'DIRECCION GENERAL', 11),
          ('UNIDAD ADMINISTRATIVA', 'UNIDAD ADMINISTRATIVA', 12),
          ('COORDINACIÓN DE PROYECTOS Y DESPLIEGUES', 'COORDINACION DE PROYECTOS Y DESPLIEGUES', 13),
          ('RECURSOS HUMANOS', 'RECURSOS HUMANOS', 14),
          ('PROXIMIDAD SOCIAL', 'PROXIMIDAD SOCIAL', 15),
          ('POLICÍA ESTATAL', 'POLICIA ESTATAL', 16),
          ('APOYO AL MANDO', 'APOYO AL MANDO', 17),
          ('GRUPO BICI-POLICIAS', 'GRUPO BICI-POLICIAS', 18)
      )
      INSERT INTO "delegations" ("id", "createdAt", "updatedAt", "name", "sortOrder", "regionId")
      SELECT uuid_generate_v4(), now(), now(), wc.display_name, wc.sort_order, cr."id"
      FROM work_centers wc
      CROSS JOIN centro_region cr
      WHERE NOT EXISTS (
        SELECT 1
        FROM "delegations" d
        WHERE d."regionId" = cr."id"
          AND regexp_replace(regexp_replace(upper(trim(d."name")), '[.]', '', 'g'), '\\s+', ' ', 'g') = wc.match_name
      )
    `);

    await queryRunner.query(`
      WITH centro_region AS (
        SELECT "id" FROM "regions"
        WHERE "code" = 'REGION_CENTRO' OR upper("name") = 'CENTRO'
        ORDER BY "sortOrder" ASC
        LIMIT 1
      ), work_centers(display_name, match_name, sort_order) AS (
        VALUES
          ('DIRECCIÓN OPERATIVA PLAZA', 'DIRECCION OPERATIVA PLAZA', 1),
          ('PROYECTOS Y DESPLIEGUES', 'PROYECTOS Y DESPLIEGUES', 2),
          ('ENCARGADO DEL ÁREA DE LOGÍSTICA', 'ENCARGADO DEL AREA DE LOGISTICA', 3),
          ('DEPARTAMENTO DE ALCOHOLIMETRO', 'DEPARTAMENTO DE ALCOHOLIMETRO', 4),
          ('OPERATIVO PLAZA/ ALCOHOLIMETRO', 'OPERATIVO PLAZA/ ALCOHOLIMETRO', 5),
          ('OPERATIVO/EDUCACION VIAL', 'OPERATIVO/EDUCACION VIAL', 6),
          ('PERITOS', 'PERITOS', 7),
          ('DELEGACIÓN PLAZA', 'DELEGACION PLAZA', 8),
          ('PATRULLEROS', 'PATRULLEROS', 9),
          ('OPERATIVO PLAZA', 'OPERATIVO PLAZA', 10),
          ('DIRECCIÓN GENERAL', 'DIRECCION GENERAL', 11),
          ('UNIDAD ADMINISTRATIVA', 'UNIDAD ADMINISTRATIVA', 12),
          ('COORDINACIÓN DE PROYECTOS Y DESPLIEGUES', 'COORDINACION DE PROYECTOS Y DESPLIEGUES', 13),
          ('RECURSOS HUMANOS', 'RECURSOS HUMANOS', 14),
          ('PROXIMIDAD SOCIAL', 'PROXIMIDAD SOCIAL', 15),
          ('POLICÍA ESTATAL', 'POLICIA ESTATAL', 16),
          ('APOYO AL MANDO', 'APOYO AL MANDO', 17),
          ('GRUPO BICI-POLICIAS', 'GRUPO BICI-POLICIAS', 18)
      ), target_delegations AS (
        SELECT d."id", wc.match_name
        FROM "delegations" d
        CROSS JOIN centro_region cr
        INNER JOIN work_centers wc
          ON regexp_replace(regexp_replace(upper(trim(d."name")), '[.]', '', 'g'), '\\s+', ' ', 'g') = wc.match_name
        WHERE d."regionId" = cr."id"
      ), record_work_center AS (
        SELECT r."id", td."id" AS "targetDelegationId"
        FROM "records" r
        INNER JOIN target_delegations td
          ON regexp_replace(
            regexp_replace(
              upper(trim(coalesce(nullif(r."delegationName", ''), nullif(r."adscription", ''), ''))),
              '[.]',
              '',
              'g'
            ),
            '\\s+',
            ' ',
            'g'
          ) = td.match_name
      )
      UPDATE "records" r
      SET "delegationId" = rwc."targetDelegationId", "updatedAt" = now()
      FROM record_work_center rwc
      WHERE r."id" = rwc."id"
        AND r."delegationId" <> rwc."targetDelegationId"
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No se revierte automaticamente para no mover registros importados a delegaciones genericas.
  }
}
