/**
 * A deliberately small YAML reader for manifest files.
 *
 * Why this exists: the standalone HTML validator must be one file with no dependencies and
 * no build step, and the `yaml` package cannot be embedded that way - it is forty-odd
 * modules whose top-level names collide when flattened (visit, schema, int and fifteen
 * others are declared in more than one file). Two attempts at flattening produced a page
 * that built successfully and then threw at load.
 *
 * So the page carries its own reader, supporting exactly the constructs a ToolRegistry
 * manifest is allowed to use. That constraint is the point rather than a limitation: the
 * format is deliberately narrow, and a reader that accepts more than the format allows
 * would be the wrong tool for validating it.
 *
 * Supported
 *   * block mappings and block sequences, nested by indentation
 *   * flow mappings and flow sequences: { a: 1, b: [x, y] }
 *   * plain scalars, single- and double-quoted scalars
 *   * block scalars: | literal and > folded, with - / + chomping
 *   * comments, blank lines, and a mandatory single document
 *
 * Refused, by name, because silently misreading them would be worse:
 *   * anchors and aliases (&a / *a)
 *   * tags (!!str, !Custom)
 *   * multiple documents (---)
 *   * explicit keys (? key)
 *   * multi-line flow collections
 *
 * Not a general YAML implementation, and does not pretend to be one.
 */

/**
 * @param {string} text
 * @returns {{doc: any}|{error: {code: string, message: string}[]}}
 */
