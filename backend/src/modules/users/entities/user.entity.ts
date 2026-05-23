import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Role } from 'src/common/enums/role.enum';
import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import { RegionEntity } from 'src/modules/catalog/entities/region.entity';
import { AuditLogEntity } from 'src/modules/audit-logs/entities/audit-log.entity';
import { RecordEntity } from 'src/modules/records/entities/record.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  grade!: string;

  @Column()
  phone!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: Role,
  })
  role!: Role;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'integer', default: 0 })
  sessionVersion!: number;

  @ManyToOne(() => RegionEntity, { nullable: true, onDelete: 'RESTRICT' })
  region!: RegionEntity | null;

  @ManyToOne(() => DelegationEntity, (delegation) => delegation.users, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  delegation!: DelegationEntity | null;

  @OneToMany(() => RecordEntity, (record) => record.createdBy)
  createdRecords!: RecordEntity[];

  @OneToMany(() => AuditLogEntity, (auditLog) => auditLog.actor)
  auditLogs!: AuditLogEntity[];
}
