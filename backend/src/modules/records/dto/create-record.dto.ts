import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRecordDto {
  @IsString()
  @MaxLength(20)
  plates!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  civ?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  previousPlates?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  plates2024?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  plates2025?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  plates2026?: string;

  @IsString()
  @MaxLength(80)
  brand!: string;

  @IsString()
  @MaxLength(80)
  type!: string;

  @IsString()
  @MaxLength(80)
  useType!: string;

  @IsString()
  @MaxLength(80)
  vehicleClass!: string;

  @IsString()
  @MaxLength(20)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cylinders?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  fuelCapacityLiters?: string;

  @IsString()
  @MaxLength(80)
  engineNumber!: string;

  @IsString()
  @MaxLength(80)
  serialNumber!: string;

  @IsString()
  @MaxLength(160)
  custodian!: string;

  @IsString()
  @MaxLength(40)
  patrolNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  adscription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  realLocation?: string;

  @IsString()
  @MaxLength(80)
  physicalStatus!: string;

  @IsString()
  @MaxLength(80)
  status!: string;

  @IsString()
  @MaxLength(80)
  assetClassification!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rawAssetClassification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  rawCirculationStatus?: string;

  @IsString()
  @MaxLength(500)
  observation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  regionName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  delegationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceSection?: string;

  @IsOptional()
  @Type(() => Number)
  sourceRowNumber?: number | null;

  @IsUUID()
  delegationId!: string;
}
