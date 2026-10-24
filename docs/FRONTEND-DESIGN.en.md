# Editor Front-End Design

> For anyone iterating on the editor front end. It records **why** the design is what it
> is, **what is promised**, **what may change**, and **where the boundaries are**.
> Read sections 2 and 6 before changing anything.

## 1. What this front end is

A Unity editor window: browse the registry, review an install plan, install and uninstall.

The backend is a Node CLI (`utool`). The front end **displays and forwards only**; it
contains no format logic.

## 2. One non-negotiable division of labour

**Every judgement that can be wrong lives in Node. The front end makes none.**

| Judgement | Owner |
| --- | --- |
| Parse `.yaml`, validate the schema | backend |
| Resolve dependencies, pick versions, detect cycles | backend |
| Verify sha256, decide install order | backend |
| Write receipts, count references, define uninstall bounds | backend |
| Draw the UI, collect clicks, show results | front end |

**Why**: a Unity project with a compile error loads **no editor assembly**, so this window
**cannot open at all**. It therefore must not hold any critical responsibility — otherwise
"the project does not compile" would also mean "the tool cannot repair the project". The
command line always works, and that escape route is deliberate.

> Corollary: the front end must **never** read `.yaml` itself, compute a hash, or guess a
> dependency. When it needs new information, the backend emits another record.

## 3. The front-end/backend contract

The front end uses `--records`, not JSON: `UnityEngine.JsonUtility` **cannot deserialise a
root-level array**, and hand-writing a JSON parser in the editor would redo the backend's
work with more ways to get it wrong.

Format: `TYPE \t field \t field ... \n`, with TAB/CR/LF escaped. The first record is
`META recordsVersion <n>`, so a reader can tell whether it understands the stream.

Records the front end consumes:

| record | used for |
| --- | --- |
| `META recordsVersion` | contract version |
| `TOOL` | the tool list (`list`) |
| `VERSIONS` | which versions a tool publishes |
| `TARGET` | per engine: floors and artifact type |
| `DETAIL` / `DEPENDENCY` / `WILLINSTALL` | detail pane (`show`) |
| `PLANTOOL` / `PLANFILE` / `PLAN` | the plan and its verification (`plan`) |
| `INSTALLED` / `INSTALLEDFILE` | install outcome |
| `REMOVED` / `REMOVEDDIR` / `RECEIPTREMOVED` | uninstall outcome |
| `RECEIPT` | what is installed (`status`) |
| `PROBLEM` / `ERROR` | why something failed |

**Reordering fields breaks the contract.** Appending a field or adding a record type is
safe (an older front end ignores it); removing or reordering requires bumping
`recordsVersion` and updating the note in `apps/cli/lib/records.js`.

**A mistake made here once**: `PLAN` packs several key/value pairs into **one** record
(`PLAN tools 2 bytes 2968 ok true`), it is not `RESULT key value`. Matching on "the first
field equals ok" never matched, so **a verified plan displayed as "could not be
verified"**. Read this shape as key/value pairs; never assume a position.

