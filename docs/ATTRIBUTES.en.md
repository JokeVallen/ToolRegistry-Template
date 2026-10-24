<!-- generated; do not edit. Run npm run gen:attributes -->

# Attribute reference

**Language**: [English](ATTRIBUTES.en.md) · [中文](ATTRIBUTES.zh-CN.md) · [back to index](../README.md)

Generated from `schema/tool.schema.json` by `npm run gen:attributes`, so it cannot disagree with
the validator. A hand-written field reference drifts eventually, and a reference that is subtly
wrong is worse than none, because it is what a contributor trusts while filling a manifest in.

Use this to look up a single field; read [`SPEC.en.md`](SPEC.en.md) for the complete rules, and
[`CONTRIBUTING.en.md`](CONTRIBUTING.en.md) for the steps.

---

## Top-level fields

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `kind` | string | **required** | Document discriminator. Every registry document carries one so a reader knows which shape to expect before parsing further: tool, index or receipt. Values: `tool`. |
| `formatVersion` | string | **required** | Format revision, as a string. Bumped only for breaking changes; a reader must reject a revision it does not implement. Version 2 described exactly one version at the document root, so it had no `versions` array and no `latest`. Values: `3`. |
| `id` | string | **required** |  |
| `displayName` | string | **required** |  |
| `type` | string | **required** |  |
| `description` | string | **required** |  |
| `tags` | array<string> | optional |  |
| `author` | string | optional |  |
| `license` | string | optional |  |
| `licenseUrl` | string | optional | Where the licence text lives, for a project that ships its own LICENSE file or whose licence has no SPDX page. Optional: an SPDX identifier already resolves to spdx.org, so this exists to point somewhere ELSE, and a front end uses it in preference to the identifier's default page. |
| `homepage` | string | optional |  |
| `documentation` | string | optional | Where the tool's documentation lives, when that is not the homepage. A repository root and a docs site are different places, so homepage cannot stand in for both: a user who wants to read the API reference has no way to find it from a clone URL. Optional, and a URI with a scheme - 'example.com/docs' is rejected because it is not clickable. |
| `releaseNotes` | string | optional | Where the maintainer publishes release notes. A link, not the text: release notes are maintained after publication, so a copy inside a registry goes stale exactly when it matters, and a user choosing between versions needs the maintainer's own page. A URI with a scheme, for the same reason as documentation. |
| `provides` | array<string> | optional |  |
| `injects` | array<string> | optional |  |
| `dependencies` | array<mapping> | optional | Declared by id only - never by path or URL. This is what keeps every tool relocatable inside the registry. |
| `latest` | string | **required** | The version an importer offers by default. MUST match one entry in `versions`, so the default can never point at something that is not published. |
| `versions` | array<mapping> | **required** | Every published version; newest first is conventional but not required. A consumer MAY install any entry, and a resolver picks the highest that satisfies the constraints it was given. |
| `releasedAt` | string | optional |  |
| `deprecated` | boolean | optional | The tool as a whole is retired. Per-version retirement is `versions[].deprecated`. |

## Target and artifact

### `versions[].targets.<engine>`

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `requirements` | mapping | **required** | Host floors for this engine. minEngineVersion is mandatory - a tool that cannot state its floor is not admitted, because 'field absent' and 'forgot to fill it in' are indistinguishable in data. Everything else is adapter-defined: minRuntimeVersion for Unity's .NET API level, minApiVersion for Godot, and so on. |
| `artifact` | mapping | **required** |  |

