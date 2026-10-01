import { DemoAuthProvider } from "./DemoAuthProvider";
import type { AuthService } from "./types";

/**
 * 当前生效的认证服务单例。
 *
 * 现在是 Demo 实现（本地校验演示账号 + localStorage 会话）；
 * 接入真实后端时，只需将这里替换为 new HttpAuthProvider()，
 * 页面与组件通过 useCurrentUser 使用，无需任何改动。
 */
export const authService: AuthService = new DemoAuthProvider();
