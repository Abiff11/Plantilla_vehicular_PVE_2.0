import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { CatalogItemEntity } from './catalog-item.entity';

@Entity('catalog_aliases')
@Index(['catalogItem', 'normalizedRawValue'], { unique: true })
export class CatalogAliasEntity extends BaseEntity {
  @Column()
  rawValue!: string;

  @Column()
  normalizedRawValue!: string;

  @Column({ default: 'manual' })
  source!: string;

  @ManyToOne(() => CatalogItemEntity, (item) => item.aliases, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  catalogItem!: CatalogItemEntity;
}
