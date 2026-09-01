import { AfterLoad, Column, Entity, ManyToOne } from "typeorm";
import { BaseEntity } from "src/common/entities/base.entity";
import { MessageEntity } from "src/modules/messages/entities/message.entity";
import { UserEntity } from "src/modules/users/entities/user.entity";

@Entity("message_photos")
export class MessagePhotoEntity extends BaseEntity {
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

  @ManyToOne(() => MessageEntity, (message) => message.photos, {
    nullable: false,
    onDelete: "CASCADE",
  })
  message!: MessageEntity;

  @ManyToOne(() => UserEntity, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  uploadedBy!: UserEntity;

  @AfterLoad()
  useLocalPublicUrl() {
    if (this.objectKey) {
      this.publicUrl = `/api/files/${this.objectKey}`;
    }
  }
}