### `artifact`

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `type` | string | **required** | archive: a general container the core itself can open (zip, tgz, tar.zst). package: an engine-specific container only that engine's adapter can open (unitypackage and friends). file: a single-file payload with no container at all (a dll, one shader, a licence file). external: no artifact is stored here at all; the payload lives in another repository and the core records where. Values: `archive` \| `package` \| `file` \| `external`. |
| `format` | string | optional | Container format. Required unless type is external. For type archive the core accepts zip, tgz, tar.gz and tar.zst. For type package the value is whatever the engine adapter registers, so unitypackage is a Unity concept rather than a core one. For type file this mirrors the extension: dll, pdb, so, dylib, txt. Values: `zip`, `tgz`, `tar.gz`, `tar.zst`, `unitypackage`, `dll`. |
| `path` | string | optional | Repository-relative path, required unless type is external. Always inside the tool's own payload directory, so deleting a tool deletes one directory and nothing else. The file name must be <id>-<version>[-<engine>].<ext>. This pattern is intentionally loose; the exact naming rule is enforced by the validator, which can see the id, version and engine. Values: `^payloads/[a-z0-9-]+/artifacts/[A-Za-z0-9_.-]+$`. |
| `size` | integer | optional | Exact byte length. Required unless type is external. |
| `sha256` | string | optional | Digest of the artifact file itself, lower-case hex. Verified before import. Required unless type is external. Values: `^[a-f0-9]{64}$`. |
| `source` | string | optional | For type external: which kind of remote holds the payload. Values: `git` \| `http` \| `npm`. |
| `url` | string | optional | For type external. Values: `^(https://|git@|ssh://)`. |
| `ref` | string | optional | For type external. Pin a tag or a commit SHA; a branch head makes two installs of the same version diverge, which breaks the receipt model. |
| `subdirectory` | string | optional | For an unpacked archive: take only entries under this prefix and strip it. For type external: the sub-path inside the remote repository that holds the package. Lets one archive or repository serve several layouts. |
| `upmPackageName` | string | optional | For type external that is a UPM package: lets the importer detect collisions and defer to the engine's own package resolution. Values: `^[a-z0-9]+(\.[a-z0-9\-]+)+$`. |
| `unpack` | string | optional | auto: open the container and take its entries. none: place the artifact as-is, for a container that engine's own importer must see. none requires targetPath. Values: `none` \| `auto`. |
| `targetPath` | string | optional | Required for type file, and for any artifact with unpack: none: where the file lands in the project, relative to the project root. An unpacked artifact uses contentRoot rather than this. |
| `contentRoot` | string | optional | For an unpacked archive: the directory under the project root that entries are extracted into. Values: `Assets`, `addons`, `res://addons`. |
| `files` | array<string> | optional | Human-readable inventory of what the artifact installs, shown in the import tool before anything is written. |
| `editorOnly` | boolean | optional | The payload is excluded from player builds. |
| `restartRequired` | boolean | optional |  |

---

The table above is the quick reference. Below is each field in full: what it means, what every accepted value stands for, and a correct snippet to copy.

## Field by field · Top-level fields

### `kind`

Document discriminator. Every registry document carries one so a reader knows which shape to expect before parsing further: tool, index or receipt.

For a manifest you write yourself this line is always `tool`. The `index` document is generated by `npm run write-index`, and a `receipt` is written by the import tool after an install, so neither is yours to author.

| Value | Meaning |
| --- | --- |
| `tool` | One tool's manifest, at `payloads/<id>/tool.yaml`. **This is the value you write.** |
| `index` | The catalog `index.yaml`, generated by `npm run write-index`. Do not hand-edit. |
| `receipt` | A record of one install, written by the import tool under the project's `Library/`. |

```yaml
kind: tool
```

### `formatVersion`

Format revision, as a string. Bumped only for breaking changes; a reader must reject a revision it does not implement. Version 2 described exactly one version at the document root, so it had no `versions` array and no `latest`.

A string, not a number. Writing `3` is rejected; it must be `'3'`. That is a YAML quoting matter and the most common slip.

| Value | Meaning |
| --- | --- |
| `'3'` | The current revision, and the only value to use. |
| `'2', '1'` | Historic revisions that every reader rejects. For migration see the R-MIG rules. |

```yaml
formatVersion: '3'
```

### `id`

The tool's primary key, and the directory name too. **The directory must match `id` exactly**, or validation reports `E-ID-DIR`. Everything belonging to the tool lives under `payloads/<id>/`.

| Value | Meaning |
| --- | --- |
| `lowercase letters, digits, single hyphens` | For example `core-editor-utils`, `libs-sharp-json`. |
| `not allowed` | Capitals, spaces, underscores, doubled hyphens, a leading or trailing hyphen, or a leading digit. |
| `length` | 3 to 64 characters. |

```yaml
id: core-editor-utils
```

### `displayName`

```yaml
displayName: Core Editor Utils
```

### `type`

It says which kind of thing this is and nothing about engines: a shader model is engine-specific and belongs in a target or a tag, not here.

