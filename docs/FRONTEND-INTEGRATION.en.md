# Tool-Library Import Tool — Integration Contract

**Language**: [English](FRONTEND-INTEGRATION.en.md) · [中文](FRONTEND-INTEGRATION.zh-CN.md) · [back to index](../README.md)

This document is the interface agreement between ToolRegistry (this repository) and
**ToolImport** (the tool-library import tool).

The import tool is the **only** component that writes files into a user's project. This repository
only supplies data; parsing, validation, installation and rollback are entirely the import tool's
responsibility.

For the Chinese version see [`FRONTEND-INTEGRATION.zh-CN.md`](FRONTEND-INTEGRATION.zh-CN.md).

---

## 1. Architecture: backend and interface separated

The import tool is **not** a Unity package; it is two layers, and the backend itself splits into an
engine-neutral core plus per-engine adapters:

```text
  ┌─────────────────────── engine-independent ───────────────────────┐
  │  packages/utool-core — the engine-neutral core (Node / npm)      │
  │    * .yaml parsing, kind / formatVersion header checks          │
  │    * index reading, dependency solving, capability (provides /   │
  │      injects) checks                                             │
  │    * version constraints, requirement comparison                 │
  │    * artifact verification (size / sha256 / container magic      │
  │      bytes / archive path safety)                                │
  │    * install plan, writing to disk, receipts, rollback pointer,   │
  │      uninstall plan                                              │
  │    The core knows no engine: container formats and version        │
  │    comparisons are registered by adapters                        │
  ├──────────────────────────────────────────────────────────────────┤
  │  providers/engine-unity — the Unity adapter                      │
  │    * the unitypackage container (GUID folders, pathname entries) │
  │    * Unity version and .NET API level (minRuntimeVersion)        │
  │    An engine with no adapter is still valid data; it simply       │
  │    cannot be planned for installation.                           │
  ├──────────────────────────────────────────────────────────────────┤
  │  apps/cli — `utool`, the backend's only external interface,       │
  │  runs standalone without Unity                                   │
  └──────────────────────────────────────────────────────────────────┘
                               ▲
                               │ subprocess invocation + record stream (--records) / JSON
                               │
  ┌───────────────────────────┴──────────────────────────────────────┐
  │  frontends/unity-editor — the Unity editor front end             │
  │    * lists importable items, shows details and file lists        │
  │    * shows the install plan, executes it after confirmation      │
  │    * shows installed items and uninstall entry points            │
  └──────────────────────────────────────────────────────────────────┘
```

### 1.1 Why it is layered this way

| Reason | Explanation |
| --- | --- |
| **Still actionable while compilation is broken** | When a project has compilation errors, Unity loads no editor assemblies at all and the interface layer cannot execute anything. With the core logic in Node, the CLI still works at that moment — this is the most practical benefit. |
| **Cross-engine** | The core only understands `.yaml` documents and artifact bytes; it does not even know what a `unitypackage` is. Unity support comes from `providers/engine-unity`. Attaching Godot / Unreal means adding an adapter and a front end, not rewriting the core. |
| **Testable** | Parsing, dependency and capability solving, and verification can all be unit-tested with no Editor and no network. |
| **Reusable** | CI can use the very same CLI to validate or install, without starting Unity. |

**The cost**: one extra process boundary. The interface layer cannot hold backend objects directly
and must communicate over the `--records` stream or JSON.

---

## 2. Data flow

```text
  index.yaml           (1 request, flat catalog)      -> builds the selectable list (id, engines, provides, injects)
     |
     v
  each tool's tool.yaml  (1 request per tool viewed)   -> dependencies, capabilities, per-engine requirements and artifact
     |
     v
  artifact bytes        (1 request per target per install) -> imported after size + sha256 + container verification
```

The import tool does not need to clone the whole repository; it fetches one file at a time.
**The engine choice happens after the manifest is read**: `index.yaml` only tells you which engines
a tool targets; the actual floors and artifact paths live in the manifest's `targets`.

### 2.1 Ways to fetch without cloning

| Method | Request form | Explanation |
| --- | --- | --- |
| GitHub raw | `https://raw.githubusercontent.com/JokeVallen/ToolRegistry/<ref>/index.yaml` | simplest; pin `<ref>` to a tag for reproducibility |
| `git` CLI | `git clone --depth 1 --filter=blob:none <url>` then read the working tree | the fallback when raw is unavailable or when going through a mirror |
| Local path | read a directory directly (found automatically when `--registry` is omitted) | for development and testing, with no network |

