import { IsString, IsUUID, MaxLength } from 'class-validator';

export class LinkControlPersonalCustodianDto {
  @IsUUID()
  officerId!: string;

  @IsString()
  @MaxLength(180)
  officerName!: string;
}
