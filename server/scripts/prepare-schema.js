import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL || '';
const provider = url.startsWith('postgresql') ? 'postgresql' : 'sqlite';

const templatePath = path.join(__dirname, '../prisma/schema.template.prisma');
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

let content = fs.readFileSync(templatePath, 'utf8');
content = content.replace('__DB_PROVIDER__', provider);
fs.writeFileSync(schemaPath, content);

console.log(`Prisma schema prepared with provider: ${provider}`);
