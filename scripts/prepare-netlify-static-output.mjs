import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('dist/client/admin.html');
const destination = resolve('dist/client/admin/index.html');

if (!existsSync(source)) {
  throw new Error(`Missing static admin export: ${source}`);
}

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log('Prepared static Netlify route: dist/client/admin/index.html');
