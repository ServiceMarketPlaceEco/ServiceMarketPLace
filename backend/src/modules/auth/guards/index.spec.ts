import { AdminGuard, CustomerGuard, ProviderGuard, RolesGuard, UserTypeGuard } from './index';

const context = (user: any) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }), getHandler: jest.fn(), getClass: jest.fn() } as any);

describe('Authorization guards', () => {
  it('only allows a customer through CustomerGuard', () => {
    const guard = new CustomerGuard({} as any);
    expect(guard.canActivate(context({ userType: 'customer' }))).toBe(true);
    expect(guard.canActivate(context({ userType: 'provider' }))).toBe(false);
  });

  it('only allows a provider through ProviderGuard', () => {
    const guard = new ProviderGuard({} as any);
    expect(guard.canActivate(context({ userType: 'provider' }))).toBe(true);
    expect(guard.canActivate(context({ userType: 'customer' }))).toBe(false);
  });

  it('only allows an admin through AdminGuard', () => {
    const guard = new AdminGuard({} as any);
    expect(guard.canActivate(context({ userType: 'admin' }))).toBe(true);
    expect(guard.canActivate(context(undefined))).toBeFalsy();
  });

  it('checks the allowed user types', () => {
    const reflector: any = { getAllAndOverride: jest.fn().mockReturnValue(['customer']) };
    const guard = new UserTypeGuard(reflector);
    expect(guard.canActivate(context({ userType: 'customer' }))).toBe(true);
    expect(guard.canActivate(context({ userType: 'provider' }))).toBe(false);
  });

  it('checks the role inside the signed in account', () => {
    const reflector: any = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) };
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context({ user: { role: 'admin' } }))).toBe(true);
    expect(guard.canActivate(context({ user: { role: 'support' } }))).toBe(false);
  });
});
