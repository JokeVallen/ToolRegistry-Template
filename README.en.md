# Registry starter

The template repository for the [ToolRegistry](https://github.com/JokeVallen/ToolImport) data format: the smallest
registry that already works, and that you are meant to edit. **Open `index.html` first** - it
walks through the environment, the matching import tool, validation, and the first install.

## What is here

```text
index.yaml              the catalog (generated, never hand-edited)
payloads/example-hello/ one real tool: validates, plans and installs
schema/                 the validation source
tools/                  registry.mjs and four offline pages (validate / editor / guide / workbench)
template/               yaml skeletons
docs/                   format spec and friends
index.html              the single entry: four doors (guide / validate / write / check)
START-HERE.html         the offline onboarding page - seven steps in order
```

## Three commands

```pwsh
node tools/registry.mjs validate        # validate the whole registry
node tools/registry.mjs write-index     # regenerate index.yaml after changing a payload
node tools/registry.mjs check-index     # CI: is the catalog stale?
```

The validator lives in the import tool. Keep the two repositories side by side and it is found
automatically; otherwise set `UTOOL_CORE`.

## Matching import tool

This template is written for **ToolImport 1.2.2**:
<https://github.com/JokeVallen/ToolImport/releases/tag/v1.2.2>

## The example tool

`payloads/example-hello` is a one-file Godot tool that really installs. Copy it, rename it, replace
the contents - that is your first tool.

## License

MIT. See `LICENSE`.
