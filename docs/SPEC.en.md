# ToolRegistry Format Specification

**Language**: [English](SPEC.en.md) · [中文](SPEC.zh-CN.md) · [back to index](../README.md)

Status: **v3 (`formatVersion` is `'3'`)**. The normative keywords **MUST**, **MUST NOT**,
**SHOULD** and **MAY** are used with the meanings given in RFC 2119.

This document is normative. For an overview see [`../README.en.md`](../README.en.md),
for the Chinese version see [`SPEC.zh-CN.md`](SPEC.zh-CN.md).

---

## 1. Who this specification is for

There are three kinds of reader, and each has its own document:

| What you want to do | Read |
| --- | --- |
| Contribute or change a tool | [`CONTRIBUTING.en.md`](CONTRIBUTING.en.md), [`ATTRIBUTES.en.md`](ATTRIBUTES.en.md) |
| Implement an import tool | [`FRONTEND-INTEGRATION.en.md`](FRONTEND-INTEGRATION.en.md) |
| Change the format itself | this file |

This document covers **what valid data looks like**, not why it looks that way: the rationale is a
maintainer's concern, not a consumer's.

This document is **normative**: it defines what valid data looks like, states constraints with `MUST` / `MUST NOT`, and gives every constraint a rule number so reviews and error messages can cite it.

## 2. Repository layout

```text
<repo-root>/
├─ index.yaml
├─ package.json
├─ schema/tool.schema.json
├─ template/*.yaml
├─ payloads/<id>/tool.yaml
├─ payloads/<id>/artifacts/<id>-<version>[-<engine>].<ext>
└─ tools/
```

- **R-LAYOUT-1** Every payload **MUST** live in `payloads/<id>/`.
- **R-LAYOUT-2** `<id>` **MUST** equal the `id` in the metadata.
- **R-LAYOUT-3** A payload directory **MUST** contain `tool.yaml`, and **MUST NOT** contain
  anything other than `tool.yaml`, an optional `README.md`, and `artifacts/`.
  **Source files MUST NOT be committed into a payload.**
- **R-LAYOUT-4** `artifacts/` **MUST** contain exactly one published artifact per target, and its
  file name **MUST** be:
  - `<id>-<version>.<ext>` when the tool has **one** target;
  - `<id>-<version>-<engine>.<ext>` when the tool has **several** targets.

  The extension follows the format (§6.1): `zip` → `.zip`, `tgz` / `tar.gz` → `.tgz`,
  `tar.zst` → `.tar.zst`; a `file` artifact keeps its own format as the extension (`dll` → `.dll`).
  The engine segment depends only on the **number** of targets, so turning a single-engine tool into
  a two-engine tool changes the file name — that is a version bump, not a rename in place.
- **R-LAYOUT-5** `index.yaml` **MUST** be consistent with the payloads; regenerate it with
  `node tools/registry.mjs write-index`.

---

## 3. Identifier rules

- **R-ID-1** `id` **MUST** match `^[a-z0-9]+(-[a-z0-9]+)*$`, length 3–64.
- **R-ID-2** `id` **MUST** be unique across the whole registry, and comparison is case-insensitive.
  All-lowercase makes "case-insensitive" equivalent to "exact comparison" — which matters, because
  Windows and macOS file systems are case-insensitive by default.
- **R-ID-3** `id` is the primary key: it names the directory, dependency references, the artifact
  file name stem, `index.yaml` entries, and import receipts.

### 3.1 Naming conventions

| Field | Style | Example |
| --- | --- | --- |
| `id` | lowercase kebab-case, may carry a category prefix | `editor-tool-selection-history` |
| `displayName` | human-readable title, any language | `Selection History` |
| `tags` | lowercase kebab-case | `asset-pipeline` |

The category prefixes (`editor-tool-`, `core-`, `libs-`, `framework-`) are **SHOULD**, not **MUST**:
they make the flat `payloads/` listing easier to read without introducing the nesting that would
break "id == directory name".

### 3.2 Engine names

- **R-ID-4** The keys of `targets` **MUST** match `^[a-z0-9]+(-[a-z0-9]+)*$`, length 2–32
  (`unity`, `godot`, `unreal`, `defold`).
- **R-ID-5** The core **MUST NOT** enumerate engine names. An engine name acquires meaning in exactly
  two places: that engine's adapter, and being a key of `targets`. An engine without an adapter
  **MAY** appear in the data, but cannot be planned for installation.

