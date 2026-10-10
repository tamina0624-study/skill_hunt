const { spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');
const schemaPath = './prisma/schema.prisma';
const prismaCli = require.resolve('prisma/build/index.js');

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

async function main() {
  const rebuildWithoutPrompt = process.env.REBUILD_DATABASE === '1';

  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.CI === 'true'
  ) {
    console.error('Refusing to rebuild the database in a production or CI environment.');
    process.exitCode = 1;
    return;
  }

  if (!rebuildWithoutPrompt && (!stdin.isTTY || !stdout.isTTY)) {
    console.error('Database rebuild requires an interactive terminal.');
    process.exitCode = 1;
    return;
  }

  console.log('Validating the Prisma schema and database configuration...');
  if (runPrisma(['validate', `--schema=${schemaPath}`]) !== 0) {
    process.exitCode = 1;
    return;
  }

  console.warn('\nWARNING: This deletes all existing data in the configured database.');
  console.warn('Check DATABASE_URL in your environment or .env before continuing.');

  if (rebuildWithoutPrompt) {
    console.warn('REBUILD_DATABASE=1 is set; proceeding without interactive confirmation.');
  } else {
    const prompt = readline.createInterface({ input: stdin, output: stdout });
    try {
      const confirmation = await prompt.question(
        'Type REBUILD DATABASE to drop the current schema and recreate its tables: ',
      );

      if (confirmation !== 'REBUILD DATABASE') {
        console.log('Database rebuild cancelled.');
        process.exitCode = 1;
        return;
      }
    } finally {
      prompt.close();
    }
  }

  console.log('\nRebuilding database tables from prisma/schema.prisma...');
  if (runPrisma(['db', 'push', '--force-reset', `--schema=${schemaPath}`]) !== 0) {
    process.exitCode = 1;
    return;
  }

  console.log('\nGenerating Prisma Client...');
  if (runPrisma(['generate', `--schema=${schemaPath}`]) !== 0) {
    process.exitCode = 1;
    return;
  }

  console.log('\nDatabase rebuild completed.');
}

main().catch((error) => {
  console.error('Database rebuild failed:', error);
  process.exitCode = 1;
});
