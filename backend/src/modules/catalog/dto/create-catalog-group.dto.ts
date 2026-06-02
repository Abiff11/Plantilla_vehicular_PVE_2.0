import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCatalogGroupDto {
  @IsString()
  @MaxLength(80)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
