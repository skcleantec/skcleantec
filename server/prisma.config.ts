import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** package.json#prisma 대체. 시드는 `npm run db:seed`와 동일 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