`index.yaml` and the metadata should be cached. Artifacts are content-addressed by `sha256`, so a
cache keyed by digest never needs to be invalidated.

---

## 3. Data model

```csharp
// one row of index.yaml -> tools[] (engine names only, no per-engine detail)
sealed class RegistryToolSummary
{
    public string Id;
    public string DisplayName;
    public string Type;              // editor-tool | tool-library | framework | asset-pack | template
    public string Description;
    public string Version;
    public string[] Engines;         // engine names, e.g. ["godot", "unity"]
    public string[] Provides;
    public string[] Injects;
    public DependencyRef[] Dependencies;
    public string[] Tags;
    public string ManifestPath;      // repository-relative path to the authoritative tool.yaml
}

// the complete tool.yaml
sealed class ToolManifest
{
    public string Kind;              // must be "tool"
    public string FormatVersion;     // only "2" is accepted
    public string Id;
    public string DisplayName;
    public string Type;
    public string Description;
    public string Version;
    public string License;
    public string Author;
    public string Homepage;
    public string[] Tags;
    public string[] Provides;        // capabilities this tool offers
    public string[] Injects;         // capabilities any provider may satisfy
    public DependencyRef[] Dependencies;
    public Dictionary<string, ToolTarget> Targets;   // engine name -> target
    public string ReleasedAt;
    public bool Deprecated;
}

sealed class ToolTarget
{
    public string Engine;                            // the key in the map
    public Dictionary<string, string> Requirements;  // minEngineVersion mandatory, rest adapter-defined
    public string MinEngineVersion;                  // requirements.minEngineVersion
    public Dictionary<string, string> ExtraRequirements;  // remaining keys, handed to the adapter
    public ArtifactRef Artifact;                     // exactly one
}

sealed class DependencyRef
{
    public string Id;
    public string Version;           // constraint; omitted means any version
    public bool Optional;
    public string Reason;
    public string[] Engines;         // empty means all engines
}

sealed class ArtifactRef
{
    public string Type;              // archive | package | file | external
    public string Format;            // required unless external
    public string Path;              // required unless external, payloads/<id>/artifacts/...
    public long Size;                // required unless external
    public string Sha256;            // required unless external
    public string Source;            // external: git | http | npm
    public string Url;               // external
    public string Ref;               // external: a tag or a commit
    public string Subdirectory;      // external
    public string UpmPackageName;    // external
    public string Unpack;            // none | auto
    public string TargetPath;        // required for type: file
    public string ContentRoot;       // extraction target for an unpacked archive
    public string[] Files;           // human-readable install inventory
    public bool EditorOnly;
    public bool RestartRequired;
}
```

**Rejection rules that must run before anything is displayed:**

- `kind` is not `tool`, or `formatVersion` is not `2` → reject the tool and report "the import tool
  version is too old" (a v1 document is never read as v2);
- the `id` in the metadata disagrees with the directory it sits in → reject;
- `targets` is missing, or a target lacks `requirements` / `artifact` → reject;
- `artifact.type == "external"` while `url` or `ref` is missing → reject;
- `artifact.type` is not one of the four, or `type: file` has no `targetPath` → reject;
- a non-external artifact's `path` is not
  `payloads/<id>/artifacts/<id>-<version>[-<engine>].<ext>` → reject.

---

## 4. Version constraint solving

Comparison uses only the numeric triple; the pre-release suffix is ignored in ordering (see SPEC
§4.1).

```text
satisfies(version, constraint):
    no constraint      -> true
    ^1.2.3             -> version >= 1.2.3 and the same major
    ~1.2.3             -> version >= 1.2.3 and the same major.minor
    >=, >, <=, <       -> numeric comparison of the triple
    1.4.2 / =1.4.2     -> exact equality of the triple
```

Conflict policy: most tools publish only one version, so conflicts usually surface only at
**validation time**, as `E-DEP-VERSION`, and never at install time. If a future `formatVersion`
introduces multi-version metadata, the import tool should choose the **highest version that
satisfies all constraints on that id**; if none satisfies them, report "unresolvable conflict" and
**MUST NOT** guess.

