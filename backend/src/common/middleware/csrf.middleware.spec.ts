import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { csrfMiddleware } from './csrf.middleware';

describe('csrfMiddleware', () => {
  it('allows Control de Personal integration PATCH requests to reach the token guard', () => {
    const request = {
      method: 'PATCH',
      path: '/api/integrations/control-personal/records/22222222-2222-4222-8222-222222222222/custodian-link',
      headers: {},
    } as Request;
    const next = jest.fn();

    csrfMiddleware(request, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('still rejects ordinary PATCH requests without matching CSRF cookie and header', () => {
    const request = {
      method: 'PATCH',
      path: '/api/records/22222222-2222-4222-8222-222222222222',
      protocol: 'https',
      headers: {},
      get: jest.fn().mockReturnValue('example.test'),
    } as unknown as Request;
    const next = jest.fn();

    csrfMiddleware(request, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenException);
  });
});