export function parseYaml(text) {
  const source = text.replace(/^\uFEFF/, '');

  if (source.trim() === '') {
    return { error: [{ code: 'E-UTOOL-EMPTY', message: 'the document is empty' }] };
  }

  const lines = source.split(/\r\n|\r|\n/);

  // `---` either opens the single document (legal, when it is the first thing) or SEPARATES
  // two documents (illegal here). Counting markers alone missed the second case, because
  // `a: 1\n---\nb: 2` has exactly one marker and yet is plainly two documents.
  const markerLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    // Only a marker that is not indented starts a document.
    if (/^---\s*(#.*)?$/.test(lines[i])) markerLines.push(i);
    if (/^\.\.\.\s*(#.*)?$/.test(lines[i])) markerLines.push(i);
  }
  const opensDocument = markerLines.length > 0 && /^\s*$/.test(lines.slice(0, markerLines[0]).join(''));
  const separated = opensDocument ? markerLines.length - 1 : markerLines.length;

  if (separated > 0) {
    return {
      error: [{
        code: 'E-UTOOL-YAML',
        message: 'expected exactly one YAML document, found 2 or more',
      }],
    };
  }

  const tokens = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];

    if (/^---\s*(#.*)?$/.test(raw) || /^\.\.\.\s*(#.*)?$/.test(raw)) continue;

    const withoutComment = stripComment(raw);
    if (withoutComment.trim() === '') continue;

    // Checked on the raw leading whitespace: after trimming, a leading tab is
    // indistinguishable from indentation and tab-indented input would be accepted.
    const leading = withoutComment.match(/^[ \t]*/)[0];
    if (leading.includes('\t')) {
      return { error: [problem(index, 'tabs may not be used for indentation')] };
    }
    const indent = leading.length;

    const text = withoutComment.trim();

    // A block scalar's body is NOT tokenised. It is raw text whose blank lines are content
    // and whose indentation is relative to the parent, so it must be read from the source
    // rather than filtered into the token stream - doing the latter produced
    // "unexpected indentation" on every manifest with a folded description.
    //
    // The indicator appears as a VALUE (`description: >-`) or as a whole sequence item
    // (`- >-`), so both forms are recognised here rather than in the parser.
    if (isBlockScalarValue(text)) {
      const body = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const bodyLine = lines[cursor];
        if (bodyLine.trim() === '') {
          body.push('');
          cursor += 1;
          continue;
        }
        const bodyIndent = bodyLine.length - bodyLine.trimStart().length;
        if (bodyIndent <= indent) break;
        body.push(bodyLine.slice(Math.min(bodyIndent, indent + 2)));
        cursor += 1;
      }
      // Trailing blank lines belong to the chomping decision, not to the content.
      while (body.length > 0 && body[body.length - 1] === '') body.pop();

      tokens.push({
        line: index,
        indent,
        text,
        block: { indicator: blockIndicatorOf(text), chomp: chompOf(text), body },
      });
      index = cursor - 1;
      continue;
    }

    tokens.push({ line: index, indent, text, raw: withoutComment });
  }

  if (tokens.length === 0) {
    return { error: [{ code: 'E-UTOOL-EMPTY', message: 'the document is empty' }] };
  }

  const unsupported = findUnsupported(source);
  if (unsupported) return { error: [unsupported] };

  const state = { tokens, at: 0, lines };
  try {
    const doc = parseBlock(state, tokens[0].indent);
    if (state.at < tokens.length) {
      const token = tokens[state.at];
      return {
        error: [problem(token.line, `unexpected content at indentation ${token.indent}`)],
      };
    }
    if (doc === undefined) {
      return { error: [{ code: 'E-UTOOL-EMPTY', message: 'the document is empty' }] };
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
      return {
        error: [{
          code: 'E-UTOOL-ROOT',
          message: 'the document root must be a mapping',
        }],
      };
    }
    return { doc };
  } catch (cause) {
    return { error: [{ code: 'E-UTOOL-YAML', message: cause.message }] };
  }
}

// ------------------------------------------------------------------ scanning

/** Remove a trailing comment, respecting quotes. */
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    // A `#` starts a comment only at the start of the line or after whitespace.
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

/** Refuse constructs this reader does not implement, rather than misreading them. */
function findUnsupported(source) {
  // Patterns must not require a preceding newline: the construct can be on the first line,
  // and testing against "\n" + source missed exactly that case.
  const checks = [
    [/&\w+/, 'anchors (&name) are not supported'],
    [/\*\w+/, 'aliases (*name) are not supported'],
    [/(^|[:\s])!\S/m, 'tags (!tag) are not supported'],
    [/^\s*\?\s/m, 'explicit keys (? key) are not supported'],
  ];
  for (const [pattern, message] of checks) {
    if (pattern.test(source)) {
      return { code: 'E-UTOOL-YAML', message };
    }
  }
  return null;
}


function problem(line, message) {
  return { code: 'E-UTOOL-YAML', message: `line ${line + 1}: ${message}` };
}

// ------------------------------------------------------------------ parsing

/** Parse everything at one indentation level: a mapping or a sequence. */
function parseBlock(state, indent) {
  const first = state.tokens[state.at];
  if (!first || first.indent < indent) return undefined;

  return first.text.startsWith('- ') || first.text === '-'
    ? parseSequence(state, indent)
    : parseMapping(state, indent);
}

/**
 * Continue a plain scalar across the following, more-indented lines.
 *
 * YAML folds them into spaces. This is legal and the generated index.yaml relies on it for
 * long descriptions, so without it a wrapped description reads as unexpected indentation.
 */
function continuePlainScalar(state, value, parentIndent) {
  let out = value;
  while (state.at < state.tokens.length) {
    const next = state.tokens[state.at];
    if (next.indent <= parentIndent || next.block) break;
    if (splitKey(next.text)) break;
    if (next.text.startsWith('- ') || next.text === '-') break;
    out += ` ${next.text}`;
    state.at += 1;
  }
  return out;
}

function parseMapping(state, indent) {
  const out = {};
  while (state.at < state.tokens.length) {
    const token = state.tokens[state.at];
    if (token.indent < indent) break;
    if (token.indent > indent) {
      throw new Error(`line ${token.line + 1}: unexpected indentation`);
    }
    if (token.text.startsWith('- ') || token.text === '-') {
      throw new Error(`line ${token.line + 1}: a sequence item where a mapping key was expected`);
    }

    const split = splitKey(token.text);
    if (!split) {
      throw new Error(`line ${token.line + 1}: expected 'key: value'`);
    }
    const { key, rest } = split;
    state.at += 1;

    // A block scalar carries its own indicator in this token (`description: >-`), so the
    // body has to be taken from the token we are already holding rather than from the next
    // one - which is why this precedes the `rest !== ''` case below.
    if (token.block) {
      out[key] = readBlockScalar(token);
      continue;
    }

    if (rest !== '') {
      // A plain scalar may continue on following lines that are indented further. YAML
      // folds those into spaces, which is legal and which the generated index.yaml uses for
      // long descriptions:
      //     description: first part
      //       second part
      // Without this the continuation lines look like unexpected indentation.
      let value = rest;
      while (state.at < state.tokens.length) {
        const continuation = state.tokens[state.at];
        if (continuation.indent <= indent || continuation.block) break;
        if (splitKey(continuation.text)) break;
        value += ` ${continuation.text}`;
        state.at += 1;
      }
      out[key] = parseScalarOrFlow(value, token.line);
      continue;
    }

    // No value on this line. What follows is either a nested block, a block scalar, or a
    // sibling key - and a SEQUENCE may sit at the key's own indentation, which is legal
    // YAML and what the generated index.yaml uses:
    //     tools:
    //     - id: first
    const next = state.tokens[state.at];
    if (next && next.indent > indent) {
      // A DEEPER line is a nested block, and it carries its own key - `b: |` is a mapping
      // entry for `b`, not this key's scalar. This used to test `next.block` FIRST and hand
      // the folded text to the OUTER key, so
      //     a:
      //       b: >-
      //         text
      // parsed as { a: "text" }: `b` disappeared. Nothing caught it until a manifest ended
      // with a block scalar, because that is when the misread value is visible.
      out[key] = parseBlock(state, next.indent);
    } else if (next && next.block) {
      // Only reachable for a block scalar that belongs to THIS key without a key of its own,
      // which the tokeniser produces for `- |` items; parseSequence handles those.
      out[key] = readBlockScalar(next);
      state.at += 1;
    } else if (next && next.indent === indent && (next.text.startsWith('- ') || next.text === '-')) {
      out[key] = parseSequence(state, indent);
    } else {
      out[key] = null;
    }
  }
  return out;
}

/**
 * Materialise a block scalar token.
 *
 * `|` keeps newlines; `>` folds a single newline into a space and keeps blank lines as
 * newlines. Chomping: `-` strips the trailing newline, default clips to exactly one, `+`
 * keeps them all.
 */
function readBlockScalar(token) {
  const { indicator, chomp, body } = token.block;
  let value = indicator === '|' ? body.join('\n') : foldLines(body);

  if (chomp === '-') return value.replace(/\n+$/, '');
  if (chomp === '+') return `${value}\n`;
  return `${value.replace(/\n+$/, '')}\n`;
}

/**
 * Is this line's value a block scalar indicator?
 *
 * Matches both `description: >-` and a bare `>-` as a sequence item, and nothing else - a
 * value like `a: |x` is not an indicator and must fall through to the scalar parser.
 */
function isBlockScalarValue(text) {
  return /:\s*[|>][+-]?\d*$/.test(text) || /^[|>][+-]?\d*$/.test(text);
}

/** The `|` or `>` that opens the scalar. */
function blockIndicatorOf(text) {
  return text.match(/[|>]/)[0];
}

function chompOf(text) {
  if (text.includes('-')) return '-';
  if (text.includes('+')) return '+';
  return 'clip';
}

/**
 * Fold a block scalar's lines the way `>` does: a single newline becomes a space, and a
 * blank line becomes a newline.
 */
function foldLines(lines) {
  let out = '';
  for (const line of lines) {
    if (line.trim() === '') {
      out += '\n';
      continue;
    }
    out += (out !== '' && !out.endsWith('\n') ? ' ' : '') + line;
  }
  return out;
}

function parseSequence(state, indent) {
  const out = [];
  while (state.at < state.tokens.length) {
    const token = state.tokens[state.at];
    if (token.indent < indent) break;
    if (token.indent > indent) {
      throw new Error(`line ${token.line + 1}: unexpected indentation`);
    }
    if (!(token.text.startsWith('- ') || token.text === '-')) break;

    state.at += 1;
    const rest = token.text === '-' ? '' : token.text.slice(2).trim();
    const itemIndent = indent + 2;

    if (rest === '') {
      const next = state.tokens[state.at];
      if (next && next.block) {
        out.push(readBlockScalar(next));
        state.at += 1;
      } else {
        out.push(next && next.indent > indent ? parseBlock(state, next.indent) : null);
      }
      continue;
    }

    // `- key: value` starts a mapping whose keys line up under the dash.
    if (splitKey(rest)) {
      const inline = parseInlineMapping(state, rest, itemIndent, token.line);
      out.push(inline);
      continue;
    }

    out.push(parseScalarOrFlow(rest, token.line));
  }
  return out;
}

/**
 * A sequence item that begins a mapping: `- id: x` followed by `  version: y`.
 *
 * The first pair is on the dash line; the rest are at the item's indentation, which is the
 * dash column plus two.
 */
function parseInlineMapping(state, firstPair, itemIndent, line) {
  const { key, rest } = splitKey(firstPair);
  const out = {};

  // The dash line's own token carries a block-scalar body when the item opens one
  // (`- notes: >-`). Consulting `rest` alone reads the indicator as the value.
  const firstToken = state.tokens[state.at - 1];
  if (firstToken?.block) {
    out[key] = readBlockScalar(firstToken);
  } else if (rest !== '') {
    out[key] = parseScalarOrFlow(continuePlainScalar(state, rest, itemIndent), line);
  } else {
    const next = state.tokens[state.at];
    if (next && next.block) {
      out[key] = readBlockScalar(next);
      state.at += 1;
    } else {
      out[key] = next && next.indent > itemIndent ? parseBlock(state, next.indent) : null;
    }
  }

  // Continue with any further keys at the item's indentation.
  while (state.at < state.tokens.length) {
    const token = state.tokens[state.at];
    if (token.indent !== itemIndent) break;
    if (token.text.startsWith('- ') || token.text === '-') break;

    const split = splitKey(token.text);
    if (!split) break;
    state.at += 1;

    // Same rule as in parseBlock: a `key: >-` line is a block scalar, and the token
    // already holds the folded body. Checking `rest` first made the indicator itself the
    // value, so a sequence item's last key read as the literal string ">-".
    if (token.block) {
      out[split.key] = readBlockScalar(token);
      continue;
    }

    if (split.rest !== '') {
      out[split.key] = parseScalarOrFlow(
        continuePlainScalar(state, split.rest, itemIndent), token.line,
      );
      continue;
    }
    const next = state.tokens[state.at];
    if (next && next.block) {
      out[split.key] = readBlockScalar(next);
      state.at += 1;
    } else if (next && next.indent > itemIndent) {
      out[split.key] = parseBlock(state, next.indent);
    } else if (next && next.indent === itemIndent && (next.text.startsWith('- ') || next.text === '-')) {
      out[split.key] = parseSequence(state, itemIndent);
    } else {
      out[split.key] = null;
    }
  }

  return out;
}

/** Split `key: value`, honouring quoted keys. Returns null when there is no key. */
function splitKey(text) {
  if (text.startsWith('"') || text.startsWith("'")) {
    const quote = text[0];
    let i = 1;
    while (i < text.length) {
      if (quote === '"' && text[i] === '\\') i += 2;
      else if (text[i] === quote) break;
      else i += 1;
    }
    if (i >= text.length) return null;
    const key = parseQuoted(text.slice(0, i + 1), 0);
    const after = text.slice(i + 1).trimStart();
    if (!after.startsWith(':')) return null;
    const rest = after.slice(1).trim();
    return { key: String(key), rest };
  }

  // A plain key ends at the first `: ` or a trailing `:`.
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== ':') continue;
    const after = text.slice(i + 1);
    if (after === '' || /^\s/.test(after)) {
      return { key: text.slice(0, i).trim(), rest: after.trim() };
    }
  }
  return null;
}