**Engine floors are not version constraints**: `requirements.minEngineVersion`, `minRuntimeVersion`
and friends are compared by the adapter, and a failure must state "what was required, what the host
is, and which tool's target raised it".

---

## 5. Dependency and capability solving

```text
Resolve(requestedIds, engine, alsoEngines):
    resolved = {}                      # id -> manifest
    queue    = requestedIds

    while queue is not empty:
        id = queue.pop()
        if id already in resolved: continue
        manifest = FetchManifest(id)   # not found -> hard error "unknown tool"
        resolved[id] = manifest

        CheckRequirements(manifest, engine)   # no target for the engine, or a floor unmet -> hard error
        for dep in manifest.Dependencies:
            if dep.Engines is non-empty and engine not in it: continue
            if dep.Optional and dep.Id not in requestedIds: continue
            if dep.Id already in resolved: continue
            CheckConstraint(dep, registryLookup(dep.Id))   # not satisfied -> hard error
            queue.push(dep.Id)

    CheckCapabilities(resolved)   # see 5.2
    if HasCycle(resolved): throw CycleError(cycle path)
    return TopologicalOrder(resolved)  # dependencies before dependents
```

Rules:

- **Required** dependencies are always pulled in recursively; a dependency that lists `engines` only
  appears in the plan for those engines.
- **Optional** dependencies are resolved only when the user has already selected them; never pull
  them in proactively, and never let the install plan fail because of them.
- A cycle is a hard error and **MUST NOT** be broken automatically.
- The installation order is the topological order: dependencies before the tools that depend on them.
- A tool **MUST** have a target for the requested engine, otherwise report "this tool does not
  support <engine>". `--also-engine` may add another engine's target (installing one cross-engine
  tool into two engines at once), but the **primary** engine must be supported: installing another
  engine's bytes would be worse than refusing.

### 5.1 Requirement (engine floor) gating

```text
CheckRequirements(manifest, engine):
    target = manifest.Targets[engine]        # missing -> hard error
    adapter = adapters[engine]               # missing -> hard error "no adapter for this engine"
    if !adapter.meets(target.Requirements, host[engine])   -> PlatformMismatch(...)
```

The core compares no versions at all; comparison belongs to the adapter (on the Unity side it
compares `minEngineVersion` and `minRuntimeVersion`, the latter against the project's API
compatibility level). Host facts are declared by the caller: `--host-unity` / `--host-dotnet`, or
read from `<project>/ProjectSettings/ProjectVersion.txt` for the Unity version.
When neither is given, **floors are not enforced**, and the human-readable output says so explicitly.

### 5.2 Capabilities (`provides` / `injects`)

Dependency edges and capability edges are two separate accounts:

- a dependency edge pins an id and is solved recursively per §5;
- a capability edge only says "I need this name". **Any** tool in the plan that provides it
  satisfies it, so `installedBecause` records who provides for whom rather than a fixed dependency.

Note that the unit of conflict is **one install plan**, not the whole registry: a registry may contain
several tools providing one capability (they are alternatives, and `tools/registry.mjs` only
raises the `W-CAP-MULTIPLE` warning, which the front end should surface as a hint rather than an
error); only two providers inside one plan are a hard error.

```text
CheckCapabilities(resolved):
    for cap in every provides:
        if two tools in the plan provide the same cap -> hard error E-CAP-CONFLICT
    for cap in every injects:
        if nothing in the plan provides cap -> hard error E-CAP-UNSATISFIED
            (tell the user to select a provider too)
```

A malformed capability name (fewer than two segments, upper case, underscores, ...) is reported at
**validation time** as `E-CAP-FORMAT`.

---

## 6. Install plan and receipt

### 6.1 The plan (before anything is written)

```csharp
sealed class InstallPlan       { public PlannedTool[] Steps; }   // topological order
sealed class PlannedTool
{
    public string Id, Version;
    public string Engine;            // which engine this plan installs for
    public string ArtifactType;      // archive | package | file | external
    public string ArtifactFormat;    // engine or core container
    public string ArtifactPath;
    public long Size;
    public string Sha256;
    public string[] Files;           // shown in the confirmation panel
    public string ContentRoot;       // when an archive is unpacked
    public string TargetPath;        // for type: file
    public bool EditorOnly;
    public string[] InstalledBecause;  // the ids that need it, or "user"
}
```

