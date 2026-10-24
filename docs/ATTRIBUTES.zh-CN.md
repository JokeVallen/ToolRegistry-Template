<!-- 自动生成，请勿手改。运行 npm run gen:attributes -->

# 属性参考

**语言**：[中文](ATTRIBUTES.zh-CN.md) · [English](ATTRIBUTES.en.md) · [返回目录](../README.md)

本文件由 `schema/tool.schema.json` **自动生成**（`npm run gen:attributes`），因此不可能与校验器
不一致——手写的字段说明迟早会漂移，而写错速查表比没有速查表更糟。

要查某个字段该填什么，看这里；要看格式的完整规则，看 [`SPEC.zh-CN.md`](SPEC.zh-CN.md)；
要按步骤提交一个工具，看 [`CONTRIBUTING.zh-CN.md`](CONTRIBUTING.zh-CN.md)。

---

## 顶层字段

| 字段 | 类型 | | 说明 |
| --- | --- | --- | --- |
| `kind` | string | **必填** | 文档判别器。它回答的是「这个文件是什么」，而不是「这个文件里是什么」。每个注册库文档都带一个，使读方在继续解析之前就知道该按哪种形状读：`tool`、`index` 或 `receipt`。你自己写的工具元信息，这一行永远是 `tool`——`index` 由 `npm run write-index` 生成，`receipt` 由导入工具安装后写下，两者都不该手写。 取值: `tool`. |
| `formatVersion` | string | **必填** | 格式修订号，字符串，不是数字。只在破坏性变更时提升；读方遇到自己不实现的修订号**必须**拒绝。版本 2 把唯一一个版本放在文档根部，因此没有 `versions` 也没有 `latest`。字符串写成 `3` 会被拒绝，必须是 `'3'`——这是 YAML 的引号问题，也是最常见的一处手误。 取值: `3`. |
| `id` | string | **必填** | 小写 kebab-case。工具的主键，同时是目录名、依赖引用、索引键、制品文件名的主干，以及它提供的每个能力的第一个分段。**目录名必须与 `id` 完全一致**，否则校验报 `E-ID-DIR-MISMATCH`。工具相关内容必须放在 `payloads/<id>/` 目录下。 |
| `displayName` | string | **必填** | 展示给人看的名字。 |
| `type` | string | **必填** | 粗粒度分类，只回答「这是哪一类东西」，不描述引擎特性：着色器模型是引擎特定的，应放进 target 或 tag，而不是这里。 |
| `description` | string | **必填** | 会被导入工具逐字显示。写清楚它做什么、解决什么问题，保持客观。 |
| `tags` | array<string> | 可选 | 自由标签，用于检索与分组。 |
| `author` | string | 可选 | 作者或组织名。 |
| `license` | string | 可选 | **SPDX 标识符**，只写标识符本身，不要写整段许可证文本，也不要写 `LICENSE` 文件路径。它可以与仓库整体许可证不同。 |
| `licenseUrl` | string | 可选 | 许可证正文所在的位置。可选：license 是 SPDX 标识符，本来就能解析到 spdx.org 上那一页，所以这个字段用于**指向别处**——项目自带 LICENSE 文件，或者许可证根本没有 SPDX 页面。前后端都以它为准，它比标识符的默认页面优先。 |
| `homepage` | string | 可选 | 项目主页地址。 |
| `documentation` | string | 可选 | 工具文档的地址。**与 `homepage` 分开**：主页通常是仓库或项目介绍，文档是 API 参考与用法说明，两者常常不是同一个地方，用一个代替另一个会让想查 API 的人无处可去。必须是带协议头的 URI（`https://…`），因为界面上是当作可点击链接用的，写 `example.com/docs` 这种会被拒绝。可选。 |
| `releaseNotes` | string | 可选 | 维护者发布版本说明的地方。这里只给链接，不放正文：版本说明在发布之后还会被补充和修正，抄进注册库的副本会在最需要的时候过期；而正在挑选版本的人要看的本来就是维护者自己那一页。必须是带协议头的 URI，理由与 documentation 相同。 |
| `provides` | array<string> | 可选 | 本工具向**其他工具**提供的能力名。 |
| `injects` | array<string> | 可选 | 本工具**需要**、但不关心由谁提供的能力。与 `dependencies` 的关键差别：依赖钉死某个工具，`injects` 只钉死能力，因此提供者可以被替换而不必改动消费者。 |
| `dependencies` | array<mapping> | 可选 | 只按 `id` 声明依赖，绝不用路径或 URL——这是每个工具都能在库内自由移动的原因。 |
| `latest` | string | **必填** | 默认安装的版本，**必须**与 `versions` 中的某一项一致，因此默认值不可能指向一个并不存在的发布。 |
| `versions` | array<mapping> | **必填** | 所有已发布的版本。消费者可以安装其中任意一个；解析器会挑出满足给定约束的最高版本。 |
| `releasedAt` | string | 可选 | 该工具首次发布或最近发布的日期。 |
| `deprecated` | boolean | 可选 | 整个工具已退役。单个版本的退役用 `versions[].deprecated`。 |

