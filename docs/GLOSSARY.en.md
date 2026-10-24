# Glossary

One word, one meaning. This fixes the vocabulary the registry and the import tool share, and
calls out the places where it is **easy to say the wrong thing** - similar names for different
concepts are the main source of drift between documents.

**Language**: [English](GLOSSARY.en.md) · [中文](GLOSSARY.zh-CN.md) · [back to index](../README.md)

---

## Core concepts

| Term | Meaning |
| --- | --- |
| **registry** | This repository. It holds **data only**: manifests and artifacts. It understands no engine and executes nothing. |
| **tool** | One installable unit in the registry, represented by one `payloads/<id>/` directory. |
| **manifest** | A tool's `tool.yaml`. Says who it is, what it needs, and which versions are published. |
| **artifact** | **The thing that actually gets imported**: a sealed container or a single file. The only binaries the registry allows. |
| **payload** | The `payloads/<id>/` **directory**. It names a location, not a file - the file is an **artifact**. |
| **index** | `index.yaml` at the repository root: a summary of every tool, so an importer reads it all in one request. |
| **receipt** | The record an install leaves behind: which files were written, and each one's digest. **The only basis for uninstalling.** |
| **import tool** | `ToolImport/`. It resolves, verifies and installs, and writes the receipt. |

**The most common mix-up: artifact vs payload.** A payload is a location (`payloads/`); an
artifact is the file inside it (`.../artifacts/x-1.0.0.unitypackage`). "Put the artifact in the
payload directory" is right; "download the payload" is not.

## Engine-related

| Term | Meaning |
| --- | --- |
| **engine** | A host such as Unity or Godot. The core knows **no** engine by name. |
| **target** | One version's data for **one** engine: its floors and its artifact. `versions[].targets.<engine>`. |
| **adapter** | An engine's implementation, on the import tool's side (`providers/engine-*`). It contributes container formats and floor comparison. |
| **core** | `packages/utool-core`: engine-neutral parsing, resolution, verification, installation. |
| **requirement key** | One key in a target's `requirements`, such as `minEngineVersion`. **Every key except `minEngineVersion` is defined by the adapter**; the core does not interpret them. |
| **container handler** | The hook an adapter registers with the core to open a proprietary format, such as `unitypackage`. |

**Easy to confuse: adapter vs front end.** An adapter lives in the import tool, is Node code,
and gives the core engine knowledge. A front end (`frontends/unity-editor`) is a **human**
interface. An engine can have an adapter with no front end.

## Dependencies and capabilities

| Term | Meaning |
| --- | --- |
| **dependency** | "I need **this tool**." Pinned by `id`; a path or URL is forbidden. |
| **capability** | A namespaced name such as `script.api.argument-guards`. At least two lowercase dot-separated segments. |
| **provides** | "I **can supply** this capability." |
| **injects** | "I **need** this capability; anyone may provide it." That is exactly what separates it from a dependency. |
| **provider** | An implementation of a capability. One capability may have several - they are **alternatives**, not a conflict. |

**A capability conflict exists only in a plan.** Several providers in the registry are a
**warning** (`W-CAP-MULTIPLE`) because they are alternatives. Two providers of one capability
inside **one project** is a hard error (`E-CAP-CONFLICT`), because the consumer cannot tell
which it received.

## Versions and status

| Term | Meaning |
| --- | --- |
| **version** | One published number, such as `1.0.0`. A tool may have several. |
| **latest** | The one installed by default when no version is named. It must be a genuinely published version. |
| **deprecated** | "Something newer exists; prefer it." **Still installable.** |
| **yanked** | "This release is broken or unsafe; **it must not be selected automatically**." A different thing from deprecated. |
| **constraint** | The version requirement written in a dependency, such as `^1.1.0`. |
| **floor** | The host's minimum, such as `minEngineVersion: '2020.3'`. Below it, installation is refused. |

**Deprecated is not yanked.** Deprecated advises; yanked forbids. A yanked release **stays
listed**, because an existing receipt may reference it.

## Artifact types

| Term | Meaning |
| --- | --- |
| **archive** | A general container the core **opens by itself**: `zip`, `tgz`, `tar.gz`, `tar.zst`. |
| **package** | A proprietary container only **an engine's adapter** can open, such as `unitypackage`. |
| **file** | A single-file artifact with no container: a dll, a shader, a licence. Needs `targetPath`. |
| **external** | **No artifact is stored here**; the manifest records where it lives (`url` + `ref`). |

**The distinction that matters: archive vs package.** The first is core knowledge, the second
is engine knowledge. `unitypackage` is a package, not an archive - which is why the word
appears nowhere in the core's code.

## Say this, not that

| Not this | This |
| --- | --- |
| package, bundle (when you mean the file) | **artifact** |
| metadata (when you mean the manifest) | **manifest** |
| installer, package | **artifact** (or name the type: a container) |
| plugin library, tool collection | **registry** |
| importer program | **import tool** |
| dependency package | **dependency** |
| version lock | **constraint** |
