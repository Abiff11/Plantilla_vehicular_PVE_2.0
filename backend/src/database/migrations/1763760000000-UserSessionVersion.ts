import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class UserSessionVersion1763760000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const usersTable = await queryRunner.getTable("users");
    const hasSessionVersion = usersTable?.findColumnByName("sessionVersion");

    if (hasSessionVersion) {
      return;
    }

    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "sessionVersion",
        type: "integer",
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const usersTable = await queryRunner.getTable("users");
    const hasSessionVersion = usersTable?.findColumnByName("sessionVersion");

    if (!hasSessionVersion) {
      return;
    }

    await queryRunner.dropColumn("users", "sessionVersion");
  }
}
