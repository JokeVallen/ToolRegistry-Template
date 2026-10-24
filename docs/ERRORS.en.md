# Error code reference

Every code the toolchain can emit, in **one place**. Grouped by how you meet it, not by which module
raises it.

Prefix: `E-` is a failure, `W-` is a warning (blocks nothing).

**Language**: [English](ERRORS.en.md) · [中文](ERRORS.zh-CN.md) · [back to index](../README.md)

---

## Contributing a tool? This is the only section you need

Codes you can see from `node tools/registry.mjs validate`. Left is what you see, right is what to
change.

### The manifest itself

| Code | Meaning | How to fix |
| --- | --- | --- |
| `E-LAYOUT` | the repository root has no `payloads/` | run from the repository root |
| `E-UTOOL-BOM` | the file starts with a UTF-8 BOM | re-save as UTF-8 without BOM. The BOM turns the first key into `\uFEFFkind` |
| `E-MANIFEST-MISSING` | the payload directory has no `tool.yaml` | copy one from `template/` |
| `E-MANIFEST` | `tool.yaml` could not be read — not valid YAML, several documents, or a non-mapping root | check indentation; tabs are not allowed for indentation; one document per file |
| `E-SCHEMA` | schema violation: missing required field, unknown field, wrong value | change what the reported field path points at; malformed capability names are reported here too |

### Identity and structure

