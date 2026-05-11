import { Injectable, ExecutionContext, SetMetadata, CanActivate } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

// JWT Auth Guard
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// Roles metadata key
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// User Types metadata key
export const USER_TYPES_KEY = 'userTypes';
export const UserTypes = (...userTypes: string[]) => SetMetadata(USER_TYPES_KEY, userTypes);

// Roles Guard
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.user?.role === role);
  }
}

// User Type Guard (customer, provider, admin)
@Injectable()
export class UserTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<string[]>(USER_TYPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredTypes) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredTypes.some((type) => user.userType === type);
  }
}

// Combined Guard for checking both JWT and User Type
@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return user && user.userType === 'customer';
  }
}

@Injectable()
export class ProviderGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return user && user.userType === 'provider';
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return user && user.userType === 'admin';
  }
}