## target 与 artifact

### `versions[].targets.<engine>`

| 字段 | 类型 | | 说明 |
| --- | --- | --- | --- |
| `requirements` | mapping | **必填** | 该引擎的宿主下限。`minEngineVersion` 是强制项——一个说不清自己下限的工具不予准入，因为「字段缺失」和「忘了填」在数据上无法区分。其余键由适配器定义：Unity 的 `minRuntimeVersion` 是 .NET API 级别，Godot 的是 `minApiVersion`，等等。 |
| `artifact` | mapping | **必填** | 恰好一个制品，描述该版本在该引擎上装什么、从哪来。 |

### `artifact`

| 字段 | 类型 | | 说明 |
| --- | --- | --- | --- |
| `type` | string | **必填** | 制品是哪一种东西。它决定哪些字段必填、哪些禁止填——例如 `external` 不能有 `size`。 取值: `archive` \| `package` \| `file` \| `external`. |
| `format` | string | 可选 | 容器格式。`type` 不是 external 时必填。**它必须与 `type` 相容**。`archive` 下核心接受 zip、tgz、tar.gz、tar.zst；`package` 下的取值由引擎适配器注册，所以 unitypackage 是 Unity 概念而不是核心概念；`file` 直接沿用扩展名（dll、pdb、so、dylib、txt）。 取值: `zip`, `tgz`, `tar.gz`, `tar.zst`, `unitypackage`, `dll`. |
| `path` | string | 可选 | 仓库相对路径，`type` 不是 external 时必填，固定为 `payloads/<id>/artifacts/<文件名>`。永远位于该工具自己的 payload 目录内，因此删除一个工具就是删一个目录。文件名必须是 `<id>-<version>[-<engine>].<ext>`。文件名**必须**符合约定，否则报 `E-ARTIFACT-NAME`。这个 pattern 刻意宽松；精确的命名规则由校验器执行，因为它能同时看到 id、版本与引擎。 取值: `^payloads/[a-z0-9-]+/artifacts/[A-Za-z0-9_.-]+$`. |
| `size` | integer | 可选 | 制品的字节数，`type` 不是 external 时必填。与 `sha256` 一起用于安装前校验。**这两个字段不用手算**：把文件放好，运行 `node ../ToolImport/apps/cli/bin/utool.js digest <文件>`，它会打印可直接粘贴的两行。 |
| `sha256` | string | 可选 | 制品的 SHA-256，64 位小写十六进制。导入前会校验，`type` 不是 external 时必填。**不要手算**：用 `utool digest <文件>` 打印可直接粘贴的行。用途是：任何人替换了制品字节，安装就会在写盘**之前**失败。 取值: `^[a-f0-9]{64}$`. |
| `source` | string | 可选 | `type: external` 时，远端是哪一类。仅 `type: external` 使用：制品所在的上游位置。本仓库只登记「它在哪」，不存它的字节。 取值: `git` \| `http` \| `npm`. |
| `url` | string | 可选 | `type: external` 时的上游地址。 取值: `^(https://|git@|ssh://)`. |
| `ref` | string | 可选 | `type: external` 时固定到一个 tag 或 commit SHA。用分支名会让同一版本两次安装产生不同字节，从而破坏回执模型。仅 `type: external` 使用：上游的哪个引用（标签、分支或提交）。**建议钉到标签或提交**，钉分支会让同一条元信息在不同时间装出不同内容。 |
| `subdirectory` | string | 可选 | 解包归档时：只取该前缀下的条目并去掉前缀。`external` 时：上游仓库中承载该包的子路径。使一份归档或一个仓库能服务多种布局。 |
| `upmPackageName` | string | 可选 | 当 `external` 指向一个真正的 UPM 包时填写，使导入工具能检测冲突并交给引擎自身的包解析。 取值: `^[a-z0-9]+(\.[a-z0-9\-]+)+$`. |
| `unpack` | string | 可选 | `auto`：打开容器并取出条目。`none`：原样放置该制品，交给引擎自己的导入器处理（例如让用户手动导入的 .unitypackage）；此时必须有 `targetPath`。 取值: `none` \| `auto`. |
| `targetPath` | string | 可选 | `type: file` 与任何 `unpack: none` 的制品都必填：文件落到工程里的哪个位置，相对工程根。 |
| `contentRoot` | string | 可选 | 解包时，归档内的条目锚定到工程里的哪个目录。**这不是偏好，而是必需的一步**：归档里的条目名总得有个起点，否则按 `MyTool/...` 打的包就会原样装成工程里的 `MyTool/...`——对 Unity 工程是错的，对 Godot 插件也是错的。取值由**引擎**决定（Unity 用 `Assets/...`，Godot 用 `addons/<名字>/`），所以它在某个引擎的 target 里，同一个工具的两个制品因此可以落在不同位置。`unpack: none` 时改用 `targetPath`。 取值: `Assets`, `addons`, `res://addons`. |
| `files` | array<string> | 可选 | 制品会装哪些文件的可读清单，安装前展示给用户看。**可以省略，内容多时就应该省略**：它目前**不参与校验**——安装器不会拿它和归档内容比对，所以手写一份很长的清单换不来任何保证，只是维护负担。将来若真正用于核对，此处会注明；在那之前，把这份精力放在确保归档本身正确上。 |
| `editorOnly` | boolean | 可选 | 该制品从玩家构建中排除。 |
| `restartRequired` | boolean | 可选 | 装上之后是否需要重启宿主。 |

