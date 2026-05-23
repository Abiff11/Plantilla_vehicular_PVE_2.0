import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRecordDto {
  @IsString()
  @MaxLength(20)
  plates!: string;

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

  @IsString()
  @MaxLength(80)
  physicalStatus!: string;

  @IsString()
  @MaxLength(80)
  status!: string;

  @IsString()
  @MaxLength(80)
  assetClassification!: string;

  @IsString()
  @MaxLength(500)
  observation!: string;

  @IsUUID()
  delegationId!: string;
}
