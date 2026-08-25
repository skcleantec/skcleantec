#!/usr/bin/env node
import { PrismaClient } from '../../../server/node_modules/@prisma/client/index.js';

const p = new PrismaClient();

async function main() {
  const probeUserId = 'f5991164-0167-40ce-8707-9dc7ce960acf';
  const u1 = await p.user.findUnique({
    where: { id: probeUserId },
    select: { id: true, email: true, role: true, tenant: { select: { slug: true } } },
  });
  console.log('probe login userId:', u1);

  const allKds = await p.user.findMany({
    where: { email: 'kds' },
    select: { id: true, email: true, role: true, tenant: { select: { slug: true } } },
  });
  console.log('all email=kds:', allKds);

  for (const u of allKds) {
    const tokens = await p.staffAppFcmToken.findMany({
      where: { userId: u.id },
      select: { token: true, updatedAt: true, deviceLabel: true, tenantId: true },
    });
    console.log(`tokens for ${u.tenant.slug}/${u.email} (${u.id}):`, tokens.length, tokens);
  }

  const anyTokens = await p.staffAppFcmToken.findMany({
    where: { userId: probeUserId },
  });
  console.log('tokens for probe userId:', anyTokens.length);
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
