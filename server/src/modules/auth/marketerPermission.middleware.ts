import type { Request, Response, NextFunction } from 'express';
import type { MarketerPermissionId } from '../../lib/marketerPermissions.js';
import { hasMarketerPermission } from '../../lib/marketerPermissions.js';
import type { AuthPayload } from './auth.middleware.js';
import { resolveMarketerPermissionsForAuth } from '../marketer-permissions/marketerPermissions.service.js';

/** ADMIN 또는 마케터 세부 권한 확인 */
export async function staffHasPermission(
  user: AuthPayload | undefined,
  permissionId: MarketerPermissionId,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  const map = await resolveMarketerPermissionsForAuth(user);
  if (!map) return false;
  return hasMarketerPermission(user.role, map, permissionId);
}

/** ADMIN 또는 permissionIds 중 하나 이상 */
export async function staffHasAnyPermission(
  user: AuthPayload | undefined,
  permissionIds: MarketerPermissionId[],
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MARKETER') return false;
  const map = await resolveMarketerPermissionsForAuth(user);
  if (!map) return false;
  return permissionIds.some((id) => hasMarketerPermission(user.role, map, id));
}

export function requireStaffPermission(...permissionIds: MarketerPermissionId[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const user = (req as Request & { user?: AuthPayload }).user;
        if (!user) {
          res.status(403).json({ error: '권한이 필요합니다.' });
          return;
        }
        const ok = await staffHasAnyPermission(user, permissionIds);
        if (!ok) {
          res.status(403).json({ error: '이 작업을 할 권한이 없습니다.' });
          return;
        }
        next();
      } catch (e) {
        next(e);
      }
    })();
  };
}

/** ADMIN 또는 MARKETER(업무 앱) — 역할만 확인 */
export function staffMarketerRoleOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MARKETER')) {
    res.status(403).json({ error: '권한이 필요합니다.' });
    return;
  }
  next();
}

/** GET/HEAD는 read 권한, 그 외는 write 권한 */
export function requireStaffPermissionByMethod(
  readPermissions: MarketerPermissionId[],
  writePermissions: MarketerPermissionId[],
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    const ids = isRead ? readPermissions : writePermissions;
    return requireStaffPermission(...ids)(req, res, next);
  };
}