---

## 4. Versions

- **R-VER-1** `version` **MUST** have the form `major.minor.patch`, optionally followed by a
  pre-release suffix (`1.0.0`, `2.3.1`, `1.0.0-rc.1`). This is semver-lite: build metadata
  (`+build`) is not used.
- **R-VER-2** Comparison uses only the numeric triple; the pre-release suffix is ignored in ordering.
  A pre-release therefore serves only as a **label**, not as a precedence.
- **R-VER-3** Published bytes are immutable. Any change to an artifact — even a comment-only change —
  **MUST** be published with a new `version` and a new file. **MUST NOT** rewrite an artifact that
  has already been pushed.
- **R-VER-4** One manifest describes **every** published version of the tool, one entry per
  version under `versions[]`; `latest` **MUST** name one of them (see R-VER-6). A reader that
  does not understand that shape **MUST** reject it rather than guess.
- **R-VER-5** The same `version` **MUST NOT** appear twice in one manifest.
- **R-VER-6** `latest` **MUST** match a `version` in `versions` exactly, and that entry
  **MUST NOT** be `yanked`: the default may not point at a release that does not exist or has
  been withdrawn.

### 4.1 Dependency constraints

`dependencies[].version` is a constraint:

| Form | Meaning |
| --- | --- |
| `^1.2.3` | `>= 1.2.3`, same major version |
| `~1.2.3` | `>= 1.2.3`, same major and minor version |
| `>=1.0.0`, `>`, `<=`, `<` | one-sided bound |
| `1.4.2` | exactly that version |
| omitted | any version provided by this registry |

- **R-DEP-1** A dependency **MUST** reference an `id` and **MUST NOT** reference a path or a URL.
- **R-DEP-2** A tool **MUST NOT** depend on itself.
- **R-DEP-3** Every referenced `id` **MUST** exist in this registry.
- **R-DEP-4** Cycles among required dependencies **MUST NOT** exist.
- **R-DEP-5** `optional: true` means: use it when the user has already selected it, never pull it in
  proactively.

A dependency **MAY** restrict itself to some engines with `engines` (a helper that is only needed on
the Unity side, for instance), so that one dependency edge is not inherited by another engine's
install plan.

---

## 5. Engine targets and floors

`targets` maps an engine name to a target. Every target has two mandatory keys: `requirements` and
`artifact`.

```yaml
targets:
  unity:
    requirements:                 # host floors; the core defines only minEngineVersion
      minEngineVersion: '2019.4'
      minRuntimeVersion: '4.6'    # the .NET API level floor, defined by the Unity adapter
    artifact:
      type: package               # archive | package | file | external (§6)
      format: unitypackage
      path: payloads/core-editor-utils/artifacts/core-editor-utils-1.1.0-unity.unitypackage
      size: 1709
      sha256: e2cadf5ee729033c1415eefb90d63af35a3af3d205d0e59c435b3589a2c236dd
```

- **R-TGT-1** `targets` **MUST** be a non-empty mapping whose keys are named per §3.2.
- **R-TGT-2** Every target **MUST** declare both `requirements` and `artifact`; missing either one is
  a rejection (`E-TARGET-REQUIREMENTS` / `E-TARGET-ARTIFACT`).
- **R-TGT-3** A target describes **one engine**. The floors, container and layout a tool has in
  different engines **MUST** live in their own targets and **MUST NOT** be repeated at the top level.

- **R-PLAT-1** `requirements.minEngineVersion` **MUST** be present.
  On the Unity side the format is `YYYY.MINOR` or a full editor version (`2020.3`, `2021.3.5f1`);
  other engines define how it is compared in their own adapters. The importer compares it against the
  host and refuses to install when it is below the floor.
- **R-PLAT-2** Every other key of `requirements` is defined by the **engine adapter** and its value
  is a flat scalar. The Unity adapter defines `minRuntimeVersion` (`4.6` means .NET Framework;
  `6.0` / `7.0` / `8.0` mean .NET Standard 2.1 / .NET, compared against the project's API
  compatibility level); the Godot adapter defines `minApiVersion`, and so on. The core only
  guarantees that `minEngineVersion` is always comparable.