---

上面是速查表。下面是每个字段的详细说明：它是什么意思、每个可取的值代表什么、以及一份可以直接复制的正确写法。

## 逐字段说明 · 顶层字段

### `kind`

文档判别器。它回答的是「这个文件是什么」，而不是「这个文件里是什么」。每个注册库文档都带一个，使读方在继续解析之前就知道该按哪种形状读：`tool`、`index` 或 `receipt`。你自己写的工具元信息，这一行永远是 `tool`——`index` 由 `npm run write-index` 生成，`receipt` 由导入工具安装后写下，两者都不该手写。

| 取值 | 含义 |
| --- | --- |
| `tool` | 一个工具的元信息，放在 `payloads/<id>/tool.yaml`。**这是你要填的值。** |
| `index` | 注册库目录清单 `index.yaml`，由 `npm run write-index` 生成，不要手改。 |
| `receipt` | 一次安装的回执，由导入工具写进工程的 `Library/` 下，随安装产生。 |

```yaml
kind: tool
```

### `formatVersion`

格式修订号，字符串，不是数字。只在破坏性变更时提升；读方遇到自己不实现的修订号**必须**拒绝。版本 2 把唯一一个版本放在文档根部，因此没有 `versions` 也没有 `latest`。字符串写成 `3` 会被拒绝，必须是 `'3'`——这是 YAML 的引号问题，也是最常见的一处手误。

| 取值 | 含义 |
| --- | --- |
| `'3'` | 当前版本，唯一应填的值。 |
| `'2'、'1'` | 历史版本，读方一律拒绝。迁移办法见格式规范的 R-MIG 规则。 |

```yaml
formatVersion: '3'
```

### `id`

小写 kebab-case。工具的主键，同时是目录名、依赖引用、索引键、制品文件名的主干，以及它提供的每个能力的第一个分段。**目录名必须与 `id` 完全一致**，否则校验报 `E-ID-DIR-MISMATCH`。工具相关内容必须放在 `payloads/<id>/` 目录下。

