import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * 普通登录用户守卫（模块 5）。
 *
 * 机会匹配、画像补充、关注与纠错均为登录后操作，必须能识别用户身份；
 * 但不要求 staff 角色（与 AdminGuard 区分）。身份同样由认证后的同源代理
 * 注入 x-user-id 请求头；接入真实 JWT 后只替换本守卫的身份来源。
 */
@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: { id: string; role: string };
    }>();

    const raw = request.headers['x-user-id'];
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (!userId) {
      throw new UnauthorizedException('缺少用户身份信息，请先登录');
    }
    const rawRole = request.headers['x-user-role'];
    const role = (Array.isArray(rawRole) ? rawRole[0] : rawRole) ?? 'user';
    request.user = { id: userId, role };
    return true;
  }
}