- **R-PLAT-3** `minEngineVersion` is mandatory even when a tool has no real floor — because "field
  missing" and "forgot to fill it in" are indistinguishable in the data. This is the "minimal
  necessary attribute set" rule: a tool that cannot declare its own engine floor is not admitted.

---

## 6. The four artifact types

`artifact.type` says what the artifact is and who is able to open it. The four values are mutually
exclusive.

- **R-SRC-1** `artifact.type` **MUST** be one of `archive`, `package`, `file`, `external`.
- **R-SRC-2** `artifact.path` **MUST** have the form `payloads/<id>/artifacts/<file>`, where
  `<file>` **MUST** follow the naming of **R-LAYOUT-4**; the directory segment **MUST** equal the
  tool's `id`.
- **R-SRC-3** `archive` / `package` / `file` **MUST** carry `format`, `path`, `size` and `sha256`.
  `sha256` **MUST** be the digest of the artifact file itself (not of its contents), in lowercase
  hexadecimal; `size` **MUST** be its exact byte count.
- **R-SRC-4** `format` **MUST** agree with the container's real bytes (a zip starts with
  `PK\x03\x04`, a gzipped tar with `1f 8b`, a zstd frame with `28 b5 2f fd`). Labelling the format
  wrongly causes validation to fail.
- **R-SRC-5** A container **MUST NOT** hold absolute paths or `..` segments (zip-slip / tar-slip).

### 6.1 `archive` — a container the core itself can open

- **R-ART-1** For `type: archive`, `format` **MUST** be one of the formats the core supports:
  `zip`, `tgz`, `tar.gz`, `tar.zst`. A container the core does not know **MUST NOT** be declared
  `archive` — an engine-specific container **MUST** be declared `package`, otherwise the core would
  try to open it with a generic unpacker when the correct behaviour is to hand it to that engine's
  own import pipeline.

```yaml
targets:
  godot:
    requirements:
      minEngineVersion: '4.2'
    artifact:
      type: archive
      format: tgz
      path: payloads/core-editor-utils/artifacts/core-editor-utils-1.1.0-godot.tgz
      size: 1047
      sha256: 06a6523ef5d8272f3373646f7cfa57795f4a1e5c4d74f8cf5ec9c61ade36419a
      unpack: auto
      contentRoot: addons/core_utils
      files:
        - plugin.cfg
        - CoreUtilsPlugin.cs
        - Runtime/Core/Guard.cs
        - Runtime/Core/PooledList.cs
```

`contentRoot` declares the extraction target (relative to the project root). Archive entries should
already look the way they should appear under `contentRoot`.

### 6.2 `package` — a container only that engine's adapter can open

- **R-ART-2** For `type: package`, `format` is registered by the **engine adapter**, which is why
  `unitypackage` is a **Unity concept** rather than a core one: the core moves and verifies the bytes,
  and `providers/engine-unity` opens them. For an engine with no adapter a `package` artifact
  **MAY** still be stored, but the importer **MUST NOT** pretend it can open it.
  Inside a `unitypackage`, every GUID folder **MUST** carry a `pathname` entry, otherwise the engine
  cannot place its files and the import result is unpredictable. `unpack: auto` means that engine's
  adapter opens the container and takes its entries, which is what actually installs the tool;
  `none` means the whole artifact is placed at `targetPath`, so its entries exist only after the
  engine imports it - which is why `targetPath` is **required** in that case.

```yaml
targets:
  unity:
    requirements:
      minEngineVersion: '2020.3'
      minRuntimeVersion: '4.6'
    artifact:
      type: package
      format: unitypackage
      path: payloads/editor-tool-selection-history/artifacts/editor-tool-selection-history-1.0.0.unitypackage
      size: 1259
      sha256: 6cb13d4a15d6a72345cf5232e61458a7194e97dc41a03056dfe248ae39f59ad5
      unpack: auto
      editorOnly: true
      files:
        - Assets/SelectionHistory/SelectionHistoryWindow.cs
        - Assets/SelectionHistory/SelectionHistoryTracker.cs
```

### 6.3 `file` — a single-file artifact

- **R-ART-3** `type: file` describes a single-file payload with **no container at all** (a dll, one
  shader, a licence text). It **MUST** carry `targetPath` (relative to the project root, saying where
  the file lands) and its `unpack` **MUST** be `none`. `format` mirrors the extension (`dll`, `pdb`,
  `so`, `dylib`, `txt`). Like an `archive` it is bound by `size` + `sha256`, so it is **not** a
  "loose file" — it is a sealed, verifiable single file.

