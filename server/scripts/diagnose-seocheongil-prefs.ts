import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { getTenantNotificationPolicy, getUserNotificationPreferences } from '../src/modules/notifications/notificationPolicy.service.js';
import { shouldSendPushToUser } from '../src/lib/notificationPolicy.helpers.js';

const SCI = '5816a2cc-9b35-4deb-976f-c3494b266f6f';
const SK = 'a0000000-0000-4000-8000-000000000001';

async function main() {
  const policy = await getTenantNotificationPolicy(SK);
  const pref = await getUserNotificationPreferences(SK, SCI);
  console.log('tenant happy_call policy:', policy.kinds.happy_call);
  console.log('user pref:', pref);
  console.log('shouldSendPush:', shouldSendPushToUser('happy_call', policy, pref));

  const tokens = await prisma.staffAppFcmToken.findMany({
    where: { tenantId: SK, userId: SCI },
    select: { id: true, updatedAt: true, platform: true },
  });
  console.log('FCM tokens:', tokens);
}

main().finally(() => prisma.$disconnect());
