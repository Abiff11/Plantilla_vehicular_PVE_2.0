import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { CatalogItemEntity } from './catalog-item.entity';

@Entity('catalog_groups')
export class CatalogGroupEntity extends BaseEntity {
  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ default: false })
  isSystem!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @OneToMany(() => CatalogItemEntity, (item) => item.group)
  items!: CatalogItemEntity[];
}