```yaml
targets:
  unity:
    requirements:
      minEngineVersion: '2019.4'
      minRuntimeVersion: '4.6'
    artifact:
      type: file
      format: dll
      path: payloads/libs-sharp-json/artifacts/libs-sharp-json-3.0.0.dll
      size: 128
      sha256: 7e7b7dec8f657dc691ca06c3bf23956976a3c6727e9fadb7c2bfd8df4d55246f
      unpack: none
      targetPath: Assets/SharpJson/SharpJson.dll
      files:
        - Assets/SharpJson/SharpJson.dll
```

### 6.4 `external` — metadata only

- **R-EXT-1** `type: external` **MUST** carry `source` (`git` / `http` / `npm`), `url` and `ref`, and
  **MUST NOT** carry `path`, `size` or `sha256`: recording a digest for bytes that are not in this
  repository cannot be checked. This registry stores no artifact for that tool.
- **R-EXT-2** `ref` **MUST** be a tag or a commit SHA and **MUST NOT** be a branch name, otherwise
  two installs of the same version could pick up different code, which destroys the receipt model.
- **R-EXT-3** Use `subdirectory` when the repository root is not the package root; `upmPackageName`
  lets the importer detect conflicts with packages already installed in the project and defer to the
  engine's own package resolution.
- **R-EXT-4** `unpack` **SHOULD** be `none` — there is no local container to open.
- **R-EXT-5** The point of this form is to cap the repository's storage. When a bundled tool's source
  grows large, or when upstream already publishes a usable package, prefer switching to it.

```yaml
targets:
  unity:
    requirements:
      minEngineVersion: '2019.4'
      minRuntimeVersion: '4.6'
    artifact:
      type: external
      source: git
      url: https://github.com/JokeVallen/gltf-importer-sample.git
      ref: v2.3.1
      subdirectory: Packages/com.devcat.gltf-importer
      upmPackageName: com.devcat.gltf-importer
      unpack: none
      editorOnly: false
```

### 6.5 Why loose files are still forbidden

- **R-ART-4** A payload **MUST NOT** be imported as a loose tree of files: a payload directory may
  contain only `tool.yaml`, an optional `README.md` and `artifacts/`, and **source files MUST NOT be
  committed into a payload** (R-LAYOUT-3). The reason is the one that already held in v1: loose `.cs`
  files leave untracked assets in the project that can neither be hash-verified nor cleanly removed.
  When a single file genuinely has to be delivered, use `type: file`: it carries `targetPath` and a
  digest, which makes it a sealed single file rather than a loose source tree.

### 6.6 Where a payload lands, and moving it

- **R-SRC-6** The manifest's destinations are the **default**, not the only possibility. Every
  installed path of one target lands under one directory - `contentRoot` plus the structure inside
  the container for an unpacked artifact, `targetPath`'s directory for a sealed one - and a consumer
  **MAY** install that whole directory somewhere else inside the project (`utool install --into`).
- **R-SRC-7** Relocation **MUST** preserve the structure below that directory and **MUST NOT** split
  a payload across two roots: the directory is the unit that a receipt records, and a tool spread
  over two places cannot be uninstalled without guessing.
- **R-SRC-8** Relocation applies to the tool the caller **asked for**. A dependency keeps the layout
  its own manifest declares; two tools merged into one directory would make ownership ambiguous.
- **R-SRC-9** Because `targetPath` and `contentRoot` are defaults, they **MUST** name a directory
  that is the tool's own (`Assets/<Tool>/...`), never a shared one - a deployment that is moved is
  still expected to be removable on its own.

---

## 7. Capabilities: `provides` and `injects`

`dependencies` pins an **id**: I want `core-editor-utils ^1.1.0` and nothing else will do.
Many needs are not "I want that tool" but "I want this capability, whoever provides it" — argument
guards, object pooling, JSON serialization. Written as a dependency, that need welds the consumer to
one implementation; swapping the implementation would force every consumer to change.

The format therefore uses namespaced **capability names**:

```yaml
provides:                       # capabilities this tool offers to others
  - unity.window.selection-history
injects:                        # capabilities this tool needs, satisfied by any provider
  - script.api.argument-guards
dependencies:                   # pins a specific tool and version
  - id: core-editor-utils
    version: ^1.1.0
    reason: Uses Guard for argument validation.
```

