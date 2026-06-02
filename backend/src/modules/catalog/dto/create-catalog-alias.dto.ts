import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCatalogAliasDto {
  @IsString()
  @MaxLength(160)
  rawValue!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;
}