| 取值 | 含义 |
| --- | --- |
| `小写字母、数字、单个连字符` | 例如 `core-editor-utils`、`libs-sharp-json`。 |
| `不允许` | 大写字母、空格、下划线、连续连字符、首尾连字符、以数字打头。 |
| `长度` | 3 到 64 个字符。 |

```yaml
id: core-editor-utils
```

### `displayName`

展示给人看的名字。

```yaml
displayName: Core Editor Utils
```

### `type`

粗粒度分类，只回答「这是哪一类东西」，不描述引擎特性：着色器模型是引擎特定的，应放进 target 或 tag，而不是这里。

| 取值 | 含义 |
| --- | --- |
| `editor-tool` | 编辑器内的工具窗口、检查器扩展、菜单项。 |
| `tool-library` | 供其他代码调用的工具类库。 |
| `framework` | 一套有主张的架构或子系统。 |
| `asset` | 素材类内容。 |
| `template` | 工程或代码骨架。 |
| `sample` | 示例与演示。 |
| `other` | 确实不属于以上任何一类时使用。 |

```yaml
type: tool-library
```

### `description`

会被导入工具逐字显示。写清楚它做什么、解决什么问题，保持客观。

```yaml
description: Static guards for public method arguments, with allocation-free overloads.
```

### `tags`

自由标签，用于检索与分组。

```yaml
tags:
  - editor
  - utility
```

### `author`

作者或组织名。

```yaml
author: Mike
```

### `license`

**SPDX 标识符**，只写标识符本身，不要写整段许可证文本，也不要写 `LICENSE` 文件路径。它可以与仓库整体许可证不同。

| 取值 | 含义 |
| --- | --- |
| `MIT` | MIT 许可证。 |
| `Apache-2.0` | Apache 2.0。 |
| `GPL-3.0-only` | GPLv3，且不允许后续版本。 |
| `Unlicense` | 放弃著作权。 |
| `查不到？` | 到 SPDX 标识符列表查确切写法，不要自造。 |

```yaml
license: MIT
```

### `homepage`

项目主页地址。

```yaml
homepage: https://github.com/JokeVallen/ToolRegistry
```

### `documentation`

工具文档的地址。**与 `homepage` 分开**：主页通常是仓库或项目介绍，文档是 API 参考与用法说明，两者常常不是同一个地方，用一个代替另一个会让想查 API 的人无处可去。必须是带协议头的 URI（`https://…`），因为界面上是当作可点击链接用的，写 `example.com/docs` 这种会被拒绝。可选。

```yaml
documentation: https://jokevallen.github.io/ToolRegistry/docs/
```

### `releaseNotes`

维护者发布版本说明的地方。这里只给链接，不放正文：版本说明在发布之后还会被补充和修正，抄进注册库的副本会在最需要的时候过期；而正在挑选版本的人要看的本来就是维护者自己那一页。必须是带协议头的 URI，理由与 documentation 相同。

```yaml
releaseNotes: https://github.com/JokeVallen/ToolRegistry/releases
```

### `provides`

本工具向**其他工具**提供的能力名。

| 取值 | 含义 |
| --- | --- |
| `格式` | 至少两段、以点分隔的小写名，例如 `script.api.argument-guards`。 |
| `命名建议` | 用「领域.子领域.具体能力」，让别的工具一看就知道是不是自己要的。 |

```yaml
provides:
  - script.api.argument-guards
  - script.api.object-pooling
```

### `injects`

本工具**需要**、但不关心由谁提供的能力。与 `dependencies` 的关键差别：依赖钉死某个工具，`injects` 只钉死能力，因此提供者可以被替换而不必改动消费者。

```yaml
injects:
  - script.api.object-pooling
```

### `dependencies`

只按 `id` 声明依赖，绝不用路径或 URL——这是每个工具都能在库内自由移动的原因。

| 取值 | 含义 |
| --- | --- |
| `id` | 必填。被依赖工具的 `id`。 |
| `version` | 可选。版本约束；省略表示任意版本，取满足条件的最高者。 |
| `reason` | 可选。为什么需要它，最长 200 字符；会展示给用户。 |
| `optional` | 可选。为真时，缺失不会让安装失败。 |

```yaml
dependencies:
  - id: libs-sharp-json
    version: ^1.0.0
  - id: core-editor-utils
    optional: true
```

