import { Column, Entity, ManyToOne } from "typeorm";
import { BaseEntity } from "src/common/entities/base.entity";
import { RecordEntity } from "src/modules/records/entities/record.entity";
import { UserEntity } from "src/modules/users/entities/user.entity";

@Entity("vehicle_photos")
export class VehiclePhotoEntity extends BaseEntity {
  @Column()
  fileName!: string;

  @Column()
  filePath!: string;

  @Column()
  objectKey!: string;

  @Column()
  publicUrl!: string;

  @Column()
  mimeType!: string;

  @Column({ type: "integer", default: 0 })
  size!: number;

  @Column({ default: "local" })
  storageProvider!: string;

  @Column({ default: false })
  isPrimary!: boolean;

  @ManyToOne(() => RecordEntity, (record) => record.photos, {
    nullable: false,
    onDelete: "CASCADE",
  })
  record!: RecordEntity;

  @ManyToOne(() => UserEntity, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  uploadedBy!: UserEntity;
}