The plan must be shown before execution, including the file list, so that anything unwanted is
stopped before it is written. `--dry-run` is the same computation with execution skipped.

### 6.2 Verification

For every step, before unpacking:

1. retrieve the artifact bytes;
2. `sha256(bytes) == artifact.sha256` — on mismatch, abort the entire plan and write nothing;
3. `len(bytes) == artifact.size` — same as above;
4. format check: `zip` must be `50 4b 03 04`, a gzip container (`tgz` / `tar.gz` / `unitypackage`)
   must be `1f 8b`, `tar.zst` must be `28 b5 2f fd`;
5. reject any archive entry that is an absolute path or contains `..` (zip-slip / tar-slip);
6. `file` has no container: only the digest and whether `targetPath` stays inside the project root
   are checked;
7. a `unitypackage` is opened by `providers/engine-unity`, which requires a `pathname` entry in
   every GUID folder and treats `asset`, `asset.meta` and `pathname` as a single unit.

A container declared with `unpack: none` is placed as-is at its `targetPath` instead of being
opened: one file is written, and its entries exist only after the engine's own asset pipeline
imports it. A `unitypackage` normally takes `auto` - the adapter opens it, so the tool is installed
by the import tool itself rather than by a manual import afterwards.

### 6.3 Receipt

Written after a successful install, so that uninstallation is exact; a cross-engine install writes
**one** receipt (a tool is one decision, and `installedEngines` records which engines were touched):

```yaml
# <ProjectRoot>/Library/ToolImport/receipts/editor-tool-selection-history.yaml
kind: receipt
formatVersion: '3'
toolId: editor-tool-selection-history
version: 1.0.0
artifactSha256: 6cb13d4a15d6a72345cf5232e61458a7194e97dc41a03056dfe248ae39f59ad5
artifactFormat: unitypackage
installedAtUtc: '2026-02-22T10:14:03Z'
registryRef: main
registryCommit: 073345b
installedEngines:
  - unity
installedFiles:
  - Assets/SelectionHistory/SelectionHistoryWindow.cs
installedByTools:
  - user
previousSha256: null        # version pointer: the digest this install replaced; null on a first install
```

Receipts live under `Library/`, a directory Unity never commits, so by construction they are local
state only.

Uninstall rules, decided by **directory ownership**:

- a file recorded in a receipt may be deleted only when **no other receipt still claims it**;
- a shared file (installed by a dependency) goes when the last dependent leaves;
- **the tool owns the directories it installed into**: everything written during an install is
  removed on uninstall, whether or not the user edited it since. That is not indifference - whether
  a change "counts as the user's" cannot be decided from the data, and a file left behind is
  residue, which a tool promising no pollution must not leave.

Damage from a user's own edits is the user's to own, and the tool does not take on repairing it, but
it **does provide the way back**: reinstalling overwrites with the original bytes, and install is
idempotent because it re-verifies the digest. So before removing anything, edited files are **listed
separately and confirmed once** - not to refuse the deletion, but so a destructive action does not
happen unseen. To keep a change, move it outside the tool's directories first.
  modification and ask for confirmation.

**Uninstall now executes, with these bounds:**

- **Uninstall really deletes.** `utool uninstall` prints the `delete` / `keep` (claimed by another
  receipt) lists and then removes the files (`--dry-run` prints the plan only). Three rules keep it
  from overreaching: a path must resolve inside the project, a file still claimed by another receipt
  is never removed, and a directory is removed **only when it is empty** — never `Assets` or
  `Assets/Editor`. Receipts are cleared last, so an interrupted run still leaves a record describing
  what is on disk.
- **A tool another installed tool depends on is refused by default.** If a tool that is *still
  installed* needs it, the uninstall is refused (exit code 2) and the dependents are named; `--force`
  proceeds anyway. The check reads `installedByTools` from the receipts — the relationship in *this*
  project — not the registry's "who might depend on this". A dependent that has already been removed
  no longer blocks, or the dependency would become permanently unremovable.
- **An orphaned dependency is reported, never removed automatically.** When the last tool needing a
  dependency goes, the tool prints "no longer needed by anything installed" with the command to remove
  it. A tool the user did not name never disappears because of an uninstall they did ask for.
  `utool status` also shows where each tool came from.