| Value | Meaning |
| --- | --- |
| `editor-tool` | A window, inspector extension or menu item inside the editor. |
| `tool-library` | A utility library other code calls. |
| `framework` | An opinionated architecture or subsystem. |
| `asset-pack` | Art or audio content. |
| `template` | A project or code skeleton. |
| `sample` | An example or demo. |
| `other` | Genuinely none of the above. |

```yaml
type: tool-library
```

### `description`

```yaml
description: Static guards for public method arguments, with allocation-free overloads.
```

### `tags`

```yaml
tags:
  - editor
  - utility
```

### `author`

```yaml
author: Mike
```

### `license`

Write the identifier alone - not the licence text, and not a path to a `LICENSE` file. It may differ from the repository's own licence.

| Value | Meaning |
| --- | --- |
| `MIT` | The MIT licence. |
| `Apache-2.0` | Apache 2.0. |
| `GPL-3.0-only` | GPLv3, with no later-version clause. |
| `Unlicense` | Copyright waived. |
| `cannot find it?` | Look the exact spelling up in the SPDX identifier list rather than inventing one. |

```yaml
license: MIT
```

### `homepage`

```yaml
homepage: https://github.com/JokeVallen/ToolRegistry
```

### `documentation`

Where the tool's documentation lives, when that is not the homepage. A repository root and a docs site are different places, so homepage cannot stand in for both: a user who wants to read the API reference has no way to find it from a clone URL. Optional, and a URI with a scheme - 'example.com/docs' is rejected because it is not clickable.

```yaml
documentation: https://jokevallen.github.io/ToolRegistry/docs/
```

### `releaseNotes`

Where the maintainer publishes release notes. A link, not the text: release notes are maintained after publication, so a copy inside a registry goes stale exactly when it matters, and a user choosing between versions needs the maintainer's own page. A URI with a scheme, for the same reason as documentation.

```yaml
releaseNotes: https://github.com/JokeVallen/ToolRegistry/releases
```

### `provides`

Capability names this tool offers to **other tools**, satisfying their `injects`. Publish a standalone tool and this can be an empty list. Use "domain.subdomain.capability" so another author can tell at a glance whether it is the one they need.

| Value | Meaning |
| --- | --- |
| `shape` | At least two dot-separated lowercase segments, e.g. `script.api.argument-guards`. |
| `naming` | Domain first, so the name says where it belongs rather than being a bare word. |

```yaml
provides:
  - script.api.argument-guards
  - script.api.object-pooling
```

### `injects`

Capabilities this tool **needs** without caring who supplies them. The key difference from `dependencies`: a dependency pins one tool, while `injects` pins only the capability, so the provider can be replaced without touching you.

```yaml
injects:
  - script.api.object-pooling
```

### `dependencies`

Declared by id only - never by path or URL. This is what keeps every tool relocatable inside the registry.

Dependencies are declared by `id` only, **never by path or URL** - which is what keeps every tool relocatable inside the registry. Each entry is a **mapping**, not an `id@constraint` string.

| Value | Meaning |
| --- | --- |
| `id` | Required. The `id` of the tool depended on. |
| `version` | Optional. A version constraint; omit for any version, taking the highest that fits. |
| `reason` | Optional. Why it is needed, at most 200 characters; shown to users. |
| `optional` | Optional. When true, its absence does not fail the install. |

```yaml
dependencies:
  - id: libs-sharp-json
    version: ^1.0.0
  - id: core-editor-utils
    optional: true
```

### `latest`

The version an importer offers by default. MUST match one entry in `versions`, so the default can never point at something that is not published.

```yaml
latest: 1.0.0
```

### `versions`

Every published version; newest first is conventional but not required. A consumer MAY install any entry, and a resolver picks the highest that satisfies the constraints it was given.

```yaml
versions:
  - version: 1.0.0
    targets:
      unity:
        requirements:
          minEngineVersion: '2019.4'
        artifact:
          type: archive
          format: zip
          path: payloads/core-editor-utils/artifacts/core-editor-utils-1.0.0.zip
          size: 1709
          sha256: e2cadf5ee729033c1415eefb90d63af35a3af3d205d0e59c435b3589a2c236dd
```

### `releasedAt`