## 4. Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [Refresh] [Registry: ToolRegistry] [Settings...] [search] │
├────────────────────────┬─────────────┬───────────────────────┤
│ [All ▾]            3/5 │             │ Tool Name  [installed] │
│ ══════════════════════ │             │ id (copyable)          │
│ ● Guard Utils    1.1.0 │             │ version • type         │
│ ○ Selection History    │             │ Homepage Doc Notes MIT │
│                        │             │ Engines                │
│                        │             │   - unity              │
│                        │             │ Provides               │
│                        │             │   - script.api.x       │
│                        │             │ Dependencies (jump)    │
├────────────────────────┴─────────────┴───────────────────────┤
│ Install into [________________] [Default]                     │
│ [Verify and plan] [Install] [Uninstall...]                   │
└──────────────────────────────────────────────────────────────┘
statusMessage
```

- **toolbar**: refresh, a **read-only** registry indicator (click it to open settings), a
  settings entry point, and search
- **left column**: a right-aligned collapse control, the filter on one row (plus a value
  row when the mode takes one), a separator, then the tool list; **right-click a row** for
  its versions
- **collapsed left column**: a narrow rail holding only the button that restores it, left
  where the list was, so the control that reverses an action sits where the action happened
- **vertical rule** between the list and the details
- **right column**: details, with the links (`Homepage`, `Documentation`, `Release notes`,
  and the licence by **name only** — `MIT`, not `License: MIT`) on one row under the
  identity block
- **install destination** sits directly above the action buttons, where the consequence of
  changing it is visible: the plan it invalidates is right there
- row prefix: `●` installed / `○` not installed; `[no unity]` means this engine is unsupported

**The count appears exactly once** (in the filter row). It used to appear at the toolbar's
right end, again beside the filter, and a third time in the status line — the same number
three times, which reads as three separate facts. **The status line reports the outcome of
an action, not state that is already on screen.**

**Why search is in the toolbar and the filter is not**: a search box is what people look
for in a toolbar; a filter reads as a heading over the list it affects. The difference is
deliberate.

**Why a row is not a Button**: a Button draws its text **centred** with padding, so short
and long names started at different x positions and read as a ragged block. Every name in
a list must start at the same left edge.

**The selection highlight has to be drawn explicitly.** The selected style once copied
`EditorStyles.label.onNormal.background` — and a plain label has **no** background in its
on state, so it copied `null` and the selected row was **pixel-identical** to every other
row. Clicking a tool genuinely looked like it did nothing. Rows now reserve their rect, fill
it, then draw the text, which **depends on no style internals** and so cannot silently
regress the same way.

### 4.1 Settings live in their own window

Configuration (registry location, CLI path, Node path) sits in a **separate window**; the
toolbar keeps a read-only indicator and one entry point.

**Why**: configuration competed with the tool list for horizontal room, and every future
setting would compete again. Separated, **a new setting cannot disturb the main layout at
all**.

Paths are stored in `EditorPrefs` — **per user, per machine**, never in the project: a path
to a checkout is a property of the machine, and committing it would break every other
developer.

The settings window **shows what the automatic resolution currently finds**, so "empty means
automatic" is verifiable rather than a guess.


### 4.1 Readability rules for the details pane

| rule | how |
| --- | --- |
| copyable values must be copyable | id, URL, hash, path use `SelectableLabel` |
| multiple values are a **list**, not a row | `Engines`/`Provides`/`Injects`/`Tags` are a header plus one multi-line `- value` block. Chips were tried and removed: a capability name is longer than the gap between two chips, so they wrapped mid-token and read as one string. The lines share ONE label rather than one control each: a vertical layout separates every control, so five items became five paragraphs |
| clickable things must be clickable | homepage, documentation, release notes and licence are **links** with the **destination as the tooltip**, separated by `·`; the licence shows its **name only** — in a row of four links a `License:` prefix reads as a labelled field; dependencies are clickable rows, with the first one selected by default |
| a scrollable region must show something | the dependency list gets an explicit height, because inside the details scroll view `ExpandHeight` has nothing to expand into; the plan's long paths sit in a **horizontal** scroll view, since clipping cuts off the file name |
| focusable things must show it | the search field sets a **text cursor**; links set a **link cursor** |
| empty values are still shown | `- (none)` rather than omitting the section — "nothing" is information |
| constraints in plain words | `^1.1.0` → `1.1.0 or newer (same major)` |
| regions must be visible | separators between toolbar / list / details / actions |
| the destination is visible before writing | an `Install Into` header plus field above the buttons, empty meaning "as the manifest declares"; the empty state is written **inside the field** and the full rule is the header's **tooltip**; `Browse...` names a folder with the panel and converts it to a project-relative path |
| the declared inventory and the plan are not both drawn | with a valid plan on screen, `Installs N file(s)` is hidden: the plan lists the final destinations (dependencies included, `--into` applied) while the declared list is only a promise. Without a plan, the declared list is the preview |
| a moved tool is reported | after an uninstall whose recorded files were all gone, the status line names the directory that is no longer there instead of reporting "0 files removed" |

### 4.2 Search

Case-insensitive **substring** match on the **display name**.

It matches the display name **only** — not id, type, tags or provides. The reason is a real
report: typing `s` returned `gITF Importer`, because its **id is `libs-gltf-importer`**. The
match was real but the id is not on screen, and **matching something the user cannot see is
indistinguishable from a bug**. Filtering tags and capabilities gets its own control (4.3),
which states what it is filtering on.

**Why there is no debounce: there is nothing to debounce.**

Filtering is a substring scan over a few short in-memory strings; it costs **microseconds**.
A debounce would add a timer, a repaint dependency, and a frame of lag, in order to hide a
cost that does not exist.

What actually matters is **not recomputing every frame** (see 4.4), and the trigger for
that is a **measured cost**, not the fact that the user is typing.

**Why there is no debounce: there is nothing to debounce.**

Filtering is a substring scan over a few short in-memory strings; it costs **microseconds**.
A debounce would add a timer, a repaint dependency, and a frame of lag, in order to hide a
cost that does not exist.

What actually matters is **not recomputing every frame** (see 4.4), and the trigger for
that is a **measured cost**, not the fact that the user is typing.

### 4.3 Filtering

A `Show:` dropdown. The first four are fixed subsets:

| option | meaning |
| --- | --- |
| All | everything |
| Installed | installed in this project |
| Not installed | the rest |
| This engine | tools declaring a target for this engine |

The last four each take a **value**, chosen in a second dropdown: `Tag is`, `Provides`,
`Injects`, `Depends on`.

**Why a dropdown rather than several independent toggles**: two toggles can both be on,
producing "installed and not installed", which means nothing and leaves the user to work
out which combination they are in. **One choice cannot contradict itself.**

**Why the value list is collected from the listing, not typed**: the second dropdown can
only offer values that exist, so a typo cannot silently produce an empty list. That is the
same failure the backend's `--provides` hint exists to prevent, and a front end already
holding the listing needs no round trip to avoid it.

**`Depends on` is the reverse lookup.** It answers "what would break if I removed this",
which the listing can answer because `TOOL` carries each tool's dependency ids.

Capability and tag matching is **per element, not substring**: the tag `editor` must not
select a tool tagged `editor-tool`. A substring match would be defensible in the data and
wrong on screen — the same failure shape as a search that matches an id the user cannot see.

`This engine` only asks whether a target exists for this engine. It says nothing about
whether the artifact can be **installed** — that needs the `TARGET` record's artifact type,
which would cost one `show` call per tool.

### 4.3a Version selection

A tool may publish several releases. The choice lives **on the tool row**: right-clicking a row
opens its releases under a first-level **`Versions`** submenu. That is the only control.

- **Why a submenu rather than a flat menu.** The row menu is where every per-tool action belongs.
  Spreading the versions across the top level spends the whole menu on one decision, and the next
  action (uninstall, copy the id, open the receipt) then has to be squeezed in beside them or
  reshuffles the list every time one is added. One `Versions` entry leaves that room structurally,
  rather than by choosing a sort order.
- **Why the row and not the description.** The description is *per release* — it changes when
  the version does — so a version list inside it sat under text that the click was about to
  replace. Choosing a release is choosing which tool record to look at, so it belongs beside
  the record's name.
- **Why a menu and only a menu.** An inline list under the row was tried and removed: it
  duplicated the menu, grew the list column unpredictably, and put a per-release control in a
  column that describes tools rather than releases. A right-click is one gesture and it is
  where a user who has used a file list looks first — so the window says the gesture out loud
  (below) instead of adding a second control.
- **The menu carries both facts.** A check mark is the **pinned** release; ` • installed` marks
  the release actually in the project. They differ exactly when an update is available, which
  is when the distinction matters: "selected" alone would make the checked entry look installed.
- The pin is stored as **`id@version`**, and belongs to the tool it was chosen for.
  Selecting a different tool drops it, because `0.9.0` means nothing for a tool that never
  published one.
- The details are **re-fetched for the pinned release**, since descriptions, floors and
  artifacts can differ between versions. Showing latest's metadata beside a plan for an
  older release would be worse than showing nothing.
- `show`, `plan` and `install` are all given the pinned reference, so the release that was
  described is the release that gets written.
- It lives in `SessionState` like the selection, so a recompile cannot silently move the
  user from the version they chose back to latest.

**The gesture is named.** A context menu has no visible affordance, so the header names it for the
case that needs it: a tool installed behind `latest` says which release would update it. **"N
versions published" was removed**: it stated a count and then a gesture the menu already carries,
and it spent a line on every tool that has more than one release.

**One backend call at a time, and the waiting one is the newest.** The pane can only show one
release, so a request made while another is running waits, and a **new request replaces the waiting
one** — otherwise the pin has moved while the screen still shows the previous release (that is
"choose 0.9.0 and see 1.0.0"). A superseded request must not paint its stale result afterwards.

**The installed release is named too.** "Installed" cannot answer the question a version
selector raises: installed **at which version**. The badge reads `installed 1.0.0`, the menu
marks that release, and when the installed one is not `latest` the header says so outright
instead of leaving the user to compare two numbers in different places.

**Release notes are a link, not a panel.** Changelogs are maintained *after* publication, so a
copy inside the registry is stale exactly when someone is deciding whether to upgrade; and a
front end cannot render notes it has no data for. `releaseNotes` is a URI, and the window shows
only a `Release notes` link. `What changed` is gone for the same reason — it was the one place
in the tool that would rather show you an old copy than the source.

### 4.4 Performance

IMGUI **repaints on every mouse move**, so per-frame cost is multiplied. What is done:

- **The filtered list is computed once per frame, and only recomputed when its inputs
  change.** The toolbar (for the count) and the list used to each call `VisibleTools()`, so
  every repaint filtered the whole registry twice and allocated two lists. It is now built
  once per `OnGUI`, cached against (search text, filter, **filter value**, tool count).
  The filter value is part of the key because changing only the value — `editor` to
  `workflow` — would otherwise leave a stale list on screen, the mode having not changed.
- **A change to the installed set invalidates that cache**, or a freshly installed tool
  would not appear under `Installed`.

**A known, deliberate trade-off**: rows are drawn with explicit rects rather than
`GUILayout.Toggle`, so each row builds a `GUIContent` on every repaint. With **tens** of
tools that is fine. At **thousands**, virtual scrolling (draw only visible rows) becomes
worth doing — and the trigger then is a **measured count**, not a precaution.

**State is serialised, not concurrent**: `Run` uses **one** `busy` flag to serialise all
backend calls. That is deliberate (no concurrent writes to one project), but **callers must
queue themselves** — see 4.5.

### 4.5 The calling convention that single flag imposes

`Run` holds a `busy` flag and **returns immediately, doing nothing, while it is set**.

**This took two attempts to fix, and the first diagnosis was wrong** — worth recording.

The first diagnosis was that `OnEnable` made two calls side by side
(`RefreshInstalled()` then `Refresh()`) and they collided. Sequencing them through a
callback did **not** fix the symptom.

The real cause is subtler: **the callback runs inside `Run`, while `busy` is still true**.
`busy = false` sits in the `finally`, and `onSuccess(records)` comes **before** it. So
starting another call from a callback — whether written as a callback or side by side — is
**dropped the same way**. A new shape, the same collision.

**The convention**:

1. **Never start a call while another is in flight.** To sequence work, use
   `QueueCommand(...)`, which defers it to the `finally` — the first moment `busy` is
   actually clear.
2. **Disable controls while busy**, or clicks vanish silently. Rows are disabled while
   busy: **a click that does nothing is worse than a click that is visibly unavailable.**
3. The queue is a **single slot**: a burst of clicks keeps only the newest, because earlier
   requests are stale by the time they would run.

```csharp
// right: deferred to the finally
QueueCommand(() => RefreshInstalled());

