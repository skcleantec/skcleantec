import bcrypt from 'bcryptjs';
import type { PrismaClient, UserRole } from '@prisma/client';
import { PRESERVE_TARGET_USER_EMAILS } from './constants.js';

export class UserMapper {
  private readonly userIdMap = new Map<string, string>();
  private byRole = new Map<UserRole, string[]>();
  private readonly rrIndex = new Map<UserRole, number>();
  private fallbackAdminId: string;

  private constructor(
    readonly targetTenantId: string,
    fallbackAdminId: string,
  ) {
    this.fallbackAdminId = fallbackAdminId;
  }

  static async create(prisma: PrismaClient, targetTenantId: string): Promise<UserMapper> {
    return UserMapper.load(prisma, targetTenantId);
  }

  private static async load(prisma: PrismaClient, targetTenantId: string): Promise<UserMapper> {
    const users = await prisma.user.findMany({
      where: { tenantId: targetTenantId, isActive: true },
      select: { id: true, email: true, role: true },
      orderBy: { createdAt: 'asc' },
    });

    const admin =
      users.find((u) => u.email === 'admin') ??
      users.find((u) => u.role === 'ADMIN') ??
      users[0];
    if (!admin) throw new Error('cbiseo 테넌트에 ADMIN 계정이 없습니다.');

    const mapper = new UserMapper(targetTenantId, admin.id);
    for (const u of users) {
      const list = mapper.byRole.get(u.role) ?? [];
      list.push(u.id);
      mapper.byRole.set(u.role, list);
    }
    return mapper;
  }

  async reload(prisma: PrismaClient): Promise<void> {
    const fresh = await UserMapper.load(prisma, this.targetTenantId);
    this.userIdMap.clear();
    this.rrIndex.clear();
    this.byRole = fresh.byRole;
    this.fallbackAdminId = fresh.fallbackAdminId;
  }

  async ensureDemoAccounts(prisma: PrismaClient, password = '1234'): Promise<void> {
    const hash = await bcrypt.hash(password, 10);
    const rows = [
      { email: 'marketer@skcleanteck.com', role: 'MARKETER' as const, name: '데모마케터' },
      { email: 'team1@skcleanteck.com', role: 'TEAM_LEADER' as const, name: '데모팀장1' },
      { email: 'team2@skcleanteck.com', role: 'TEAM_LEADER' as const, name: '데모팀장2' },
      { email: 'team3@skcleanteck.com', role: 'TEAM_LEADER' as const, name: '데모팀장3' },
      { email: 'cbiseo-team', role: 'TEAM_LEADER' as const, name: '데모팀장' },
      { email: 'guide-external@demo', role: 'EXTERNAL_PARTNER' as const, name: '데모협력담당' },
    ];
    for (const row of rows) {
      await prisma.user.upsert({
        where: { tenantId_email: { tenantId: this.targetTenantId, email: row.email } },
        update: { isActive: true, role: row.role, name: row.name },
        create: {
          tenantId: this.targetTenantId,
          email: row.email,
          passwordHash: hash,
          role: row.role,
          name: row.name,
          isActive: true,
        },
      });
    }
    await this.reload(prisma);
  }

  private pickRole(role: UserRole): string {
    const list = this.byRole.get(role);
    if (!list?.length) {
      if (role === 'ADMIN' || role === 'MARKETER') return this.fallbackAdminId;
      const leaders = this.byRole.get('TEAM_LEADER');
      if (leaders?.length) return leaders[0]!;
      return this.fallbackAdminId;
    }
    const idx = this.rrIndex.get(role) ?? 0;
    const id = list[idx % list.length]!;
    this.rrIndex.set(role, idx + 1);
    return id;
  }

  map(sourceUserId: string, sourceRole: UserRole): string {
    const cached = this.userIdMap.get(sourceUserId);
    if (cached) return cached;
    const targetRole =
      sourceRole === 'EXTERNAL_PARTNER'
        ? 'EXTERNAL_PARTNER'
        : sourceRole === 'MARKETER'
          ? 'MARKETER'
          : sourceRole === 'TEAM_LEADER'
            ? 'TEAM_LEADER'
            : 'ADMIN';
    const id = this.pickRole(targetRole);
    this.userIdMap.set(sourceUserId, id);
    return id;
  }

  mapOptional(sourceUserId: string | null | undefined, sourceRole: UserRole = 'ADMIN'): string | null {
    if (!sourceUserId) return null;
    return this.map(sourceUserId, sourceRole);
  }

  async preloadFromIds(
    prisma: PrismaClient,
    userIds: Iterable<string | null | undefined>,
  ): Promise<void> {
    const ids = [...new Set([...userIds].filter(Boolean))] as string[];
    if (!ids.length) return;
    const rows = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, role: true },
    });
    for (const r of rows) this.map(r.id, r.role);
  }
}

export async function anonymizePreservedUserNames(prisma: PrismaClient, targetTenantId: string): Promise<number> {
  const users = await prisma.user.findMany({
    where: { tenantId: targetTenantId, email: { in: [...PRESERVE_TARGET_USER_EMAILS] } },
    select: { id: true, email: true, name: true },
  });
  let n = 0;
  for (const u of users) {
    const demoName =
      u.email === 'admin'
        ? '데모관리자'
        : u.email === 'cbiseo' || u.email === 'cbiseo-team'
          ? '데모팀장'
          : u.email.startsWith('team')
            ? u.name.includes('데모')
              ? u.name
              : `데모팀장${u.email.charAt(4)}`
            : u.email === 'marketer@skcleanteck.com'
              ? '데모마케터'
              : u.email === 'guide-external@demo'
                ? '데모협력담당'
                : u.name;
    if (u.name !== demoName) {
      await prisma.user.update({
        where: { id: u.id },
        data: { name: demoName, phone: null, staffIdCardUrl: null, staffIdCardPublicId: null },
      });
      n++;
    }
  }
  return n;
}