### `latest`

默认安装的版本，**必须**与 `versions` 中的某一项一致，因此默认值不可能指向一个并不存在的发布。

```yaml
latest: 1.0.0
```

### `versions`

所有已发布的版本。消费者可以安装其中任意一个；解析器会挑出满足给定约束的最高版本。

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

该工具首次发布或最近发布的日期。

```yaml
releasedAt: '2025-01-31'
```

### `deprecated`

整个工具已退役。单个版本的退役用 `versions[].deprecated`。

```yaml
deprecated: true
```

## 逐字段说明 · target 与 artifact

### `targets.<engine>.requirements`

该引擎的宿主下限。`minEngineVersion` 是强制项——一个说不清自己下限的工具不予准入，因为「字段缺失」和「忘了填」在数据上无法区分。其余键由适配器定义：Unity 的 `minRuntimeVersion` 是 .NET API 级别，Godot 的是 `minApiVersion`，等等。

| 取值 | 含义 |
| --- | --- |
| `minEngineVersion` | 必填。引擎版本下限，例如 Unity 的 `'2019.4'`、Godot 的 `'4.2'`。 |
| `minRuntimeVersion` | Unity 专用：**宿主**的 .NET API 级别下限，不是库自身的目标框架。格式必须是 `主.次` 两段（`4.7.1` 会被拒绝）。用 .NET Standard 2.0 编译**不代表**要填 `2.0`——这里填的是能真正加载该程序集的**最弱**宿主。拿不准就填 `4.6`，它从 Unity 2019.4 起都能装；填高只会缩小可安装范围。常见值：`4.6`、`4.7`、`4.8`、`6.0`。 |
| `其他键` | 由适配器定义；填了适配器不认识的键会被报为未知要求。 |

```yaml
requirements:
  minEngineVersion: '2019.4'
  minRuntimeVersion: '4.6'
```

### `targets.<engine>.artifact`

恰好一个制品，描述该版本在该引擎上装什么、从哪来。

```yaml
artifact:
  type: archive
  format: zip
  path: payloads/core-editor-utils/artifacts/core-editor-utils-1.0.0.zip
  size: 1709
  sha256: e2cadf5ee729033c1415eefb90d63af35a3af3d205d0e59c435b3589a2c236dd
```

## 逐字段说明 · target 与 artifact · `artifact`

### `artifact.type`

制品是哪一种东西。它决定哪些字段必填、哪些禁止填——例如 `external` 不能有 `size`。

| 取值 | 含义 |
| --- | --- |
| `archive` | 核心自己能打开的通用容器（zip、tgz、tar.gz、tar.zst）。首选类型。 |
| `package` | 只有该引擎适配器能打开的专有容器，例如 unitypackage。 |
| `file` | 没有容器的单文件载荷（dll、单个着色器、一份许可证）。需要 `targetPath` 与 `unpack: none`。 |
| `external` | 本仓库不存任何字节，只记录它在哪里。需要 `source`，并禁止 `path`、`size`、`sha256`。 |

```yaml
type: archive
```

### `artifact.format`

容器格式。`type` 不是 external 时必填。**它必须与 `type` 相容**。`archive` 下核心接受 zip、tgz、tar.gz、tar.zst；`package` 下的取值由引擎适配器注册，所以 unitypackage 是 Unity 概念而不是核心概念；`file` 直接沿用扩展名（dll、pdb、so、dylib、txt）。

| 取值 | 含义 |
| --- | --- |
| `zip、tgz、tar.gz、tar.zst` | 配 `type: archive`。 |
| `unitypackage` | 配 `type: package`，由 Unity 适配器打开。 |
| `dll、shader、txt 等` | 配 `type: file`。 |
| `git` | 配 `type: external`。 |

```yaml
format: zip
```

### `artifact.path`

仓库相对路径，`type` 不是 external 时必填，固定为 `payloads/<id>/artifacts/<文件名>`。永远位于该工具自己的 payload 目录内，因此删除一个工具就是删一个目录。文件名必须是 `<id>-<version>[-<engine>].<ext>`。文件名**必须**符合约定，否则报 `E-ARTIFACT-NAME`。这个 pattern 刻意宽松；精确的命名规则由校验器执行，因为它能同时看到 id、版本与引擎。

