# Registry 起步包 / Registry starter

这是 [ToolRegistry](https://github.com/JokeVallen/ToolImport) 数据格式的**模板仓库**：一份可以直接用、也可以直接改成你自己
Registry 的最小集合。**先双击 `START-HERE.html`**，它按顺序带你走完环境、安装、校验、装第一个工具。

A starter registry for the ToolRegistry format. **Open `START-HERE.html` first**: it walks you
through setup, the matching import tool release, validation and the first install.

## 这里有什么 / What is here

```text
index.yaml              目录（自动生成，不手改）
payloads/example-hello/ 一个可校验、可规划、可安装的示例工具
schema/                 校验依据
tools/                  registry.mjs 与三个离线页面
template/               骨架 yaml
docs/                   格式规范等文档
START-HERE.html         离线引导（第一个该打开的文件）
```

## 三条命令 / Three commands

```pwsh
node tools/registry.mjs validate        # 校验整份注册库
node tools/registry.mjs write-index     # 改过 payload 之后重新生成 index.yaml
node tools/registry.mjs check-index     # CI：只检查目录是否过期
```

需要 **Node.js 22.15 以上**（导入工具用了 22.15 才有的 zstd 解压）与 git。校验器在导入工具里。
两个仓库放成同级目录即可自动发现；否则设 `UTOOL_CORE`。

Requires **Node.js 22.15 or newer** (the import tool uses the zstd support added in 22.15) and
git. The validator lives in the import tool: keep the two repositories side by side, or set
`UTOOL_CORE`.

## 配对的导入工具 / Matching import tool

本模板对应 **ToolImport 1.2.2**：<https://github.com/JokeVallen/ToolImport/releases/tag/v1.2.2>

This template is written for **ToolImport 1.2.2**.

## 示例工具 / The example tool

`payloads/example-hello` 是一个真的能装进 Godot 工程的单文件工具。第一次跑通之后，复制它、改掉
id 与内容，就是你的第一个工具。

`payloads/example-hello` is a real one-file Godot tool. Copy it, rename it, replace the contents.

## 许可 / License

MIT。见 `LICENSE`。
