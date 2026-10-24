# Contributing Guide

**Language**: [English](CONTRIBUTING.en.md) · [中文](CONTRIBUTING.zh-CN.md) · [back to index](../README.md)

This registry is deliberately strict: the import tool trusts it, so anything admitted must be
verifiable, pluggable and removable. The good news is that adding a tool takes **one directory,
one artifact per engine, and one command**.

---

## What you can contribute

| What you want to do | What changes | How |
| --- | --- | --- |
| **Add a new tool** | `payloads/<new id>/` | Start from the template, fill the manifest in, add the artifact. By far the most common. |
| **Publish a new version** | `payloads/<existing id>/` | Produce a new artifact and add a `versions` entry. |
| **Change metadata only** | `payloads/<id>/tool.yaml` | Description, tags, dependencies, floors. The artifact bytes do not move. |
| **Point at a package that lives elsewhere** | `payloads/<id>/tool.yaml` | `type: external`: no bytes are stored here, only where they are. |
| **Change the format or the toolchain** | `schema/`, `tools/` | Read the [format specification](SPEC.en.md) first; this is a breaking change and needs a format revision. |

Documentation fixes and typo corrections are just as welcome — open a pull request.

**Not sure what a field takes?** The [attribute reference](ATTRIBUTES.en.md) has a section per
field, with what each value means and a snippet you can copy.

## The flow

```text
1. Create the directory and copy the skeleton from template/
2. Fill the manifest in, making the id match the directory name
3. Produce one artifact per engine
4. Run utool digest and paste size and sha256 back in
5. Regenerate the index and validate
6. Commit
```

