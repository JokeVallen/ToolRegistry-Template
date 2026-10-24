#!/usr/bin/env node
/**
 * Repository maintenance entry point: validate the registry, or regenerate its index.
 *
 * This exists so a contributor needs exactly one toolchain. The registry previously
 * required Python and a PyYAML install to run its own CI gate, while the importer
 * already needed Node and depended on the `yaml` package - two dependency sources for
 * one job, and the gate could disagree with the backend that actually installs things.
 * There is now one validator, in packages/utool-core, and this is a thin caller of it.
 *
 * Usage
 *     node tools/registry.mjs validate [--quiet] [--no-hash]
 *     node tools/registry.mjs write-index
 *     node tools/registry.mjs check-index      exit non-zero when index.yaml is stale
 *
 * Where the toolchain lives
 *
 * The validator belongs to the import tool (packages/utool-core), not to this
 * repository: one implementation, so a CI gate cannot disagree with the backend that
 * actually installs things. It is therefore found rather than bundled:
 *
 *   1. $UTOOL_CORE, if set - a path to a checkout's packages/utool-core/src/index.js
 *   2. any sibling directory holding packages/utool-core/src/index.js
 *
 * Step 2 searches sibling DIRECTORIES rather than naming one. The checkout's folder name is not
 * part of the contract - a clone may be called anything, and this repository has already been
 * renamed once - so hardcoding a name made a plain `git clone my-registry` fail with a toolchain
 * error that looked like a broken checkout.
 *
 * A missing toolchain is reported as a missing toolchain, because reading it as "the
 * registry is invalid" would be actively misleading.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The registry root is two levels up: <root>/tools/registry.mjs */
const ROOT = path.resolve(here, '..');

const EXIT = { OK: 0, FAILURE: 1, USAGE: 2 };

/** The part of a checkout that has to exist for it to serve as a toolchain. */
const CORE_SUFFIX = path.join('packages', 'utool-core', 'src', 'index.js');

/**
 * Sibling directories, in a stable order, to look for the import tool in.
 *
 * Sorted so the reported candidates and any choice between them are deterministic; the walk is one
 * level deep, because a checkout beside this one is the layout the documentation describes.
 */
