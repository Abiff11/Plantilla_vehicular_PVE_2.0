import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  civ?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  previousPlates?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  plates2024?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  plates2025?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  plates2026?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  plates?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  useType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicleClass?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  model?: string;

  @IsOptional()
  @IsString()
<<<<<<< HEAD
  @MaxLength(30)
=======
  @MaxLength(20)
>>>>>>> 6c9dfbe (fixes varios)
  cylinders?: string;

  @IsOptional()
  @IsString()
<<<<<<< HEAD
  @MaxLength(30)
=======
  @MaxLength(20)
>>>>>>> 6c9dfbe (fixes varios)
  fuelCapacityLiters?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  engineNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

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
  @MaxLength(160)
  adscription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  custodian?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  patrolNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @IsOptional()
  @IsString()
<<<<<<< HEAD
=======
  @MaxLength(160)
  adscription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  realLocation?: string;

  @IsOptional()
  @IsString()
>>>>>>> 6c9dfbe (fixes varios)
  @MaxLength(80)
  physicalStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rawCirculationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  rawCirculationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assetClassification?: string;

  @IsOptional()
  @IsString()
<<<<<<< HEAD
  @MaxLength(1000)
=======
  @MaxLength(120)
  rawAssetClassification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceSection?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceRowNumber?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
>>>>>>> 6c9dfbe (fixes varios)
  observation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  realLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceSection?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceRowNumber?: number | null;
}
