import { loadEnvConfig } from '@next/env';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

loadEnvConfig(path.resolve(__dirname, '00.secret'));

export default defineConfig({
  schema: '02.src/prisma/schema.prisma',
});