function siblingCandidates() {
  const parent = path.dirname(ROOT);
  let entries;
  try {
    entries = readdirSync(parent, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== path.basename(ROOT))
    .map((entry) => path.join(parent, entry.name, CORE_SUFFIX))
    .sort();
}

function locateCore() {
  const explicit = process.env.UTOOL_CORE;
  if (explicit) {
    if (existsSync(explicit)) return explicit;
    // An explicitly named path that is not there is worth saying plainly: silently falling back
    // would run a DIFFERENT toolchain than the one that was asked for.
    process.stderr.write(`UTOOL_CORE is set but does not exist:\n  ${explicit}\n`);
    return null;
  }

  const found = siblingCandidates().find((candidate) => existsSync(candidate));
  if (found) return found;

  const parent = path.dirname(ROOT);
  process.stderr.write(
    'cannot find the utool-core validator.\n' +
      'It lives in the import-tool checkout, beside this repository:\n' +
      `  looked under: ${parent}\n` +
      `  for:          <any directory>/${CORE_SUFFIX}\n` +
      'Clone the import tool next to this repository, or set UTOOL_CORE to its\n' +
      'packages/utool-core/src/index.js.\n',
  );
  return null;
}

const corePath = locateCore();
if (!corePath) process.exit(EXIT.FAILURE);

const coreRoot = path.dirname(corePath);
const toolRoot = path.resolve(coreRoot, '../../..');

const {
  buildIndex,
  createCoreContainerRegistry,
  loadUtool,
  SchemaValidator,
  validateRegistry,
} = await import(pathToFileURL(corePath).href);

/**
 * The schema, loaded once so every validation run enforces it.
 *
 * Without this the schema is a comment: the hand-written checks in the core cover the
 * relationship rules (artifact naming, published versions, dependency resolution) and
 * assume the document already has the right shape, so nothing was checking the shape at
 * all - an unknown top-level field passed cleanly until this was wired up.
 */
const SCHEMA = new SchemaValidator(
  JSON.parse(readFileSync(path.join(ROOT, 'schema', 'tool.schema.json'), 'utf8')),
);
const { writeIndexFile } = await import(
  pathToFileURL(path.join(toolRoot, 'apps/cli/lib/write-index.js')).href
);
const { loadAdapter, knownEngines } = await import(
  pathToFileURL(path.join(toolRoot, 'apps/cli/lib/adapters.js')).href
);

/**
 * A container registry with every engine adapter that ships with the import tool.
 *
 * Without this, a `unitypackage` payload fails as "no handler registered" - which is
 * correct behaviour for the core, and exactly the evidence that unitypackage is not a
 * core concept. But a registry validator must be able to check every payload the
 * registry is allowed to publish, so it loads the adapters the same way the CLI does.
 */
async function containersWithAdapters() {
  const containers = createCoreContainerRegistry();
  for (const engine of knownEngines()) {
    try {
      const adapter = await loadAdapter(engine);
      for (const handler of adapter.containerHandlers ?? []) {
        try {
          containers.register(handler);
        } catch {
          // A duplicate format registration means another adapter already claimed it.
        }
      }
    } catch {
      // An engine whose provider package is not installed simply contributes nothing.
    }
  }
  return containers;
}

function usage() {
  process.stdout.write(
    'registry maintenance\n\n' +
      '  validate [--quiet] [--no-hash]   check every payload, then the index\n' +
      '  write-index                      regenerate index.yaml\n' +
      '  check-index                      fail when index.yaml is out of date\n',
  );
}

/**
 * Validate the whole registry.
 *
 * The index is rebuilt in memory and compared with the committed one, so a payload
 * added without regenerating the catalog is an error rather than a silently stale
 * listing - which is the failure mode that matters most here, because the index is
 * what an importer reads first.
 */
async function validate({ quiet, hash }) {
  const result = await validateRegistry(ROOT, {
    containers: await containersWithAdapters(),
    schema: SCHEMA,
    hash,
    onCheck: quiet ? undefined : (message) => process.stdout.write(`  ok  ${message}\n`),
  });

  for (const warning of result.warnings ?? []) {
    process.stdout.write(`  warn ${warning.code} ${warning.message}\n`);
  }

  if (!result.ok) {
    process.stdout.write(
      `\nFAILED - ${result.errors.length} error(s) out of ${result.checks} check(s):\n`,
    );
    for (const error of result.errors) {
      process.stdout.write(`  [${error.code}] ${error.message}\n`);
    }
    return EXIT.FAILURE;
  }

  process.stdout.write(`\nPASSED - ${result.checks} check(s), 0 errors\n`);
  return EXIT.OK;
}

/** Read the repository field so a regenerated index keeps pointing at the right remote. */
function currentRepository() {
  const indexPath = path.join(ROOT, 'index.yaml');
  if (!existsSync(indexPath)) return null;
  try {
    return loadUtool(indexPath).repository ?? null;
  } catch {
    return null;
  }
}

async function writeIndex() {
  const result = await validateRegistry(ROOT, {
    containers: await containersWithAdapters(),
    schema: SCHEMA,
    hash: true,
    // The index is about to be REPLACED, so checking whether it is current is
    // meaningless here -- and actively harmful: a stale (or missing) index is a
    // validation error, so this command used to refuse to run precisely when it was
    // needed. It told the user to run write-index while refusing to be write-index.
    skipIndexCheck: true,
  });

  if (!result.ok) {
    // Regenerating from a broken registry would bury the problem under a fresh index.
    process.stdout.write(
      `refusing to write index.yaml: the registry has ${result.errors.length} error(s)\n`,
    );
    for (const error of result.errors) {
      process.stdout.write(`  [${error.code}] ${error.message}\n`);
    }
    process.stdout.write(
      '\nThese are problems with the payloads, not with index.yaml. Fix them and re-run.\n',
    );
    return EXIT.FAILURE;
  }

  const indexPath = path.join(ROOT, 'index.yaml');
  await writeIndexFile(indexPath, buildIndex(result.manifests, currentRepository()));
  process.stdout.write(
    `index.yaml regenerated from the payloads (${result.manifests.length} tool(s)).\n`,
  );
  return EXIT.OK;
}

/**
 * Report whether the committed index matches the payloads.
 *
 * Separate from `validate` so CI can name the actual problem: a stale index is a
 * forgetting-to-run-a-command failure, not a malformed payload, and the fix differs.
 */
async function checkIndex() {
  const result = await validateRegistry(ROOT, {
    containers: await containersWithAdapters(),
    schema: SCHEMA,
    hash: false,
  });

  const stale = result.errors.filter(
    (error) => error.code === 'E-INDEX-STALE' || error.code === 'E-INDEX-MISSING',
  );
  if (stale.length > 0) {
    for (const error of stale) process.stdout.write(`  [${error.code}] ${error.message}\n`);
    process.stdout.write("run 'node tools/registry.mjs write-index' and commit index.yaml\n");
    return EXIT.FAILURE;
  }

  // Any other error is reported by `validate`, so it is not repeated here.
  process.stdout.write('index.yaml is current.\n');
  return EXIT.OK;
}

async function main(argv) {
  const [command, ...rest] = argv;
  const flags = new Set(rest.filter((arg) => arg.startsWith('--')));

  switch (command) {
    case 'validate':
      return validate({ quiet: flags.has('--quiet'), hash: !flags.has('--no-hash') });
    case 'write-index':
      return writeIndex();
    case 'check-index':
      return checkIndex();
    default:
      usage();
      return EXIT.USAGE;
  }
}

process.exitCode = await main(process.argv.slice(2));