- **Rollback only reports the pointer; it does not execute.** `utool rollback` reads
  `previousSha256` and tells you "currently X, recorded previous Y" plus which bytes would have to be
  re-published. A superseded artifact is not guaranteed to still be published - a maintainer may
  delete it once nothing pins it - so the tool cannot assume it can fetch it: naming the exact
  digest is more honest than pretending the rollback is complete. The replaced artifact is
  normally no longer in the registry at all, so the tool **cannot** fetch it — reporting the exact
  digest is more honest than pretending to roll back.
- **An external source is never actually resolved.** The backend reports a `type: external` target as
  "resolved by the caller" and records `url` / `ref`; it does not clone or shallow-fetch anything.
  That step is likewise not implemented.

---

## 7. Obligations of the import tool

| # | Obligation |
| --- | --- |
| 1 | Never import a loose tree of files; import only sealed artifacts (`archive` / `package` / `file`) |
| 2 | Verify `sha256` and `size` of every non-external artifact, and check container magic bytes, before writing anything |
| 3 | Reject unsafe archive entries |
| 4 | Enforce the requested engine's target `requirements` (`minEngineVersion` is mandatory) |
| 5 | Resolve required dependencies recursively; never break cycles automatically |
| 6 | Solve `injects`: report a missing provider, never pretend it is satisfied |
| 7 | Show the install plan before executing (files, size, why each tool is included) |
| 8 | Write one receipt per installed tool; never delete another tool's files |
| 9 | Reject any `kind` / `formatVersion` / `artifact.type` it has not implemented, and say why |
| 10 | Surface a validation failure rather than working around it |

---

## 8. Backend CLI contract

The CLI is the backend's only external interface; the interface layer invokes it as a subprocess. The
default output is a human-readable table, `--json` emits a single JSON document, and `--records`
emits line-oriented TAB-separated records for the Unity front end. On failure it exits with a
non-zero code; in `--records` mode errors go to the record stream rather than stderr.

```text
utool list      [--registry <path|url>] [--json|--records] [--quiet]
utool show      <id> [--registry ...] [--json|--records]
utool plan      <id...> [--engine <name>] [--also-engine <name>]... [--host-unity <ver>] [--host-dotnet <ver>] [--registry ...] [--json|--records]
utool verify    <id...>  as above, verifying only, no writes
utool install   <id...> [--project <dir>] [--dry-run]   otherwise as above
utool uninstall <id...> --project <dir> [--dry-run] [--json]
utool rollback  <id...> --project <dir> [--json]
utool status    --project <dir> [--json|--records]
utool validate  [<registry>] [--no-hash] [--write-index] [--quiet] [--json|--records]
```

| Option | Meaning |
| --- | --- |
| `--registry <path\|url>` | registry location. When omitted it is **found**: the conventional `ToolRegistry/` near the working directory, or any directory holding both `index.yaml` and `payloads/` |
| `--mirror <url>` | add a **homogeneous mirror** host, repeatable, tried in the order given after `--registry`; also settable through `UTOOL_MIRROR` (comma or semicolon separated). See "Mirror hosts" below |
| `--project <dir>` | project root, default the current directory |
| `--engine <name>` | target engine, default `unity` |
| `--also-engine <name>` | additionally plan this engine's target; repeatable, for installing one cross-engine tool into two engines |
| `--host-unity <ver>` | declare the host Unity version (e.g. `2021.3.5f1`), enabling the floor gate |
| `--host-dotnet <ver>` | declare the host .NET API level (e.g. `4.6`, `6.0`), enabling the floor gate |
| `--auto-provider` | when a tool `injects` a capability nothing in the plan provides, select a provider for it. Off by **default**: silently adding a tool the user did not ask for is worse than explaining the gap. When enabled the choice is deterministic (lowest id wins) and the alternatives are listed |
| `--no-hash` | skip sha256 verification, comparing only size and container format. For constrained networks or debugging large artifacts; it must **not** be used for a production install |
| `--dry-run` | plan and verify only, write nothing |
| `--no-hash` | skip sha256 verification (size and format are still checked) |
| `--write-index` | regenerate `index.yaml` (validate only) |
| `--json` | one JSON document |
| `--records` | line-oriented records (TAB separated), for embedders |
| `--quiet` | suppress per-check output |

### Mirror hosts

