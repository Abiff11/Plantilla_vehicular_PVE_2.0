import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Role } from 'src/common/enums/role.enum';
import { UserEntity } from './entities/user.entity';

const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

@Injectable()
export class SuperadminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperadminBootstrapService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap() {
    const superadminEmail = this.configService
      .get<string>('SUPERADMIN_EMAIL')
      ?.trim()
      .toLowerCase();
    const superadminPassword = this.configService.get<string>('SUPERADMIN_PASSWORD')?.trim();
    const superadminFirstName =
      this.configService.get<string>('SUPERADMIN_FIRST_NAME')?.trim() || 'Super';
    const superadminLastName =
      this.configService.get<string>('SUPERADMIN_LAST_NAME')?.trim() || 'Administrador';
    const superadminGrade =
      this.configService.get<string>('SUPERADMIN_GRADE')?.trim() || 'N/A';
    const superadminPhone =
      this.configService.get<string>('SUPERADMIN_PHONE')?.trim() || '0000000000';

    if (!superadminEmail || !superadminPassword) {
      this.logger.warn(
        'SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD is missing. Initial superadmin bootstrap was skipped.',
      );
      return;
    }

    if (!PASSWORD_POLICY_REGEX.test(superadminPassword)) {
      this.logger.error(
        'SUPERADMIN_PASSWORD does not meet the minimum policy: at least 8 characters, one uppercase, one lowercase, one digit, and one special character. Bootstrap aborted.',
      );
      return;
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: superadminEmail },
      withDeleted: true,
    });

    if (existingUser) {
      this.logger.log(`Initial superadmin bootstrap skipped. ${superadminEmail} already exists.`);
      return;
    }

    const passwordHash = await bcrypt.hash(superadminPassword, 10);

    await this.userRepository.save(
      this.userRepository.create({
        firstName: superadminFirstName,
        lastName: superadminLastName,
        grade: superadminGrade,
        phone: superadminPhone,
        email: superadminEmail,
        passwordHash,
        role: Role.SuperAdmin,
      }),
    );

    this.logger.log(`Initial superadmin created for ${superadminEmail}.`);
  }
}
