import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  plates?: string;

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
  @MaxLength(80)
  engineNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string;

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
  physicalStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assetClassification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;
}
