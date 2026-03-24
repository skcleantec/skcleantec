/**
 * 로컬에서 admin 계정 존재 여부·DB 연결 확인
 * 실행: cd server && npm run db:check-admin
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function maskUrl(u: string) {
  return u.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
}

async function main() {
  const raw = process.env.DATABASE_URL || '';
  console.log('DATABASE_URL:', raw ? maskUrl(raw) : '(server/.env에 없음)');

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('DB 연결: 성공');

    const admin = await prisma.user.findUnique({
      where: { email: 'admin' },
      select: { email: true, role: true, isActive: true },
    });

    if (!admin) {
      console.log('\nadmin 계정: 없음');
      console.log('→ 프로젝트 루트에서 PostgreSQL 실행 후: npm run db:setup');
      console.log('   (또는 DB만 준비된 상태면: npm run db:seed)\n');
      process.exitCode = 1;
      return;
    }

    console.log('admin 계정: 있음', { role: admin.role, isActive: admin.isActive });

    if (!admin.isActive) {
      console.log('\n※ isActive가 false라 로그인할 수 없습니다. npm run db:seed 로 비밀번호·활성 상태를 다시 맞추세요.\n');
      process.exitCode = 1;
      return;
    }

    if (admin.role !== 'ADMIN') {
      console.log('\n※ role이 ADMIN이 아닙니다. DB를 확인하세요.\n');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('\nDB 연결 실패:', e instanceof Error ? e.message : e);
    console.error('→ Docker Desktop 실행 후: npm run db:up');
    console.error('→ 그다음: npm run db:setup\n');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
