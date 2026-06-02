import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { VehicleImportBatchEntity } from './vehicle-import-batch.entity';

@Entity('vehicle_import_errors')
export class VehicleImportErrorEntity extends BaseEntity {
  @Column({ type: 'int' })
  rowNumber!: number;

  @Column({ default: '' })
  section!: string;

  @Column({ default: '' })
  columnName!: string;

  @Column({ type: 'text', default: '' })
  rawValue!: string;

  @Column({ default: 'VALIDATION' })
  errorType!: string;

  @Column({ type: 'text' })
  message!: string;

  @ManyToOne(() => VehicleImportBatchEntity, (batch) => batch.errors, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  batch!: VehicleImportBatchEntity;
}