| Code | Meaning | How to fix |
| --- | --- | --- |
| `E-ID-FORMAT` | `id` is not lowercase kebab-case | lowercase letters, digits and single hyphens; 3-64 characters |
| `E-ID-DIR` | the directory name differs from `id` | make them identical |
| `E-PAYLOAD-EXTRA` | the payload holds stray files (sources, DLLs, backups) | see [what may live here](#what-may-live-here) |
| `E-TARGETS-MISSING` | `targets` is missing or empty | declare at least one engine |
| `E-TARGET-REQUIREMENTS` | a target lacks `requirements` or `minEngineVersion` | `minEngineVersion` is required: do not guess, do not omit |

### Artifacts

| Code | Meaning | How to fix |
| --- | --- | --- |
| `E-ARTIFACT-TYPE` | `type` is not one of the four, or `file` lacks `unpack: none` | see the [attribute reference](ATTRIBUTES.en.md#artifact-type) |
| `E-ARTIFACT-NAME` | the file name or its directory breaks the convention: it must be `payloads/<id>/artifacts/<id>-<version>[-<engine>].<ext>` | drop the engine segment with one target, require it with several; location and name are checked together |
| `E-ARTIFACT-MISSING` | a target has no `artifact`, or the declared artifact does not exist | exactly one artifact per target, and the file must be on disk |
| `E-ARTIFACT-PATHNAME` | a unitypackage's `pathname` is not relative to the project root | it must start with `Assets/` |
| `E-ARTIFACT-SIZE` | `size` differs from the real byte count | run `utool digest` and refill |
| `E-ARTIFACT-HASH` | `sha256` differs from the real digest | run `utool digest` and refill |
| `E-ARTIFACT-TARGETPATH` | a `file` artifact, or any artifact with `unpack: none`, has no `targetPath` | give it a destination, or drop `unpack: none` so its handler extracts it |
| `E-ARTIFACT-FORMAT` | the bytes do not match the declared `format` | renaming the extension without repacking is the usual cause |
| `E-ARTIFACT-FORMAT-UNSUPPORTED` | no handler is registered for that format | `unitypackage` needs the Unity adapter loaded |
| `E-ARTIFACT-EMPTY` | the archive holds no entries | repack it |
| `E-ARTIFACT-UNSAFE` | an entry escapes the destination root (tar-slip / zip-slip) | repack without absolute paths or `..` |
| `E-ARTIFACT-STRAY` | `artifacts/` holds an undeclared file | delete it, or declare it under `versions` |
| `E-EXTERNAL-INCOMPLETE` | `external` lacks `source` / `url` / `ref` | supply all three, and **no** `path`/`size`/`sha256` |

### Versions and dependencies

| Code | Meaning | How to fix |
| --- | --- | --- |
| `E-VERSIONS-MISSING` | `versions` is missing or empty | publish at least one version |
| `E-LATEST-UNKNOWN` | `latest` names no entry in `versions` | make them match exactly |
| `E-VERSIONS-DUPLICATE` | the same version number appears twice | merge or renumber |
| `E-YANKED-LATEST` | `latest` points at a withdrawn release | move `latest` to a release that is not withdrawn |
| `E-DEP-MISSING` | a dependency names an `id` that does not exist | check the spelling, or land the dependency first |
| `E-DEP-VERSION` | no published version satisfies the constraint | raising a dependency's major without relaxing the constraint is the usual cause |
| `E-DEP-CONSTRAINT` | the constraint expression itself is malformed | see the [attribute reference](ATTRIBUTES.en.md#dependencies) |
| `E-VERSION-NOT-FOUND` | an explicitly pinned version is not published | check the available versions; run `utool show <id>` to list them |
| `E-DEP-SELF` | the tool depends on itself | remove it |
| `E-DEP-CYCLE` | the dependency graph has a cycle | break it; automatic breaking is **forbidden** |
| `E-CAP-FORMAT` | an invalid capability name | at least two dot-separated lowercase segments, e.g. `script.api.argument-guards` |
| `E-CAP-UNSATISFIED` | nothing provides an injected capability | write the provider first, or use `dependencies` |
| `W-CAP-MULTIPLE` | several tools provide one capability | **legal**, informational only: they are alternatives |

### Index

| Code | Meaning | How to fix |
| --- | --- | --- |
| `E-INDEX-MISSING` | `index.yaml` is missing | run `node tools/registry.mjs write-index` |
| `E-INDEX` | `index.yaml` could not be read (not valid YAML, `kind` is not `index`, ...) | it is generated: regenerate rather than hand-edit |
| `E-INDEX-STALE` | the index disagrees with the payloads | run `write-index` and commit it; the local hook catches this earlier |

A missing or unparseable `schema/tool.schema.json` has no code of its own: it surfaces as a raw read
error. That is a broken checkout, not a mistake in your manifest.

## What may live here

Under `payloads/<id>/`, **only**:

```text
payloads/<id>/
├─ tool.yaml            required
├─ artifacts/           required (may be absent for an external type)
│  └─ <id>-<version>[-<engine>].<ext>
└─ README.md            optional, only to say where an external source lives
```

Sources, DLLs, archives and backup files are not allowed — they would defeat the rule that only
sealed artifacts are imported. Every file referenced by `artifacts/` must be declared under
`versions`, and `artifacts/` must hold nothing undeclared.

## Codes you meet only when implementing an importer

Grouped by stage. These never appear during `utool validate`.

### Loading documents

| Code | Meaning |
| --- | --- |
| `E-UTOOL-READ` | the file cannot be read |
| `E-UTOOL-YAML` | not valid YAML, or it holds several documents |
| `E-UTOOL-EMPTY` | the document is empty |
| `E-UTOOL-ROOT` | the root node is not a mapping |
| `E-UTOOL-KIND-MISSING` | no `kind` discriminator |
| `E-UTOOL-KIND-UNKNOWN` | `kind` is unrecognised; a reader **must** reject rather than guess |
| `E-UTOOL-KIND-MISMATCH` | `kind` is not what was expected (an `index` where a `tool` was due) |
| `E-UTOOL-VERSION-MISSING` | no `formatVersion` |
| `E-UTOOL-VERSION-UNSUPPORTED` | `formatVersion` is not one this implementation supports |
| `E-ID-MISMATCH` | the requested id differs from the one the document declares |
| `E-MANIFEST` | the manifest could not be read and no more specific code applies |

### Resolution

| Code | Meaning |
| --- | --- |
| `E-DEP-FETCH` | a dependency's manifest could not be fetched |
| `E-CAP-CONFLICT` | **within one install plan** several tools provide one capability; the consumer cannot tell which it got |
| `E-CAP-PROVIDER` | the selected provider's manifest could not be loaded |
| `E-CAP-PROVIDER-ENGINE` | the only provider does not support the requested engine |
| `E-CAP-PROVIDER-DEP` | the provider's own dependencies are not in the plan, so it is refused rather than added halfway |
| `E-PLATFORM` | the host is below a declared floor; the error names the requirement and the tool that imposed it |
| `E-PLATFORM-PARSE` | a floor cannot be compared (malformed value) |

An engine adapter returns **`undefined`** for a requirement key it does not understand, never
`false`. The core reads `undefined` as "this adapter cannot judge that", so it **reports** the floor
without enforcing it. Returning `false` would block installs the moment someone adds a requirement
key, which is exactly the coupling the adapter split exists to prevent.

### Artifacts and containers

| Code | Meaning |
| --- | --- |
| `E-ARTIFACT` | artifact handling failed and no more specific code applies |
| `E-ARTIFACT-GZIP` | not readable gzip data |
| `E-ARTIFACT-ZSTD` | not a readable zstd frame |
| `E-ARTIFACT-CODEC` | this Node build lacks the codec (zstd needs Node 22 or newer) |
| `E-ARTIFACT-ZIP` | the zip central directory is malformed |
| `E-ARTIFACT-ZIP-METHOD` | the zip uses an unsupported compression method (only stored and deflate) |
| `E-ARTIFACT-TAR` | a tar header is malformed |
| `E-HANDLER-CONTRACT` | a container handler broke its contract, returning an item with neither bytes nor a way to read them |
| `E-INSTALL-INTO` | the destination passed to `--into` is not a usable project-relative directory (empty, absolute, a drive letter, or containing `..`) |
| `E-INSTALL-ROOT` | a planned path is not inside the directory the tool installs into, so it cannot be moved as a unit; nothing is written |

### Sources and network

| Code | Meaning |
| --- | --- |
| `E-SOURCE-GIT` | a git remote was passed; this backend does not shell out to git, so clone it and pass the directory |
| `E-NETWORK` | the registry location is unreachable. With mirrors configured, only this code triggers a switch |
| `E-HTTP` | a non-2xx response |
| `E-NOT-FOUND` | the requested file is not in the registry. This does **not** trigger a mirror switch: the registry answered |
| `E-NO-FETCH` | no fetch implementation is available in this runtime |
| `E-MIRROR-LOCAL` | a mirror was given for a local directory registry, which does not take mirrors |

### Receipts

| Code | Meaning |
| --- | --- |
| `E-RECEIPT-INVALID` | a receipt is unreadable and must be repaired or removed |
| `E-RECEIPT-MISSING` | no receipt for that tool, so there is no rollback target |

### The toolchain itself

| Code | Meaning |
| --- | --- |
| `E-UNINSTALL-FILE` | a file could not be removed during uninstall (typically held by the editor or version control) |
| `E-DEP-REQUIRED` | another installed tool still depends on this one; the uninstall is refused unless `--force` |
| `E-DIGEST-READ` | `utool digest` could not read the given file |
| `E-UNEXPECTED` | an unanticipated internal error; this is a defect, please report it |
| `E-UNKNOWN` | a failure that fits no other category |