```yaml
releasedAt: '2025-01-31'
```

### `deprecated`

The tool as a whole is retired. Per-version retirement is `versions[].deprecated`.

```yaml
deprecated: true
```

## Field by field · Target and artifact

### `targets.<engine>.requirements`

Host floors for this engine. minEngineVersion is mandatory - a tool that cannot state its floor is not admitted, because 'field absent' and 'forgot to fill it in' are indistinguishable in data. Everything else is adapter-defined: minRuntimeVersion for Unity's .NET API level, minApiVersion for Godot, and so on.

The host floors for that engine. `minEngineVersion` is **required**: a tool that cannot state its floor is not admitted, because a missing field and a forgotten one are indistinguishable in the data. The remaining keys are defined by that engine's adapter.

| Value | Meaning |
| --- | --- |
| `minEngineVersion` | Required. The engine floor, e.g. `'2019.4'` for Unity or `'4.2'` for Godot. |
| `minRuntimeVersion` | Unity only: the **host's** .NET API level floor, not the library's own target framework. It MUST be exactly `MAJOR.MINOR` (`4.7.1` is rejected). Compiling against .NET Standard 2.0 does **not** mean declaring `2.0` - this is the weakest host that can actually load the assembly. When unsure use `4.6`, which admits every Unity from 2019.4; a higher floor only narrows where the tool installs. Common values: `4.6`, `4.7`, `4.8`, `6.0`. |
| `other keys` | Defined by the adapter; a key the adapter does not know is reported as an unknown requirement. |

```yaml
requirements:
  minEngineVersion: '2019.4'
  minRuntimeVersion: '4.6'
```

### `targets.<engine>.artifact`

```yaml
artifact:
  type: archive
  format: zip
  path: payloads/core-editor-utils/artifacts/core-editor-utils-1.0.0.zip
  size: 1709
  sha256: e2cadf5ee729033c1415eefb90d63af35a3af3d205d0e59c435b3589a2c236dd
```

## Field by field · Target and artifact · `artifact`

### `artifact.type`

archive: a general container the core itself can open (zip, tgz, tar.zst). package: an engine-specific container only that engine's adapter can open (unitypackage and friends). file: a single-file payload with no container at all (a dll, one shader, a licence file). external: no artifact is stored here at all; the payload lives in another repository and the core records where.

It decides which fields are required and which are forbidden - an `external` artifact may not carry `size`, for instance.

| Value | Meaning |
| --- | --- |
| `archive` | A general-purpose container the core opens itself (zip, tgz, tar.gz, tar.zst). The preferred type. |
| `package` | A proprietary container only that engine's adapter opens, such as unitypackage. |
| `file` | A single file with no container (a dll, one shader, a licence). Requires `targetPath` and `unpack: none`. |
| `external` | No bytes are stored here, only where they are. Requires `source` and forbids `path`, `size` and `sha256`. |

```yaml
type: archive
```

### `artifact.format`

Container format. Required unless type is external. For type archive the core accepts zip, tgz, tar.gz and tar.zst. For type package the value is whatever the engine adapter registers, so unitypackage is a Unity concept rather than a core one. For type file this mirrors the extension: dll, pdb, so, dylib, txt.

Required unless `type` is `external`. **It must be compatible with `type`.** Under `archive` the core accepts zip, tgz, tar.gz and tar.zst; under `package` the accepted values are registered by an engine adapter, which is why unitypackage is a Unity concept rather than a core one; `file` simply uses the extension (dll, pdb, so, dylib, txt).

| Value | Meaning |
| --- | --- |
| `zip, tgz, tar.gz, tar.zst` | With `type: archive`. |
| `unitypackage` | With `type: package`, opened by the Unity adapter. |
| `dll, shader, txt, ...` | With `type: file`. |
| `git` | With `type: external`. |

```yaml
format: zip
```

### `artifact.path`

Repository-relative path, required unless type is external. Always inside the tool's own payload directory, so deleting a tool deletes one directory and nothing else. The file name must be <id>-<version>[-<engine>].<ext>. This pattern is intentionally loose; the exact naming rule is enforced by the validator, which can see the id, version and engine.

