import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCatalogItemDto {
  @IsString()
  @MaxLength(80)
  code!: string;

  @IsString()
  @MaxLength(160)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  normalizedValue?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
