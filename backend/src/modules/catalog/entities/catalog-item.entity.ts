import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { CatalogAliasEntity } from './catalog-alias.entity';
import { CatalogGroupEntity } from './catalog-group.entity';

@Entity('catalog_items')
@Index(['group', 'code'], { unique: true })
export class CatalogItemEntity extends BaseEntity {
  @Column()
  code!: string;

  @Column()
  label!: string;

  @Column({ default: '' })
  normalizedValue!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @ManyToOne(() => CatalogGroupEntity, (group) => group.items, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  group!: CatalogGroupEntity;

  @OneToMany(() => CatalogAliasEntity, (alias) => alias.catalogItem)
  aliases!: CatalogAliasEntity[];
}