Required unless `type` is `external`, and always `payloads/<id>/artifacts/<file name>`. It lives inside the tool's own payload directory, so deleting a tool means deleting one directory. The file name must be `<id>-<version>[-<engine>].<ext>` or validation reports `E-ARTIFACT-NAME`. That pattern is deliberately loose; the exact naming rule is enforced by the validator, because only it can see the id, the version and the engine at once.

| Value | Meaning |
| --- | --- |
| `one target` | `<id>-<version>.<ext>`, e.g. `core-editor-utils-1.0.0.zip`. |
| `several targets` | `<id>-<version>-<engine>.<ext>`, e.g. `core-editor-utils-1.0.0-godot.tgz`. |
| `external` | Omit this field. |

```yaml
path: payloads/core-editor-utils/artifacts/core-editor-utils-1.0.0.zip
```

### `artifact.size`

Exact byte length. Required unless type is external.

Required unless `type` is `external`. It is checked before install, together with `sha256`. **Neither needs to be worked out by hand**: put the file in place and run `node ../ToolImport/apps/cli/bin/utool.js digest <file>`, which prints both lines ready to paste.

```yaml
size: 1709
```

### `artifact.sha256`

Digest of the artifact file itself, lower-case hex. Verified before import. Required unless type is external.

Required unless `type` is `external`, and checked before install. **Do not compute it by hand**: `utool digest <file>` prints a line you can paste. The point of it is that if anyone swaps the artifact bytes, the install fails **before** writing anything.

```yaml
sha256: e2cadf5ee729033c1415eefb90d63af35a3af3d205d0e59c435b3589a2c236dd
```

### `artifact.source`

For type external: which kind of remote holds the payload.

Only for `type: external`. It names where upstream the artifact lives; this repository records where it is and does not store its bytes.

| Value | Meaning |
| --- | --- |
| `git` | The upstream is a git repository. |
| `other values` | Interpreted by the consumer. |

```yaml
source: git
```

### `artifact.url`

For type external.

```yaml
url: https://github.com/example/gltf-importer.git
```

### `artifact.ref`

For type external. Pin a tag or a commit SHA; a branch head makes two installs of the same version diverge, which breaks the receipt model.

Only for `type: external`. Pin it to a tag or a commit SHA: a branch name means two installs of the same version can produce different bytes, which breaks the receipt model. **Prefer a tag or commit**, because pinning a branch makes one manifest install different content at different times.

```yaml
ref: v2.3.1
```

### `artifact.subdirectory`

For an unpacked archive: take only entries under this prefix and strip it. For type external: the sub-path inside the remote repository that holds the package. Lets one archive or repository serve several layouts.

```yaml
subdirectory: packages/runtime
```

### `artifact.unpack`

auto: open the container and take its entries. none: place the artifact as-is, for a container that engine's own importer must see. none requires targetPath.

Whether to unpack. `auto` is the default and is what an install does; `none` places the artifact as-is and hands it to that engine's own importer.

| Value | Meaning |
| --- | --- |
| `auto` | Open the container and take its entries - the path that actually writes files. |
| `none` | Do not unpack: the whole artifact lands as one file at `targetPath`, and its entries exist only after the engine imports it. |

```yaml
unpack: auto
```

### `artifact.targetPath`

Required for type file, and for any artifact with unpack: none: where the file lands in the project, relative to the project root. An unpacked artifact uses contentRoot rather than this.

Where a single file, or a container declared `unpack: none`, lands in the project, relative to the project root. **Required whenever `unpack: none`**, or validation reports `E-ARTIFACT-TARGETPATH` - without it, the artifact has no defined destination at all. An unpacked artifact uses `contentRoot` rather than this. The value is likewise dictated by the engine, so it belongs to one engine's target. It **must sit inside the tool's own directory** (`Assets/<Tool>/...`), never a shared one such as `Assets/Plugins`, `Assets/Editor` or `Assets/Resources`: developers keep their own plugins there, so a tool that claims them cannot be uninstalled cleanly. `tools/check-payload-code.mjs` rejects shared directories.

```yaml
targetPath: Assets/Plugins/SharpJson.dll
```

### `artifact.contentRoot`

For an unpacked archive: the directory under the project root that entries are extracted into.

