import type { PrismaClient } from '@prisma/client';
import type { Anonymizer } from './anonymize.js';
import type { IdMap } from './idMap.js';
import type { UserMapper } from './userMapping.js';

export type CloneContext = {
  prisma: PrismaClient;
  dryRun: boolean;
  sourceTenantId: string;
  targetTenantId: string;
  sourceOcIds: string[];
  targetDefaultOcId: string;
  fromDate: Date;
  ids: IdMap;
  anonymizer: Anonymizer;
  users: UserMapper;
  log: (msg: string) => void;
};

export type CloneStats = Record<string, number>;
