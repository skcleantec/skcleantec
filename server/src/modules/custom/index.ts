import type { Express } from 'express';
// import acmeRoutes from './acme/routes.js';

/**
 * L3 커스텀 API — `/api/custom/*`
 * slug별 router를 여기에 등록
 */
export function mountCustomModuleRoutes(app: Express): void {
  // app.use('/api/custom/acme', acmeRoutes);
  void app;
}
