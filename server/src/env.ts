import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** `cwd`가 저장소 루트여도 항상 `server/.env`를 읽도록 경로 고정 */
dotenv.config({ path: path.resolve(__dirname, '../.env') });
