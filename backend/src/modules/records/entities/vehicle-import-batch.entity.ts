import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { VehicleImportErrorEntity } from './vehicle-import-error.entity';

export enum VehicleImportBatchStatus {
  Previewed = 'PREVIEWED',
  Imported = 'IMPORTED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

@Entity('vehicle_import_batches')
export class VehicleImportBatchEntity extends BaseEntity {
  @Column()
  fileName!: string;

  @Column({ default: '' })
  sheetName!: string;

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  validRows!: number;

  @Column({ type: 'int', default: 0 })
  invalidRows!: number;

  @Column({ type: 'int', default: 0 })
  importedRows!: number;

  @Column({ type: 'varchar', default: VehicleImportBatchStatus.Previewed })
  status!: VehicleImportBatchStatus;

  @Column({ type: 'jsonb', default: [] })
  sourceSections!: string[];

  @Column({ type: 'jsonb', default: [] })
  pendingCatalogValues!: Array<{ catalogCode: string; values: string[] }>;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt!: Date | null;

  @ManyToOne(() => UserEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  createdBy!: UserEntity;

  @OneToMany(() => VehicleImportErrorEntity, (error) => error.batch)
  errors!: VehicleImportErrorEntity[];
}
