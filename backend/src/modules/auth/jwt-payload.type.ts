import { Role } from 'src/common/enums/role.enum';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  regionId: string | null;
  delegationId: string | null;
  sessionVersion: number;
};