// wrong: called from a callback -- busy is still set, so it is dropped
RefreshInstalled();
```

### 4.3 Settled interaction constraints

- **The engine selector is gone.** This window **is** the Unity editor, and the selector
  once allowed a Godot plugin to be installed into a Unity project (the backend is
  engine-agnostic and accepted it). **A UI may only offer what it can honour.**
- **An unsupported tool cannot be installed.** For an `external`/git target the backend
  reports without resolving, so installing would "succeed" while writing nothing.
  `Verify and plan` and `Install` are therefore **disabled**, with a prominent explanation
  (a `Warning`, not `Info`) both in the detail pane and above the buttons.
  **`Uninstall` is deliberately NOT disabled** — something already installed must always be
  removable, or the user is trapped with files they cannot get rid of.
- **Targets shows this engine only.** Other engines are stated factually but not offered:
  `Also ships a target for: godot (not installable here)`. Hiding them entirely would
  contradict `utool show` output, and a user would then trust neither.
- **Uninstall is enabled only when installed.** Otherwise the button is disabled and reads
  `Uninstall (not installed)`. A clickable button whose only outcome is an error reads as
  "the tool is broken" rather than "this was never installed".
- **The listing is cached per session.** Unity destroys an `EditorWindow` on close, so
  without a cache every reopen demands Refresh → re-select → re-Verify. `Refresh` still
  re-reads on demand, and **a failed refresh must not replace a good listing with an empty
  one**.
- **Destructive actions need confirmation** that states the consequence (one dialog each for
  install and uninstall).
- **An empty list distinguishes the two kinds of empty**: "the registry has no tools" and
  "nothing matches the current search or filter" have different causes and different fixes.

## 5. Styling and UI framework

**Today: IMGUI (`EditorGUILayout`).** Reasons: no dependencies, one file, no build step,
consistent behaviour across Unity versions.

**Recorded direction: UIToolkit (UIElements).** Raised during iteration, and the reasoning
holds — better performance (retained mode, no control-tree rebuild), better styling (USS),
stronger layout.

**The migration is not free**, and the cost comes first:

| item | impact |
| --- | --- |
| The whole window is rewritten | ~700 lines, with logic and display currently interleaved |
| Version floor | `minEngineVersion` is `2019.4` today; UIElements is comfortably stable from 2021+ |
| Testing changes | it relies on type-checking plus behaviour tests; UIElements needs a new approach |

**Recommended path** (do not start before step 1):

1. **Separate logic from display first** — `BackendRecords` is already pure logic with
   **executable tests**; keep pulling state apart from rendering;
2. then swap the rendering layer, at which point the framework change is low-risk.

> No timeline is promised. This is a direction with an explicit precondition, not a to-do.

## 6. Target version and scope (this is the promise)

**Stable target: `v1.0` — the current feature set frozen; fixes only afterwards.**

`v1.0` includes (**all implemented and tested**):

- browse the registry, inspect a tool's details and dependencies
- resolve dependencies and produce an install plan
- verify an artifact (size + sha256) before anything is written
- install and uninstall, with receipts, reference counting and empty-directory cleanup
- refuse by default to uninstall a tool another installed tool depends on; `--force` overrides
- report an orphaned dependency without removing it automatically

**Explicitly outside `v1.0`** (written down rather than glossed over):

| item | status |
| --- | --- |
| Actually cloning `external` / git sources | **not implemented**; the UI **disables** it and says why |
| Rollback actually restoring bytes | **not implemented**; reports the pointer only |
| UIToolkit migration | **not doing it**; compatibility first, IMGUI continues |
| User-overridable install location | **v1.1** (below) |
| Front ends for other engines | backend supports it; only Unity ships |

**Will features be added after `v1.0`?** Yes, under one rule: **additive only**. New record
types, new optional fields and new engine adapters are allowed; changing existing semantics
requires a new major version.

### 6.1 Roadmap (a route, not dated promises)

**`v1.0` — a shaped UI, and an honest presentation of what works**

- three-part layout: toolbar row / list on the left / details on the right
- the list shows **installed state**, with an installed-only filter
- **search** (id, display name, tag)
- a tool that is not installed: Uninstall disabled
- **unsupported tools (`external`/git) cannot be installed**, with the reason shown plainly
  in the detail pane
- loading / empty / failed are all shown explicitly

> The test: **anything in the UI that cannot be used must make clear why.**

**`v1.1` — override the install location**

- a tool declares a **suggested** location (e.g. plugins suggest `Assets/Plugins`)
- the user may **override** it per project or per tool; the override is project-local config
  and never written back to the registry
- the receipt records the **actual** location, so uninstall stays exact
- requires rebuilding unitypackage artifacts into a relocatable shape (see 6.2)

**`v1.2` — provenance and updates**

- an installed tool shows **current vs available version**, and can be updated
- `status` exposes the version pointer so update history is visible

**`v2.0` (provisional, not promised)**

- git / `external` sources actually resolved
- rollback actually restoring bytes
- UIToolkit (by then the Unity floor will likely have risen, and the precondition is that
  logic and rendering are already separated)

### 6.2 Who owns the install path: implemented

**The user was right**: project layout varies by project, and a tool must not unilaterally pin it.
Implementing it changed the sketch in three places:

| the sketch | what it does now | why |
| --- | --- | --- |
| a new `suggestedRoot` field | no new field: `contentRoot` / `targetPath` **are** the suggestion | a declared root is a second source of truth; the moment it disagrees with where entries land, files are written outside the directory the user chose |
| the manifest names the root | the root is **derived** from the landed paths (their common directory) | same reason: the only fact that cannot be wrong is where the files go |
| a `unitypackage` **cannot** be relocated | it **can**: the adapter reports each `pathname` and writes through the core's write context, so the rewrite happens in one place | the destination is baked in at build time, but the *write* still asks the core where it goes |

What it does:

1. **Default follows the manifest.** With nothing typed, the behaviour is exactly what it was.
2. **The user may override** (`utool install --into <dir>`, or the `Install into` field above the
   buttons). The override replaces that root and **keeps the structure below it**.
3. The receipt records the **actual** root (`installedRoots`), so uninstall and reference counting
   need no further instruction.
4. It applies to the **tool that was asked for**; a dependency keeps its own layout. `--into`
   therefore requires exactly one id.
5. A path outside that root is **refused** (`E-INSTALL-ROOT`, nothing written) instead of being
   placed wherever the prefix arithmetic lands.
6. An unusable override (empty, absolute, drive letter, `..`) fails as `E-INSTALL-INTO` **before**
   any artifact is fetched.

> The test is unchanged: **relocate when it is safe, refuse clearly when it is not.** The worst
> outcome is an override the user believes took effect and did not.
>
> The other half is now covered too: when a tool's directory was **moved after installing**, every
> recorded path is gone, so the uninstall "succeeds" and removes nothing. That case names the
> directory that is no longer there (`MOVEDROOT`) and still **does not delete it** — a dragged-away
> directory and a directory the user created are indistinguishable in the data.

## 7. Relationship to UPM (straight answer first)

**UPM is the official, more mature option and covers part of what this tool does.** If a
need falls entirely in the "UPM can" column below, **use UPM**.

| capability | UPM | this tool |
| --- | --- | --- |
| Install from a git URL | ✅ native | ⚠️ reports `external`, does not clone |
| Install from a local folder / tarball | ✅ | ✅ |
| Dependency declaration and resolution | ✅ full semver | ✅ plus capability injection |
| Version ranges | ✅ | ✅ |
| **Engines other than Unity** | ❌ Unity-specific | ✅ Godot from one source tree |
| **Share runtime source across two engines** | ❌ | ✅ the same C# |
| **Arbitrary artifact shapes** | ⚠️ mainly package folders | ✅ unitypackage / tgz / bare dll / external |
| **Capability-level dependencies** (`injects` / `provides`) | ❌ | ✅ |
| **Byte-level verification before install** | ⚠️ hashes exist, not in this form | ✅ size + sha256, refuse on mismatch |
| **Exact uninstall** | ⚠️ removes the package folder | ✅ receipts plus reference counting |
| **Engine/runtime floors** | ⚠️ limited | ✅ three-valued (cannot judge = report, not block) |

**Conclusion (no sales pitch):**

- If you are **Unity-only and use standard packages**, UPM is better. It is free, official,
  and has no Node backend to depend on.
- This tool's value proposition is exactly four things: **cross-engine, capability-level
  dependencies, pre-install verification, exact uninstall**. If none of those matter to you,
  **use UPM**.
- This tool does **not** compete with UPM. The `upmPackageName` field on `external` entries
  such as `libs-gltf-importer` shows the intended relationship: the registry can **point at**
  a UPM package rather than replace it.

> Stated plainly: this tool is **less** mature than UPM in many ways — no official support,
> little large-scale validation, and a C# front end that **has never run in a real Unity
> editor** (see section 8). Treat it as a targeted supplement, not a replacement.

## 8. Verified / unverified (please relay this honestly)

| item | status |
| --- | --- |
| Node backend: install, uninstall, dependencies, verification | ✅ exercised for real |
| Registry validation, payload compile check | ✅ CI-grade |
| C# front end: **type-check plus record-parsing behaviour** | ✅ automated |
| Windows + Unity `2021.3.45f1c2`: install and uninstall | ✅ confirmed |
| **Full front-end interaction inside a real Unity editor** | ⚠️ no Unity available; not verified item by item |

The meaning of the last row: **the window opening, listing, installing and uninstalling has
been confirmed by the user**; but a UIToolkit migration or a new interaction pattern must be
verified on a real editor before it can be called done.

## 9. Change checklist

Before changing the front end:

- [ ] Is the logic in the backend? Is the front end displaying only?
- [ ] Is a new field appended or reordered? Reordering requires bumping `recordsVersion`
- [ ] Does it offer only operations this engine can honour?
- [ ] Does a destructive action confirm and state its consequence?
- [ ] Are the empty / failed / not-installed states all shown explicitly rather than silently?
- [ ] Does `npm run check:csharp` pass (type-check plus record-parsing behaviour tests)?

## 10. Key files

| file | role |
| --- | --- |
| `frontends/unity-editor/Editor/ImportToolWindow.cs` | window and interaction |
| `frontends/unity-editor/Editor/CliRunner.cs` | invokes the backend, locates the CLI |
| `frontends/unity-editor/Editor/BackendRecords.cs` | parses the record stream (pure, testable) |
| `tools/csharp-check/BehaviourTests.cs` | behaviour tests for record parsing |
| `apps/cli/lib/records.js` | the **authoritative** contract definition |