Where an unpacked archive's entries are anchored inside the project. **This is not a preference but a required step**: entry names have to start somewhere, and without it an archive packed as `MyTool/...` would install as `MyTool/...` inside the project - wrong for a Unity project and wrong for a Godot addon. The value is dictated by the **engine** (Unity uses `Assets/...`, Godot uses `addons/<name>/`), which is why it sits inside a per-engine target: one tool's two artifacts can therefore land in two different places. Use `targetPath` instead when `unpack: none`.

```yaml
contentRoot: package/Runtime
```

### `artifact.files`

Human-readable inventory of what the artifact installs, shown in the import tool before anything is written.

A readable list of the files the artifact installs, shown to the user before anything is written. **It may be omitted, and with a large artifact it should be**: nothing verifies it today - the installer never compares it against the archive - so a long hand-written list buys no guarantee and costs maintenance. If it becomes a real check, this note will say so; until then, spend the effort on getting the archive itself right.

```yaml
files:
  - Runtime/ArgumentGuards.cs
  - Runtime/ObjectPool.cs
```

### `artifact.editorOnly`

The payload is excluded from player builds.

```yaml
editorOnly: true
```

### `artifact.restartRequired`

```yaml
restartRequired: true
```

## Field by field · `versions[]`

### `versions[].version`

The version number itself. The whole registry uses semver-lite: `major.minor.patch` with an optional prerelease suffix.

| Value | Meaning |
| --- | --- |
| `1.0.0` | A normal release. |
| `1.0.0-rc.1` | A prerelease, ordered below the same number without one. |
| `not allowed` | `v1.0.0` (no `v` prefix) and `1.0` (a missing patch number). |

```yaml
version: 1.0.0
```

### `versions[].targets`

Engine-keyed map for THIS version. A tool that works in more than one engine declares one target per engine instead of being duplicated. The core defines only this container; the meaning of a target's requirement keys and its artifact format belongs to that engine's adapter.

```yaml
targets:
  unity:
    requirements:
      minEngineVersion: '2019.4'
    artifact:
      type: archive
      format: zip
      path: payloads/core-editor-utils/artifacts/core-editor-utils-1.0.0-unity.zip
      size: 3
      sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

### `versions[].releasedAt`

```yaml
releasedAt: '2025-01-31'
```

### `versions[].deprecated`

This version is retired. Kept published so existing receipts stay resolvable, but an importer SHOULD prefer a newer one.

```yaml
deprecated: true
```

### `versions[].yanked`

This version is withdrawn: it MUST NOT be selected automatically. Unlike `deprecated` this is a hard stop, for a release that is broken or unsafe. It stays listed because a receipt may still reference it.

```yaml
yanked: true
```

### `versions[].notes`

One or two sentences on what this version changed, shown when a user picks a version.

```yaml
notes: Adds an allocation-free overload and drops Unity 2018 support.
```

## Value constraints

### `toolId`

- Values: `^[a-z0-9]+(-[a-z0-9]+)*$`
- Lowercase kebab-case. This is the primary key: directory name, dependency reference, index key, artifact file name stem and the first segment of every capability it provides. Because Windows paths are case-insensitive, lowercase-only also prevents two tools whose ids differ only by case from colliding.

### `engineId`

- Values: `^[a-z0-9]+(-[a-z0-9]+)*$`
- Engine family name. The core does not enumerate these: an engine without an adapter is still valid data, it simply cannot be planned until an adapter claims it.

### `capability`

- Values: `^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$`
- A namespaced capability name. Two segments minimum, so a capability always states its namespace rather than being a bare word.

### `strictVersion`

- Values: `^\d+\.\d+\.\d+(?:-[0-9A-Za-z.\-]+)?$`
- Semver-lite: numeric major.minor.patch with an optional prerelease suffix.

### `constraint`

- Values: `^(\^|~|>=|<=|>|<|=)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.\-]+)?$`
- ^1.2.3 allows >=1.2.3 <2.0.0; ~1.2.3 allows >=1.2.3 <1.3.0; >= n has no upper bound; a bare version means exactly that version.

### `toolType`

- Values: `editor-tool`, `tool-library`, `framework`, `asset-pack`, `template`
- Coarse ENGINE-NEUTRAL classification. Deliberately excludes engine-specific kinds such as shader packs: a shader model is engine-specific, so that belongs in a version's target or a tag.