// ------------------------------------------------------------------ scalars

/** A scalar, or a flow collection when the value starts with `{` or `[`. */
function parseScalarOrFlow(text, line) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const [value, consumed] = parseFlow(trimmed, 0);
    if (trimmed.slice(consumed).trim() !== '') {
      throw new Error(`line ${line + 1}: unexpected text after a flow collection`);
    }
    return value;
  }
  return parseScalar(trimmed, line);
}

function parseScalar(text, line) {
  if (text.startsWith('"') || text.startsWith("'")) {
    if (!isClosedQuote(text)) throw new Error(`line ${line + 1}: unterminated quoted scalar`);
    return parseQuoted(text, line);
  }
  return resolvePlain(text);
}

function isClosedQuote(text) {
  const quote = text[0];
  let i = 1;
  while (i < text.length) {
    if (quote === '"' && text[i] === '\\') i += 2;
    else if (text[i] === quote) return i === text.length - 1;
    else i += 1;
  }
  return false;
}

function parseQuoted(text, line) {
  const quote = text[0];
  if (!isClosedQuote(text)) throw new Error(`line ${line + 1}: unterminated quoted scalar`);
  const body = text.slice(1, -1);
  if (quote === "'") return body.replace(/''/g, "'");

  return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (whole, escape) => {
    const simple = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '0': '\0', b: '\b', f: '\f' };
    if (escape[0] === 'u' || escape[0] === 'x') {
      return String.fromCodePoint(Number.parseInt(escape.slice(1), 16));
    }
    return simple[escape] ?? escape;
  });
}