A mirror is a **homogeneous** mirror: another host serving exactly the same directory layout. It
addresses "I cannot reach that address from here", not "that file is not there".

```text
utool install my-tool --registry https://primary.example/registry \
                      --mirror https://gitee.example/registry
```

```bash
# Less typing in CI: the environment variable. Comma or semicolon separated, order is priority
UTOOL_MIRROR=https://gitee.example/registry,https://backup.example/registry
```

There are three rules, and each one changes what you see while debugging:

1. **The next host is tried only when the previous one cannot be reached at all** (`E-NETWORK`: DNS
   failure, refused connection, timeout). A 404 and a malformed document are **not** outages — the
   registry answered, and asking a second host the same question cannot change the answer. Failing
   over anyway would turn a clear "missing file" into a slow, vague failure.
2. **`--registry` first, then each `--mirror` in the order given.** When both `--mirror` and
   `UTOOL_MIRROR` are set, `--mirror` wins: the environment does not quietly extend what the command
   line asked for.
3. **When every host is unreachable the error lists each host and its own reason**, rather than
   reporting only the first.

Mirrors are **not** declared in `index.yaml`. Which host you can reach is a property of your network,
not of the registry's data, and a registry able to nominate its own mirrors could redirect its readers
anywhere. For the same reason mirrors must be **explicit**: they are never tried automatically, so an
unreachable host is reported rather than silently swapped for a source the user never named.

When `--registry` is a local directory, supplying `--mirror` fails outright with `E-MIRROR-LOCAL`. A
directory is already reachable and exact; accepting a mirror here would imply the tool might substitute
remote content for a path the caller named deliberately.


**`--records` record types**: `META`, `TOOL`, `TARGET`, `DETAIL`, `DEPENDENCY`, `WILLINSTALL`,
`PROBLEM`, `PLANTOOL`, `PLANFILE`, `PLAN`, `INSTALLED`, `INSTALLEDFILE`, `SKIPPED`, `RESULT`,
`RECEIPT`, `WARNING`, `ERROR`. TAB / CR / LF inside a value are escaped, so a record is always
exactly one line.

The **`TARGET` record** (one per engine on `show`, so a multi-engine tool's floors and artifacts
are never flattened into one another):

```text
TARGET  <engine>  <minEngineVersion>  <other requirement keys as k=v, comma separated>  <type>  <format>
        <artifactPath>  <contentRoot>  <targetPath>  <editorOnly true|false>
        <external.url>  <external.ref>
```

Other key records:

```text
TOOL        <id> <version> <type> <engines csv> <provides csv> <injects csv>
            <displayName> <tags csv> <dependencies as id@version csv> <manifestPath>
DETAIL      id <id> / engines <csv> / provides <csv> / injects <csv> / ...
WILLINSTALL <file> <engine>
PROBLEM     <code> <message>
PLAN        tools <n> bytes <n> ok <true|false> dryRun <true|false>
```

`WILLINSTALL` reports the artifact's **declared** inventory
(`versions[].targets.<engine>.artifact.files`), one file per record. The file is field 0 and the
engine is an **appended** field: a reader that only ever looked at field 0 is unaffected, while a
front end that installs into one engine can show that engine's files alone instead of
concatenating two engines' lists - which would tell a Unity user that a Godot payload is about to
be written into `Assets`. An empty engine field means the inventory is not tied to one engine (an
older backend, or a caller that resolved no version); it is shown for any engine.

### The `--records` contract version

Every record stream begins with a `META` record declaring the contract version:

```text
META  recordsVersion  2
META  registry  <registry location>
```

**A reader should check the version before parsing anything else.** Putting it first means an
unrecognised stream can be rejected before a single value is interpreted out of it - which is what
turns "the format changed" from silently wrong data into a clear error.

| Version | Change |
| --- | --- |
| 1 | the original record set: `META`, `TOOL`, `TARGET`, `DETAIL`, `DEPENDENCY`, `WILLINSTALL`, `PROBLEM`, `PLANTOOL`, `PLANFILE`, `PLAN`, `INSTALLED`, `INSTALLEDFILE`, `SKIPPED`, `RESULT`, `RECEIPT`, `WARNING`, `ERROR` |
| 2 | adds `VERSIONS`: a tool may publish several versions, so each gets a record |