| 取值 | 含义 |
| --- | --- |
| `单个 target` | `<id>-<版本>.<扩展名>`，例如 `core-editor-utils-1.0.0.zip`。 |
| `多个 target` | `<id>-<版本>-<引擎>.<扩展名>`，例如 `core-editor-utils-1.0.0-godot.tgz`。 |
| `external` | 不填此字段。 |

```yaml
path: payloads/core-editor-utils/artifacts/core-editor-utils-1.0.0.zip
```

### `artifact.size`

制品的字节数，`type` 不是 external 时必填。与 `sha256` 一起用于安装前校验。**这两个字段不用手算**：把文件放好，运行 `node ../ToolImport/apps/cli/bin/utool.js digest <文件>`，它会打印可直接粘贴的两行。

```yaml
size: 1709
```

### `artifact.sha256`

制品的 SHA-256，64 位小写十六进制。导入前会校验，`type` 不是 external 时必填。**不要手算**：用 `utool digest <文件>` 打印可直接粘贴的行。用途是：任何人替换了制品字节，安装就会在写盘**之前**失败。

```yaml
sha256: e2cadf5ee729033c1415eefb90d63af35a3af3d205d0e59c435b3589a2c236dd
```

### `artifact.source`

`type: external` 时，远端是哪一类。仅 `type: external` 使用：制品所在的上游位置。本仓库只登记「它在哪」，不存它的字节。

| 取值 | 含义 |
| --- | --- |
| `git` | 上游是一个 git 仓库。 |
| `其他值` | 由消费者自行解释。 |

```yaml
source: git
```

### `artifact.url`

`type: external` 时的上游地址。

```yaml
url: https://github.com/example/gltf-importer.git
```

### `artifact.ref`

`type: external` 时固定到一个 tag 或 commit SHA。用分支名会让同一版本两次安装产生不同字节，从而破坏回执模型。仅 `type: external` 使用：上游的哪个引用（标签、分支或提交）。**建议钉到标签或提交**，钉分支会让同一条元信息在不同时间装出不同内容。

```yaml
ref: v2.3.1
```

### `artifact.subdirectory`

解包归档时：只取该前缀下的条目并去掉前缀。`external` 时：上游仓库中承载该包的子路径。使一份归档或一个仓库能服务多种布局。

仅 `type: external` 使用：真正的内容在上游仓库的哪个子目录里。

```yaml
subdirectory: packages/runtime
```

### `artifact.unpack`

`auto`：打开容器并取出条目。`none`：原样放置该制品，交给引擎自己的导入器处理（例如让用户手动导入的 .unitypackage）；此时必须有 `targetPath`。

是否解包。`auto` 是默认，也是正常安装；`none` 表示原样放置，交给引擎自己的导入器。

| 取值 | 含义 |
| --- | --- |
| `auto` | 打开容器并取出条目——导入工具真正写入文件的路径。 |
| `none` | 不解包，整个制品作为一个文件落到 `targetPath`；条目要等引擎导入后才存在。 |

```yaml
unpack: auto
```

### `artifact.targetPath`

`type: file` 与任何 `unpack: none` 的制品都必填：文件落到工程里的哪个位置，相对工程根。

单个文件、或声明了 `unpack: none` 的容器的落点，相对工程根。**只要 `unpack: none` 就必填**，否则报 `E-ARTIFACT-TARGETPATH`——没有它，该制品根本没有定义好的去处。解包的制品用 `contentRoot` 而不是它。取值由引擎决定，所以它属于某个引擎的 target。**必须落在该工具自己的目录下**（`Assets/<Tool>/...`），不要用 `Assets/Plugins`、`Assets/Editor`、`Assets/Resources` 这类共享目录：开发者会在那里放自己的插件，工具一旦占用就无法干净卸载。`tools/check-payload-code.mjs` 会拒绝共享目录。

```yaml
targetPath: Assets/Plugins/SharpJson.dll
```

### `artifact.contentRoot`