/** Plain scalars: null, boolean, number, or string. */
function resolvePlain(text) {
  if (text === '' || text === '~' || text === 'null' || text === 'Null' || text === 'NULL') {
    return null;
  }
  if (/^(true|True|TRUE)$/.test(text)) return true;
  if (/^(false|False|FALSE)$/.test(text)) return false;
  if (/^[-+]?\d+$/.test(text)) return Number.parseInt(text, 10);
  if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(text)) return Number.parseFloat(text);
  return text;
}

/** Flow collections, which may nest. Returns [value, charactersConsumed]. */
function parseFlow(text, start) {
  let i = skipSpace(text, start);
  const open = text[i];

  if (open === '[') {
    const out = [];
    i += 1;
    for (;;) {
      i = skipSpace(text, i);
      if (text[i] === ']') return [out, i + 1];
      const [value, next] = parseFlowValue(text, i);
      out.push(value);
      i = skipSpace(text, next);
      if (text[i] === ',') i += 1;
      else if (text[i] === ']') return [out, i + 1];
      else throw new Error(`unexpected '${text[i] ?? 'end of line'}' in a flow sequence`);
    }
  }

  if (open === '{') {
    const out = {};
    i += 1;
    for (;;) {
      i = skipSpace(text, i);
      if (text[i] === '}') return [out, i + 1];
      const [key, afterKey] = parseFlowValue(text, i, true);
      i = skipSpace(text, afterKey);
      if (text[i] !== ':') throw new Error(`expected ':' in a flow mapping`);
      i += 1;
      const [value, afterValue] = parseFlowValue(text, i);
      out[String(key)] = value;
      i = skipSpace(text, afterValue);
      if (text[i] === ',') i += 1;
      else if (text[i] === '}') return [out, i + 1];
      else throw new Error(`unexpected '${text[i] ?? 'end of line'}' in a flow mapping`);
    }
  }

  throw new Error(`expected a flow collection`);
}

function parseFlowValue(text, start, asKey = false) {
  const i = skipSpace(text, start);
  if (text[i] === '[' || text[i] === '{') return parseFlow(text, i);

  if (text[i] === '"' || text[i] === "'") {
    const quote = text[i];
    let j = i + 1;
    while (j < text.length) {
      if (quote === '"' && text[j] === '\\') j += 2;
      else if (text[j] === quote) break;
      else j += 1;
    }
    if (j >= text.length) throw new Error('unterminated quoted scalar');
    return [parseQuoted(text.slice(i, j + 1), 0), j + 1];
  }

  // A plain flow scalar ends at a terminator.
  let j = i;
  while (j < text.length && !',]}'.includes(text[j])) {
    if (text[j] === ':' && (asKey || /\s/.test(text[j + 1] ?? ''))) break;
    j += 1;
  }
  const raw = text.slice(i, j).trim();
  return [resolvePlain(raw), j];
}

function skipSpace(text, i) {
  while (i < text.length && /\s/.test(text[i])) i += 1;
  return i;
}
