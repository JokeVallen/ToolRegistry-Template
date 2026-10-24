# Templates

Canonical skeletons for every `.yaml` document this registry uses, at
**formatVersion 2**. Copy the relevant one and follow the `HOW TO FILL THIS IN`
comment inside it.

| Template | Goes to | Purpose |
| --- | --- | --- |
| `tool.bundled.yaml` | `payloads/<id>/tool.yaml` | Tool whose artifacts are stored here. Shows a two-engine layout; delete a target you do not need. |
| `tool.external.yaml` | `payloads/<id>/tool.yaml` | Metadata-only tool, resolved from a git remote |
| `index.yaml` | `<repo>/index.yaml` | Generated catalog (do not hand-edit) |
| `receipt.yaml` | `<project>/Library/ToolImport/receipts/<id>.yaml` | Written by the import tool after a successful install |

## Why templates are committed

The `.yaml` format is a contract shared by three parties: this registry, the Node
core of the import tool, and the engine front ends. Templates keep all three
honest — a new tool starts from a document that already parses, already validates,
and already carries the minimum required attribute set.

They are also the fastest answer to "what fields exist?". Read the template before
reading the spec; read the spec when you need the exact rule.

## The one field you cannot guess

Every target must state `requirements.minEngineVersion`. The core cannot know how
to compare a Godot version against a Unity one, so that comparison belongs to each
engine's adapter — but it can insist that a floor exists, because "field absent"
and "forgot to fill it in" are indistinguishable in data.