解包时，归档内的条目锚定到工程里的哪个目录。**这不是偏好，而是必需的一步**：归档里的条目名总得有个起点，否则按 `MyTool/...` 打的包就会原样装成工程里的 `MyTool/...`——对 Unity 工程是错的，对 Godot 插件也是错的。取值由**引擎**决定（Unity 用 `Assets/...`，Godot 用 `addons/<名字>/`），所以它在某个引擎的 target 里，同一个工具的两个制品因此可以落在不同位置。`unpack: none` 时改用 `targetPath`。

```yaml
contentRoot: package/Runtime
```

### `artifact.files`

制品会装哪些文件的可读清单，安装前展示给用户看。**可以省略，内容多时就应该省略**：它目前**不参与校验**——安装器不会拿它和归档内容比对，所以手写一份很长的清单换不来任何保证，只是维护负担。将来若真正用于核对，此处会注明；在那之前，把这份精力放在确保归档本身正确上。

```yaml
files:
  - Runtime/ArgumentGuards.cs
  - Runtime/ObjectPool.cs
```

### `artifact.editorOnly`

该制品从玩家构建中排除。

该制品是否只应装进编辑器的程序集范围。这是一个声明，不是强制——导入工具据此决定放进哪个程序集定义。

```yaml
editorOnly: true
```

### `artifact.restartRequired`

装上之后是否需要重启宿主。

装完后是否必须重启编辑器才生效。导入工具会据此提示用户，不做强制。

```yaml
restartRequired: true
```

## 逐字段说明 · `versions[]`

### `versions[].version`

该版本的版本号。

| 取值 | 含义 |
| --- | --- |
| `1.0.0` | 正式发布。 |
| `1.0.0-rc.1` | 预发布，排序低于同号正式版。 |
| `不允许` | `v1.0.0`（不要 v 前缀）、`1.0`（缺修订号）。 |

```yaml
version: 1.0.0
```

### `versions[].targets`

**该版本**按引擎名索引的映射。支持多个引擎的工具每个引擎声明一个 target，而不是被复制多份。核心只定义这个容器；某个 target 的需求键含义与制品格式由该引擎的适配器决定。

**该版本**按引擎名索引的映射。支持多引擎的工具为每个引擎声明一个 target，而不是把工具复制成多份。**不能为空**：一个不装任何东西的发布会被报为 `E-TARGETS-MISSING`。一个引擎只出现一次。

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

该版本的发布日期。

```yaml
releasedAt: '2025-01-31'
```

### `versions[].deprecated`

该版本已被取代。仍然保留发布，使既有回执仍可解析，但导入工具应当优先选择更新的版本。

```yaml
deprecated: true
```

### `versions[].yanked`

该版本已被撤回：**禁止**被自动选中。与 `deprecated` 不同，这是硬性停止，用于损坏或有不安全问题的发布。它仍然列出，因为既有回执可能引用它。

```yaml
yanked: true
```

### `versions[].notes`

该版本改了什么，一两句话；用户选择版本时会看到。

```yaml
notes: Adds an allocation-free overload and drops Unity 2018 support.
```

## 取值约束

### `toolId`

- 取值: `^[a-z0-9]+(-[a-z0-9]+)*$`
- 小写 kebab-case。主键：目录名、依赖引用、索引键、制品文件名主干，以及它提供的每个能力的第一个分段。

### `engineId`

- 取值: `^[a-z0-9]+(-[a-z0-9]+)*$`
- 引擎家族名。核心不枚举这些名字：没有适配器的引擎依然是合法数据，只是在该适配器出现之前无法被规划。

### `capability`

- 取值: `^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$`
- 带命名空间的能力名。至少两段，因此能力总是说明了它属于哪个命名空间，而不是一个裸词。

### `strictVersion`

- 取值: `^\d+\.\d+\.\d+(?:-[0-9A-Za-z.\-]+)?$`
- semver-lite：数字化的 主.次.修订，可带预发布后缀。

### `constraint`

- 取值: `^(\^|~|>=|<=|>|<|=)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.\-]+)?$`
- `^1.2.3` 表示 >=1.2.3 <2.0.0；`~1.2.3` 表示 >=1.2.3 <1.3.0；`>= n` 没有上界；只写版本号表示恰好是那个版本。

### `toolType`

- 取值: `editor-tool`, `tool-library`, `framework`, `asset-pack`, `template`
- 粗粒度的**引擎中立**分类。故意不含 shader-pack 这类引擎特有类型。
