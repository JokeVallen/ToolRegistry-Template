/**
 * Build a Godot addon archive (.tgz) from a source directory.
 *
 * WHY THIS IS A SCRIPT
 * --------------------
 * `sha256` and `size` in a manifest describe bytes that must not change, and a hand-made archive
 * does not reproduce: `tar -czf` records the current time, the file mtimes and the owner, so the
 * same source directory produces a different digest on every run and in every timezone. The
 * artifacts here are committed, and a rebuild that changed their digest would mean editing the
 * manifest for no reason - or, worse, shipping two different files under one version.
 *
 * So the tar headers are fixed (mode 0644, uid/gid 0, mtime 0) and the entries are sorted. The
 * archive is a pure function of the source tree: rebuild it and the digest is identical.
 *
 * Usage:
 *   node tools/build-godot-addon.mjs <source-dir> <output.tgz>
 *
 * Entries are written relative to <source-dir>, which is what `contentRoot` expects: an addon
 * whose files sit at `addons/node_utils/NodeUtils.gd` is built with contentRoot
 * `addons/node_utils` and the archive carrying `NodeUtils.gd` at its root.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

/** One 512-byte tar header, ustar style. */
function tarHeader(name, size) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write('000644 ', 100, 8, 'ascii'); // mode
  header.write('000000 ', 108, 8, 'ascii'); // uid
  header.write('000000 ', 116, 8, 'ascii'); // gid
  header.write(`${size.toString(8).padStart(11, '0')} `, 124, 12, 'ascii');
  header.write('00000000000 ', 136, 12, 'ascii'); // mtime, fixed for reproducibility
  header.write('        ', 148, 8, 'ascii'); // checksum placeholder
  header.write('0', 156, 1, 'ascii'); // regular file
  header.write('ustar', 257, 5, 'ascii');
  header.write('00', 263, 2, 'ascii');

  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, '0')} `, 148, 8, 'ascii');
  return header;
}

function tarEntry(name, body) {
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([tarHeader(name, body.length), body, padding]);
}

/** Every regular file under `directory`, as paths relative to it, sorted. */
function filesUnder(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const nested of filesUnder(full)) found.push(path.join(entry.name, nested));
    } else if (entry.isFile()) {
      found.push(entry.name);
    }
  }
  return found.sort();
}

function main() {
  const [sourceDirectory, outputPath] = process.argv.slice(2);
  if (!sourceDirectory || !outputPath) {
    console.error('usage: node tools/build-godot-addon.mjs <source-dir> <output.tgz>');
    return 1;
  }
  if (!statSync(sourceDirectory).isDirectory()) {
    console.error(`${sourceDirectory} is not a directory`);
    return 1;
  }

  const names = filesUnder(sourceDirectory);
  if (names.length === 0) {
    console.error(`${sourceDirectory} contains no files`);
    return 1;
  }

  const parts = names.map((name) =>
    tarEntry(name, readFileSync(path.join(sourceDirectory, name))),
  );
  // Two zero blocks end a tar archive; without them some readers stop early.
  const tar = Buffer.concat([...parts, Buffer.alloc(1024)]);
  const gz = gzipSync(tar, { level: 9 });
  writeFileSync(outputPath, gz);

  const digest = createHash('sha256').update(gz).digest('hex');
  console.log(`${outputPath}  size=${gz.length}  sha256=${digest}`);
  for (const name of names) console.log(`  ${name}`);
  return 0;
}

process.exitCode = main();
