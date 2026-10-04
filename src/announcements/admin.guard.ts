import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * 后台操作权限守卫（服务端强制校验）。
 *
 * 当前阶段真实认证尚未接入，用户身份由反向代理/前端在认证后注入请求头：
 * - x-user-id：用户 id
 * - x-user-role：用户角色（user / exam_reviewer / resource_reviewer / admin）
 *
 * 安全边界：
 * - 本守卫是后台写操作的唯一权限闸门，前端隐藏按钮不构成权限控制；
 * - 只有 admin / exam_reviewer 可执行审核、发布等操作；
 * - 接入真实 JWT 后，替换为从 token 解析用户身份，接口签名不变。
 */
export const STAFF_ROLES = ['admin', 'exam_reviewer', 'resource_reviewer'];
export const REVIEW_ROLES = ['admin', 'exam_reviewer'];

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: { id: string; role: string };
    }>();

    const userId = this.header(request, 'x-user-id');
    const role = this.header(request, 'x-user-role');

    if (!userId || !role) {
      throw new UnauthorizedException('缺少用户身份信息，请先登录');
    }

    if (!STAFF_ROLES.includes(role)) {
      throw new ForbiddenException('当前账号没有后台操作权限');
    }

    // 将用户信息挂到 request 上，供 service 使用
    request.user = { id: userId, role };
    return true;
  }

  private header(
    request: { headers: Record<string, string | string[] | undefined> },
    name: string,
  ): string | undefined {
    const raw = request.headers[name];
    return Array.isArray(raw) ? raw[0] : raw;
  }
}

/**
 * 审核操作专用守卫：仅 admin / exam_reviewer 可审核高影响字段。
 * resource_reviewer 只能查看，不能执行审核动作。
 */
@Injectable()
export class ReviewGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: { id: string; role: string };
    }>();

    // 复用 AdminGuard 的逻辑
    const userId = request.headers['x-user-id'];
    const role = Array.isArray(request.headers['x-user-role'])
      ? request.headers['x-user-role'][0]
      : request.headers['x-user-role'];

    if (!userId || !role) {
      throw new UnauthorizedException('缺少用户身份信息，请先登录');
    }
    if (!REVIEW_ROLES.includes(role)) {
      throw new ForbiddenException('当前账号没有审核权限');
    }
    request['user'] = { id: userId as string, role: role as string };
    return true;
  }
}
