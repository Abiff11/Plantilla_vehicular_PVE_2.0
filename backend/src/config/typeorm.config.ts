import * as fs from "node:fs";
import * as path from "node:path";
import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { DataSource, type DataSourceOptions } from "typeorm";
import { AuditLogEntity } from "../modules/audit-logs/entities/audit-log.entity";
import { CatalogAliasEntity } from "../modules/catalog/entities/catalog-alias.entity";
import { CatalogGroupEntity } from "../modules/catalog/entities/catalog-group.entity";
import { CatalogItemEntity } from "../modules/catalog/entities/catalog-item.entity";
import { DelegationEntity } from "../modules/catalog/entities/delegation.entity";
import { RegionEntity } from "../modules/catalog/entities/region.entity";
import { ConversationEntity } from "../modules/messages/entities/conversation.entity";
import { MessageEntity } from "../modules/messages/entities/message.entity";
import { MessagePhotoEntity } from "../modules/messages/entities/message-photo.entity";
import { RecordEntity } from "../modules/records/entities/record.entity";
import { VehiclePhotoEntity } from "../modules/records/entities/vehicle-photo.entity";
import { VehicleRosterReportEntity } from "../modules/records/entities/vehicle-roster-report.entity";
import { VehicleTransferEntity } from "../modules/records/entities/vehicle-transfer.entity";
import { UserEntity } from "../modules/users/entities/user.entity";

const ENTITIES = [
  AuditLogEntity,
  CatalogAliasEntity,
  CatalogGroupEntity,
  CatalogItemEntity,
  ConversationEntity,
  DelegationEntity,
  MessageEntity,
  MessagePhotoEntity,
  RecordEntity,
  RegionEntity,
  UserEntity,
  VehiclePhotoEntity,
  VehicleRosterReportEntity,
  VehicleTransferEntity,
];

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^[‘'"]|[’'"]$/gu, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function resolveNumber(value: string | number | undefined, fallback: number) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function createTypeOrmOptions(
  configService?: ConfigService,
): DataSourceOptions {
  if (!configService) {
    loadEnvFile();
  }

  const readValue = (key: string, fallback?: string): string | undefined => {
    if (configService) {
      const value = configService.get<string>(key);
      return value ?? fallback;
    }

    return process.env[key] ?? fallback;
  };

  return {
    type: "postgres",
    host: readValue("DATABASE_HOST", "localhost"),
    port: resolveNumber(readValue("DATABASE_PORT", "5432"), 5432),
    database: readValue("DATABASE_NAME", "vehicle_control"),
    username: readValue("DATABASE_USER", "postgres"),
    password: readValue("DATABASE_PASSWORD", "change_me"),
    entities: ENTITIES,
    migrations: [
      path.join(__dirname, "..", "database", "migrations", "*{.ts,.js}"),
    ],
    synchronize: false,
    migrationsRun: true,
    dropSchema: false,
    ssl:
      readValue("DATABASE_SSL", "false") === "true"
        ? { rejectUnauthorized: false }
        : false,
  };
}

const dataSource = new DataSource(createTypeOrmOptions());

export default dataSource;
