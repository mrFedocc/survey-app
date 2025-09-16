import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) throw new UnauthorizedException('ADMIN_TOKEN not configured');

    const auth = req.headers['authorization'] || req.headers['Authorization'] as string | undefined;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');

    const token = auth.slice('Bearer '.length).trim();
    if (token !== expected) throw new UnauthorizedException('Invalid token');
    return true;
  }
}