- **R-CAP-1** `provides` and `injects` **MUST** be arrays of strings, at most 32 entries each, with
  no duplicates.
- **R-CAP-2** A capability name **MUST** match
  `^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$` and be at most 96 characters long — that is,
  **at least two** dot-separated lowercase kebab-case segments. Two segments is deliberate: a
  capability must state its namespace rather than being a bare word that collides
  (`script.api.argument-guards`, not `guards`).
- **R-CAP-3** The same capability **MAY** be provided by several tools — they are alternatives, and
  that is precisely why `injects` exists: a user can choose between implementations that satisfy one
  capability. Registry-level validation only raises a **warning** for that case
  (`W-CAP-MULTIPLE`), because "several providers" is legal in a registry. What **MUST** be rejected is
  a single **install plan** containing two providers of the same capability (`E-CAP-CONFLICT`,
  decided by the import tool's resolver): that is what leaves a consumer unable to say which provider
  it received. The unit of conflict is one install, not the whole registry.
- **R-CAP-4** Every inject **MUST** be satisfiable by some tool in the registry, otherwise validation
  fails (`E-CAP-UNSATISFIED`). What this repository publishes is a family of tools, not an arbitrary
  single item.
- **R-CAP-5** `injects` is **not** a dependency: it names no id and is satisfied by **any** tool that
  provides the capability. That is exactly what lets a provider be replaced without touching its
  consumers' declarations, and why the two are accounted for separately.
- **R-CAP-6** The former `type: shader-pack` is gone: a shader model is engine-specific, so it belongs in
  a target or in a `tag`, not in an engine-neutral enum. `type` is now only `editor-tool`,
  `tool-library`, `framework`, `asset-pack`, `template`.

---

## 8. Field reference

### 8.1 Top-level required (engine-neutral)

| Field | Type | Description |
| --- | --- | --- |
| `kind` | constant `tool` | document discriminator |
| `formatVersion` | string `'3'` | readers reject versions they do not recognise (R-FMT-4, R-FMT-5) |
| `id` | string | §3 |
| `displayName` | string, 1–80 | display name in the import tool's list |
| `type` | enum | `editor-tool`, `tool-library`, `framework`, `asset-pack`, `template` (R-CAP-6) |
| `description` | string, 10–600 | one paragraph saying what it does and what problem it solves |
| `version` | string | §4 |
| `targets` | mapping | §5, at least one engine |

### 8.2 Top-level optional (engine-neutral)

| Field | Type | Description |
| --- | --- | --- |
| `tags` | array of strings | ≤ 12, lowercase kebab-case |
| `author` | string | attribution |
| `license` | string | SPDX identifier, **MAY** differ from the repository's MIT |
| `licenseUrl` | URI | where the licence text lives, for a project that ships its own `LICENSE` or whose licence has no SPDX page. Optional: an identifier already resolves to spdx.org, so this exists to point somewhere **else**, and a consumer **SHOULD** prefer it |
| `homepage` | URI | upstream repository or project home |
| `documentation` | URI | documentation address; separate from `homepage`, because they are often different places |
| `releaseNotes` | URI | where the maintainer publishes release notes; a link, not the text |
| `provides` | array of strings | §7, ≤ 32 |
| `injects` | array of strings | §7, ≤ 32 |
| `dependencies` | array of mappings | §4.1 |
| `releasedAt` | `YYYY-MM-DD` | release date |
| `deprecated` | boolean | the import tool **SHOULD** hide it or warn about it |

### 8.3 Target and artifact

| Field | Where | Type | Description |
| --- | --- | --- | --- |
| `requirements` | target, required | mapping | `minEngineVersion` is mandatory, other keys are adapter-defined (§5) |
| `artifact` | target, required | mapping | exactly one (R-TGT-2) |
| `artifact.type` | artifact, required | enum | `archive`, `package`, `file`, `external` (§6) |
| `artifact.format` | artifact | string | required unless external; container or file format (R-SRC-3, R-SRC-4) |
| `artifact.path` | artifact | string | required unless external, inside this payload's `artifacts/` (R-SRC-2) |
| `artifact.size` / `sha256` | artifact | integer / 64-char lowercase hex | required unless external (R-SRC-3) |
| `artifact.source` / `url` / `ref` | artifact | enum / string / string | required for external (R-EXT-1, R-EXT-2) |
| `artifact.subdirectory` / `upmPackageName` | artifact | string | subtree and package name for external (R-EXT-3) |
| `artifact.unpack` | artifact | `none` / `auto` | defaults to `auto`; `file` **MUST** be `none`, and any `none` needs `targetPath` (R-ART-3) |
| `artifact.targetPath` | artifact | string | required for `file`, and for any artifact with `unpack: none` |
| `artifact.contentRoot` | artifact | string | extraction target for an unpacked archive, relative to the project root |
| `artifact.files` | artifact | array of strings | human-readable install inventory, shown before installation |
| `artifact.editorOnly` | artifact | boolean | the payload does not enter player builds |
| `artifact.restartRequired` | artifact | boolean | the host must reload before the tool takes effect |

Every level sets `additionalProperties: false`: a misspelled field name is a validation failure, not
something silently ignored.

### 8.4 A complete example

The following is byte-for-byte the content of `payloads/core-editor-utils/tool.yaml` (comments
omitted), so the documentation cannot drift away from the real data:

```yaml
kind: tool
formatVersion: '3'
id: core-editor-utils
displayName: Core Editor Utils
type: tool-library
description: >-
  Guard and PooledList, written in engine-neutral C# and shipped to both Unity and Godot from one source
  tree. Import this before anything that depends on it.
version: 1.1.0
license: MIT
author: DevCat
homepage: https://github.com/JokeVallen/ToolRegistry.git
tags:
  - core
  - runtime
  - cross-engine
provides:
  - script.api.argument-guards
  - script.api.object-pooling
injects: []
dependencies: []
targets:
  unity:
    requirements:
      minEngineVersion: '2019.4'
      minRuntimeVersion: '4.6'
    artifact:
      type: package
      format: unitypackage
      path: payloads/core-editor-utils/artifacts/core-editor-utils-1.1.0-unity.unitypackage
      size: 1876
      sha256: 439362aa6c00b350ddad83180ac151de99ee0a6da2a35f6a7cd27c2cc09820a2
      unpack: auto
      files:
        - Assets/CoreEditorUtils/Runtime/Core/Guard.cs
        - Assets/CoreEditorUtils/Runtime/Core/PooledList.cs
        - Assets/CoreEditorUtils/Editor/CoreEditorUtils.cs
  godot:
    requirements:
      minEngineVersion: '4.2'
    artifact:
      type: archive
      format: tgz
      path: payloads/core-editor-utils/artifacts/core-editor-utils-1.1.0-godot.tgz
      size: 1047
      sha256: 06a6523ef5d8272f3373646f7cfa57795f4a1e5c4d74f8cf5ec9c61ade36419a
      unpack: auto
      contentRoot: addons/core_utils
      files:
        - plugin.cfg
        - CoreUtilsPlugin.cs
        - Runtime/Core/Guard.cs
        - Runtime/Core/PooledList.cs
releasedAt: '2026-01-10'
```

---

## 9. `index.yaml`

A generated flat catalog, so that the import tool does not have to walk the directory tree.
`kind: index`.

An index entry carries engine **names only**, never per-engine floors or artifact paths — those stay
in each manifest, because the index is there to "list everything in one request", not to install
from. Entries also carry `provides` / `injects` / `dependencies` / `tags` / `manifestPath`, so a
consumer can shortlist candidates without reading every manifest first.

```yaml
kind: index
formatVersion: '3'
repository: https://github.com/JokeVallen/ToolRegistry.git
tools:
  - id: core-editor-utils
    displayName: Core Editor Utils
    type: tool-library
    description: >-
      Guard and PooledList, written in engine-neutral C# and shipped to both Unity and Godot from one
      source tree. Import this before anything that depends on it.
    version: 1.1.0
    engines:
      - godot
      - unity
    provides:
      - script.api.argument-guards
      - script.api.object-pooling
    injects: []
    dependencies: []
    tags:
      - core
      - runtime
      - cross-engine
    manifestPath: payloads/core-editor-utils/tool.yaml
```

- **R-IDX-1** `index.yaml` **MUST** be derived from the payloads; **MUST NOT** be edited by hand.
- **R-IDX-2** It **MUST** be regenerated in the same commit that adds or modifies a tool, otherwise
  validation fails.

---

## 10. Distribution channels

| Channel | Mechanism | Trade-off |
| --- | --- | --- |
| Import tool | reads `index.yaml`, selects the target named by `--engine`, fetches artifacts, resolves dependencies | pick on demand; writes a receipt; the only supported path |
| External source | an `artifact.type: external` target names an upstream repository instead of storing bytes | keeps this repository small; the payload is not hash-verified here, and the caller resolves it |

- **R-CHAN-1** An `Assets/` directory **MUST NOT** appear at the repository root, and this repository
  **MUST NOT** be installable as a whole. It stores data; tool selection belongs to the import tool.
  A Git URL install therefore imports nothing by itself, which is the point rather than a limitation.
- **R-CHAN-2** An artifact's bytes **MUST NOT** be copied anywhere else in the repository. One
  artifact, one location under `payloads/<id>/artifacts/`, so a deletion removes exactly one
  directory and leaves no stale duplicate behind.

---

## 11. Migration and evolution

- **R-MIG-1** A breaking change to this specification **MUST** bump `formatVersion`; readers
  **MUST** reject versions they do not recognise.
- **R-MIG-2** Retiring a tool means first setting `deprecated: true` for at least one release cycle,
  then deleting the payload.
- **R-MIG-3** Deleting a payload **MUST** update `index.yaml` in the same commit.
- **R-MIG-4** Migrating from v1 to v2 **MUST**: raise `formatVersion` to `'2'`; move the top-level
  `minUnityVersion` / `minDotNetVersion` / `source` / `artifacts` / `files` / `install` /
  `packageName` / `assemblyName` into the relevant engine's `targets.<engine>`; translate
  `source.kind: bundled` into `artifact.type` (`unitypackage` → `package`, `zip` / `tgz` →
  `archive`, a single file → `file`) and `source.kind: external` into `artifact.type: external`;
  and rename the artifact files per R-LAYOUT-4. A migration **MAY** also take the opportunity to
  rewrite "I need that tool" as an `injects` capability declaration.

- **R-MIG-5** Migrating from v2 to v3 **MUST**: raise `formatVersion` to `'3'`; move the top-level
  `version`, `targets`, `releasedAt` and `deprecated` into `versions[0]`; and add `latest`, whose
  value **MUST** equal that version. Artifact bytes and file names are unaffected: v3 only moved
  where version information sits within the document. `deprecated` is a per-version field after the
  migration, so it belongs to one `versions[]` entry rather than to the document root.

### Adding a tool — the exact steps

```pwsh
# 1. Create the directory and copy from the template (a two-engine example
#    and filling instructions)
New-Item -ItemType Directory -Force payloads/my-tool/artifacts
Copy-Item template/tool.bundled.yaml payloads/my-tool/tool.yaml

# 2. Produce one artifact per engine (Unity: Assets > Export Package...; otherwise: Compress-Archive / tar -czf)

# 3. One target: <id>-<version>.<ext>; several targets: <id>-<version>-<engine>.<ext>
Copy-Item my-tool.unitypackage payloads/my-tool/artifacts/my-tool-1.0.0.unitypackage

# 4. Edit tool.yaml and fill in size and sha256 for every target from the real bytes
node ../ToolImport/apps/cli/bin/utool.js digest payloads/my-tool/artifacts/my-tool-1.0.0.unitypackage

# 5. Rebuild the index and validate
node tools/registry.mjs write-index
node tools/registry.mjs validate
```

---

## 12. Not yet defined

The following are **not part of the format today**; a reader must reject them as unknown fields.
They are recorded here so that adding one later reads as a format revision rather than a quiet
extension.

| Not yet defined | What to do today |
| --- | --- |
| a `channels` field (`stable` / `preview`) | express maturity and withdrawal with the per-version `deprecated` / `yanked` |
| artifact signatures beyond `sha256` | `sha256` only; integrity rests on it and `size` |
| **generic** requirement keys beyond `minEngineVersion` | every other key is defined by the engine's adapter (see R-PLAT-2); the core knows no specific name |
| engine adapters beyond Unity and Godot | an engine with no adapter is still **valid data**, it simply cannot be planned for installation (see R-ENG-2) |

What has already shipped is deliberately **not** listed here: multi-version metadata
(`versions[]` + `latest`, see R-VER-4), per-version `deprecated` and `yanked`, and the Godot
adapter are all part of the current format.
