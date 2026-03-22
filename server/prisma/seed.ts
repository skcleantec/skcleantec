import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('1234', 10);

  // 관리자 (항상 생성/업데이트)
  const admin = await prisma.user.upsert({
    where: { email: 'admin' },
    update: { passwordHash: hash },
    create: {
      email: 'admin',
      passwordHash: hash,
      name: '관리자',
      role: 'ADMIN',
    },
  });
  console.log('Admin:', admin.email);

  // 샘플 팀장 (없을 때만 생성)
  const teamLeaders = [
    { email: 'team1@skcleanteck.com', name: '김팀장', phone: '010-1111-2222' },
    { email: 'team2@skcleanteck.com', name: '이팀장', phone: '010-3333-4444' },
  ];
  for (const t of teamLeaders) {
    const created = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        email: t.email,
        passwordHash: hash,
        name: t.name,
        phone: t.phone,
        role: 'TEAM_LEADER',
      },
    });
    console.log('Team leader:', created.email);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