**Bump it for:** removing a record type, reordering fields, or changing what a field means - anything
a reader could misread. **Do not bump it for:** adding a new record type, or appending a field at the
end; a reader that keys on the types it knows is unaffected.

A missing version (an older backend) is **not an error**: versioning only ever added records, so a
reader keying on known types still works.

Exit code contract:

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | general failure (validation failed, artifact hash mismatch, etc.) |
| 2 | usage error |
| 3 | resolution failure (unknown tool, unsatisfiable constraint, cycle, no capability provider) |
| 4 | engine floor not met (Unity / .NET, or another adapter-defined requirement) |

Backend-side tooling codes (the backend's own codes, complementing those of
`tools/registry.mjs`): `E-TARGETS-MISSING`, `E-TARGET-REQUIREMENTS`, `E-ARTIFACT-TYPE`,
`E-ARTIFACT-TARGETPATH`, `E-ARTIFACT-FORMAT`, `E-ARTIFACT-FORMAT-UNSUPPORTED` (no adapter handles
the container), `E-CAP-FORMAT`, `E-CAP-CONFLICT`, `E-CAP-UNSATISFIED`, `E-UNINSTALL-FILE`.
Note the capability-name shape: the validator reports it as `E-SCHEMA`, while the Node
backend reports `E-CAP-FORMAT` — both enforce the same rule (SPEC R-CAP-2).

---

## 9. Error codes

Every code is in [`ERRORS.en.md`](ERRORS.en.md) - **the only place**, checked against the source
one by one. It is grouped by how you meet each code, and marks which ones appear only when
implementing an importer.

The one thing to remember while implementing: **an engine adapter returns `undefined` for a
requirement key it does not understand, never `false`**. The core reads `undefined` as "cannot
judge", so it **reports** the floor without enforcing it.

## 10. Portability

Nothing here is bound to a particular repository name, Git host or machine, because locations are
discovered at run time rather than hardcoded. The table states each guarantee and what makes it hold:

| Situation | Works? | Why |
| --- | --- | --- |
| The repository is renamed | yes | the registry tooling **scans sibling directories** for the importer rather than naming one, and the CLI's default registry is likewise found, not hardcoded |
| The Git host changes (GitHub to Gitee to self-hosted) | yes | the only place a host appears is inside `--registry <url>`; the GitHub URLs in the documentation are **examples**, not configuration |
| Local only, never pushed | yes | `--registry <local directory>` is a first-class use; a `git` remote is recognised in exactly one place and refused there (`E-SOURCE-GIT`) |
| Another machine or OS | yes | no absolute paths, drive letters or user directories in the code; receipts record only **project-relative paths** |
| The whole workspace moves to another drive | yes | as above; workspace links are rebuilt by `npm install` |
| The directory layout changes (no longer siblings) | yes, with one explicit setting | set `UTOOL_CORE` (registry tooling) or `--registry` (CLI) |

**One thing that is not guaranteed**: the `url` of an `external` artifact. It points at an *upstream*
repository, which is data rather than configuration for this tool. If upstream is renamed or
disappears that tool genuinely stops working, and that is worth saying plainly - but nothing here
quietly substitutes a different source.

**Why the defaults are discovered rather than named.** A directory name is not part of the contract.
The CLI's default was once hardcoded as `UnityDevCommonLib`, which had already been renamed to
`ToolRegistry`, so every command without an explicit `--registry` failed with a missing-index
error that had nothing to do with the real cause. Discovery has its own trap: `template/` also
contains an `index.yaml`, so a candidate directory must hold **both** `index.yaml` and `payloads/`.

## 11. Directory and repository boundary

`ToolImport/` is a sibling directory **alongside** this repository, located outside it, with its
own independent local git history.

| | ToolRegistry | ToolImport |
| --- | --- | --- |
| Responsibility | payload format and registry entries | the interface and backend for parsing, validation and installation |
| Backend layout | `schema/`, `payloads/`, `index.yaml` | `packages/utool-core` (engine-neutral), `providers/engine-unity` (the Unity adapter), `apps/cli`, `frontends/unity-editor` |
| Version control | any Git host; the address below is merely where it currently lives, not configuration this tool depends on | local git is enough; no remote required |
| When it changes | when a tool is released | while the tool is iterated on continuously |

The two sides communicate only through this file and `schema/tool.schema.json`, so either side can
be replaced as long as the contract does not change.