Each step is detailed below. **Doing this for the first time**, read them in order; **just adding a
version**, jump to [Publishing a new version](#publishing-a-new-version).

> **Rather not read a document?** Double-click `tools/guide.html`. It lists those six steps in
> order with the commands already filled in for the id and engine you type, so they can be copied
> straight out. Each step links to the document that explains it - **do the step first, click
> through only when you get stuck.** What follows is for anyone who wants to know *why* it works
> this way, or who is staring at an error.

**Start by filling the manifest in with `tools/editor.html`.** Double-click it — no Node
needed. Fill the form, drop the artifact in and `size` and `sha256` are computed for you,
fields with a precondition (`targetPath`, `contentRoot`) appear only when it holds, and
generating runs the same validator over the result. Save the generated YAML as
`payloads/<id>/tool.yaml`.

You can re-check any existing manifest at any time with `tools/validate.html`: drop a
`tool.yaml` on it, or click "choose a file". It is a **generated**
single file (`npm run build:validator`) embedding the **same** validator and the same schema, so its
verdict matches the CLI; nothing is uploaded and it makes no network access. It checks the manifest's
shape only — hashes, dependency resolution and installation need the whole registry, which is
`utool validate`'s job.

---

## Adding a bundled tool

### 1. Start from the template

```pwsh
New-Item -ItemType Directory -Force payloads/my-tool/artifacts
Copy-Item template/tool.bundled.yaml payloads/my-tool/tool.yaml
```

First make `id` agree with the directory name (lowercase kebab-case), then decide which engines the
tool supports: **delete the targets you do not need**.

The template comments each field. To look up **what a particular field accepts**, read
[`ATTRIBUTES.en.md`](ATTRIBUTES.en.md) — that file is generated from the schema, so it cannot disagree
with the validator.

### 2. Produce one artifact per engine

**Unity editor tools / scripts / assets → `.unitypackage`** (preserving GUIDs and import settings):

```text
Unity: select the assets > Assets > Export Package... > uncheck "Include dependencies"
       > save as <id>-<version>[-unity].unitypackage
```

Export only the files the tool actually needs. **If it needs files from another tool in this
registry, do not export them a second time — declare a dependency.**

> **Every tool must occupy one directory of its own.** Install to `Assets/<Tool>/...` and nothing
> else, e.g. `Assets/CoreEditorUtils/`. Do **not** scatter by category
> (`Assets/Runtime/Core/`, `Assets/Editor/`): that spreads one tool into folders shared with the
> whole project, so "the files this tool owns" stops being definable and uninstall loses its clean
> boundary.
>
> This is not a path dependency Unity imposes — a unitypackage installs wherever it was built to
> install, so it is a **packaging choice**. `tools/check-payload-code.mjs` enforces the rule and
> fails on a scattered payload.

**Engine-independent source / documentation / a Godot addon → an archive**: build it so its entries
already look the way they should appear under `contentRoot`:

```pwsh
Compress-Archive -Path .\MyTool\* -DestinationPath my-tool-1.0.0.zip
tar -czf my-tool-1.0.0-godot.tgz -C MyTool .
```

**A single file → `type: file`**: no container, but it must declare `targetPath` and set
`unpack: none`.

> **One `file` artifact is exactly one file.** This is widely misread, so it is worth stating
> plainly: `file` means "these bytes land at `targetPath` unchanged". It has no notion of
> entries, and there is no way to write one artifact that carries two files.
>
> **A dll plus its xml doc comments must be packed as an archive**, not as two `file`
> artifacts — a target holds a single `artifact`, so a second file has nowhere to be
> declared. Build the archive so its entry paths are already where the files belong, and
> they land side by side:
>
> ```pwsh
> # Lay the tree out the way it should end up, then archive the whole thing
> #   Assets/MyLib/MyLib.dll
> #   Assets/MyLib/MyLib.xml
> tar -czf my-lib-1.0.0-unity.tgz -C . Assets
> ```
>
> ```yaml
> artifact:
>   type: archive
>   format: tgz
>   path: payloads/my-lib/artifacts/my-lib-1.0.0-unity.tgz
>   size: 277
>   sha256: '8890b28a...'
>   unpack: extract
>   contentRoot: Assets        # the archive's Assets/ unpacks under the project's Assets/
> ```
>
> Keep the `.xml` beside its `.dll`. That is how Unity and IDEs associate the documentation
> with the assembly; installing them to different locations still works, but the comments
> will not be picked up.

### 3. Name it per the rule and put it in place

```pwsh
# exactly one target
Copy-Item my-tool.unitypackage payloads/my-tool/artifacts/my-tool-1.0.0.unitypackage
# with several targets the engine segment is mandatory, or the two engines collide
Copy-Item my-tool.unitypackage payloads/my-tool/artifacts/my-tool-1.0.0-unity.unitypackage
Copy-Item my-tool.tgz         payloads/my-tool/artifacts/my-tool-1.0.0-godot.tgz
```

**Never modify an artifact that has already been committed.** Changed bytes mean a new `version`
and a new file.

### 4. Fill in `size` and `sha256` for every target from the real bytes

```pwsh
node ../ToolImport/apps/cli/bin/utool.js digest payloads/my-tool/artifacts/my-tool-1.0.0-unity.unitypackage
```

Run it once per target and write each result into that target's `artifact`; `artifact.path` must
point at the same file.

### 5. Declare capabilities

`provides` lists what this tool offers others; `injects` lists what it needs and **any** provider may
satisfy. Both are dot-separated lowercase names of at least two segments
(`script.api.argument-guards`), never a bare word:

```yaml
provides:
  - my-tool.window.main
injects:
  - script.api.argument-guards
dependencies:
  - id: core-editor-utils
    version: ^1.1.0
    reason: Uses Guard for argument validation.
```

Check first whether something already provides what you are about to `injects`, or validation fails
with `E-CAP-UNSATISFIED`. `provides`-ing a capability someone else already provides is **not an
error**: several providers are alternatives and registry-level validation only raises a
`W-CAP-MULTIPLE` warning — but a single install containing two providers of the same capability is
refused by the import tool (`E-CAP-CONFLICT`), so do not depend on two tools that offer the same
capability in one plan. Write `dependencies` only when you genuinely need one specific tool (a
specific version, a specific API).

> Manual-packaging pitfall with `.unitypackage`: the `pathname` entry of each GUID directory inside
> the archive **must** be a path **relative to the project root** (starting with `Assets/`), not a
> path relative to the repository root. Getting it wrong puts files in the wrong place.

### 6. Rebuild the index and validate

```pwsh
node tools/registry.mjs write-index
node tools/registry.mjs validate
```

`--write-index` rewrites `index.yaml`; `validate` must finish with `PASSED`.

---

## Adding an external-reference tool

Use this when upstream already publishes a usable package, or when bundled source would bloat this
repository. In that case **no artifact is stored**: `artifact.type` is `external`, and `path` /
`size` / `sha256` **must not** appear. Copy from `template/tool.external.yaml`.

```yaml
targets:
  unity:
    requirements:
      minEngineVersion: '2019.4'
      minRuntimeVersion: '4.6'
    artifact:
      type: external
      source: git
      url: https://github.com/owner/repo.git
      ref: v2.3.1
      subdirectory: Packages/com.owner.something
      upmPackageName: com.owner.something
      unpack: none
```

`ref` **MUST** be a tag or a commit SHA. Using a branch head means two imports a week apart could
pick up different code under the same version number, which destroys the receipt model.

Please add a `README.md` in that payload directory explaining where the source actually lives —
otherwise the directory looks empty on GitHub.

Note: **resolving an external source is not implemented on the import-tool side yet.** The backend
currently reports it as caller-resolved and records `url` / `ref`; it does not clone or shallow-fetch
anything itself. So today this form is verifiable metadata only.

---

## Releasing a new version of an existing tool

1. Produce the new artifact, named `<id>-<new version>.<ext>` (with an engine segment when there are
   several targets).
2. Put it into `payloads/<id>/artifacts/`, and delete the old file only once you have confirmed that
   nothing still needs to pin the old version.
3. Update `version`, each target's `artifact` (path/format/size/sha256), and the floors, capability
   declarations and `dependencies` if they changed.
4. Rebuild the index, validate, commit.

If you want the old version to remain retrievable, the old file may be kept; validation only
requires that the **declared** artifacts exist and that there are no **undeclared** files in
`artifacts/`. If you keep the old file, it must be declared — otherwise delete it.

Note: adding a target for a new engine to an existing tool changes the artifact file names (from
`<id>-<version>.<ext>` to `<id>-<version>-<engine>.<ext>`), because the rule looks only at the number
of targets. That is a version bump.

---

## Version bump guidance

| Change | Bump |
| --- | --- |
| bug fix, API unchanged | patch |
| new feature, backwards compatible | minor |
| breaking API change, or raising any target's `minEngineVersion` / adapter requirement key | major |
| adding a target for a new engine (adding capability, leaving existing engines alone) | minor |
| metadata-only correction (`description` typo) | patch, artifact bytes unchanged |

Only raise the floors when the code genuinely requires it: raising `minEngineVersion` is a breaking
change for everyone below the new floor. Floors are **per target**, so raising the Unity side does
not affect the Godot side.

---

## Pre-push checklist

Every item is enforced by `tools/registry.mjs`. Run it before you push; CI runs it too.

**Install the local hook once, and skip a round trip:**

```pwsh
git config core.hooksPath .githooks
```

After that, a commit touching `payloads/`, `schema/`, `tools/` or `index.yaml` is stopped locally
when `index.yaml` has not kept up, and told which command to run — rather than discovered after the
push, when CI fails and the fix is a second round trip. It **checks and does not rewrite**: silently
editing a staged file during a commit is the kind of surprise that makes people distrust hooks. Skip
it once with `git commit --no-verify`.

- [ ] `payloads/<id>/tool.yaml` exists and satisfies `schema/tool.schema.json`
- [ ] `<id>` is lowercase kebab-case and equals the directory name
- [ ] both `kind: tool` and the current `formatVersion` are present (see the [attribute reference](ATTRIBUTES.en.md#formatversion) for the value; migration from a past revision is [`SPEC.en.md`](SPEC.en.md) R-MIG-4)
- [ ] `displayName`, `description`, `type`, `latest`, `versions` are filled in
- [ ] `versions` is non-empty, with one target per engine in each version
      (see [`SPEC.en.md`](SPEC.en.md) §5)
- [ ] every target's `requirements.minEngineVersion` reflects the real floor (never guess, never omit)
- [ ] every target's `artifact.type` is one of `archive` / `package` / `file` / `external`, and a
      non-external artifact has `format` / `path` / `size` / `sha256` matching the bytes on disk
- [ ] artifact file names follow the rule: `<id>-<version>.<ext>` with one target,
      `<id>-<version>-<engine>.<ext>` with several
- [ ] `latest` names a version that exists in `versions` and is not withdrawn
- [ ] for `external`: `source` + `url` + `ref` are pinned (tag or commit, **not** a branch) and there
      is no `path` / `size` / `sha256`
- [ ] `provides` / `injects` capability names have at least two dot-separated lowercase segments, and
      every `injects` entry is provided by something in the registry
- [ ] the `id`s referenced by `dependencies` all exist, the constraints are satisfiable, and there
      are no cycles
- [ ] the payload directory contains **no** source files, DLLs or stray artifacts
- [ ] `node tools/registry.mjs write-index` has been run and committed
- [ ] `node tools/registry.mjs validate` passes

`template/` holds the current skeletons: `tool.bundled.yaml` (a two-engine example with step-by-step
filling instructions), `tool.external.yaml`, `index.yaml` and `receipt.yaml`. Read the template
before the spec.

## When you hit an error code

Every code and its remedy is in [`ERRORS.en.md`](ERRORS.en.md) (**the only place**).

The one a contributor meets most is `E-DEP-VERSION`: raising a dependency's major version
without relaxing the constraint fails immediately. Next is `E-CAP-UNSATISFIED`, easiest to hit
when the consumer is written before the provider.

The single code the validator only warns about, without failing the build, is `W-CAP-MULTIPLE`:
several tools providing one capability. That is legal - they are alternatives. What is refused is
two providers of one capability inside **a single install plan** (`E-CAP-CONFLICT`, decided by the
import tool's resolver, not by this validator).

## Style

- `description`: one paragraph, present tense, no marketing adjectives. The import tool displays it
  verbatim.
- `displayName`: title case, short enough to fit on one line of a list.
- `tags`: lowercase kebab-case, ≤ 12.
- Capability names: at least two segments with the namespace first
  (`script.api.argument-guards`, `unity.window.selection-history`), lowercase kebab-case, ≤ 96
  characters.
- Non-ASCII text in `displayName` / `description` is fine; all files are **UTF-8 without BOM**.
- Use `"license": "MIT"` unless the payload genuinely carries another license — the repository's
  LICENSE does not override a payload's own field.
- Comments: `.yaml` is YAML, so comments can be written. Use them to explain **why** this tool
  exists and what the pitfalls are, rather than restating field names.

## Commit messages

```text
add: <id> <version>            new tool
update: <id> <old> -> <new>    a new version of an existing tool
meta: <id> ...                 metadata-only change, artifact bytes unchanged
remove: <id>                   delete the payload (update the index in the same commit)
docs: ...                      documentation or tooling only
```
