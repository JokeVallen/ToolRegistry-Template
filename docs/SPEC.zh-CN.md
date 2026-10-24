# ToolRegistry 格式规范

**语言**：[中文](SPEC.zh-CN.md) · [English](SPEC.en.md) · [返回目录](../README.md)

状态：**v3（`formatVersion` 为 `'3'`）**。规范性关键词 **必须（MUST）**、**禁止（MUST NOT）**、
**应当（SHOULD）**、**可以（MAY）** 按 RFC 2119 的含义使用。

本文档是规范性文件。总览见 [`../README.md`](../README.md)，
英文版见 [`SPEC.en.md`](SPEC.en.md)。

---

## 1. 这份规范面向谁

读者按目的分三类，各有一份对应的文档：

| 你想做什么 | 读哪一份 |
| --- | --- |
| 提交或修改一个工具 | [`CONTRIBUTING.zh-CN.md`](CONTRIBUTING.zh-CN.md)、[`ATTRIBUTES.zh-CN.md`](ATTRIBUTES.zh-CN.md) |
| 实现一个导入工具 | [`FRONTEND-INTEGRATION.zh-CN.md`](FRONTEND-INTEGRATION.zh-CN.md) |
| 改这个格式本身 | 本文件 |

本规范只讲**合法的数据长什么样**，不讲它为什么长这样：设计推理是维护者的问题，不是使用者的。

本文件是**规范性**的：它定义合法的数据长什么样，用 `必须` / `禁止` 这类词表达约束，每个约束都有一条规则编号，便于在评审和错误信息里引用。

## 2. 仓库布局

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

- **R-LAYOUT-1** 每个 payload **必须**位于 `payloads/<id>/`。
- **R-LAYOUT-2** `<id>` **必须**等于元信息中的 `id`。
- **R-LAYOUT-3** payload 目录**必须**包含 `tool.yaml`，且**禁止**包含 `tool.yaml`、可选的
  `README.md`、以及 `artifacts/` 之外的任何东西。
  **源文件禁止提交进 payload。**
- **R-LAYOUT-4** `artifacts/` **必须**为每个 target 恰好包含一个已发布制品，且文件名**必须**是：
  - 该工具只有**一个** target 时：`<id>-<version>.<ext>`；
  - 该工具有**多个** target 时：`<id>-<version>-<engine>.<ext>`。

  扩展名由格式决定（§6.1）：`zip` → `.zip`，`tgz` / `tar.gz` → `.tgz`，`tar.zst` → `.tar.zst`；
  `file` 类型则沿用其格式（`dll` → `.dll`）。加不加引擎段只看 target 的**个数**，
  因此单引擎工具升级为双引擎时，文件名会变——这是版本升级，不是原地改名。
- **R-LAYOUT-5** `index.yaml` **必须**与 payloads 一致；用
  `node tools/registry.mjs write-index` 重新生成。

---

## 3. 标识符规则

- **R-ID-1** `id` **必须**匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`，长度 3–64。
- **R-ID-2** `id` **必须**在整个库内唯一，且比较时不区分大小写。全小写使「不区分大小写」与
  「精确比较」等价——这点重要，因为 Windows 与 macOS 的文件系统默认不区分大小写。
- **R-ID-3** `id` 是主键：它命名目录、依赖引用、制品文件名主干、`index.yaml` 条目，以及导入回执。

### 3.1 命名约定

| 字段 | 风格 | 示例 |
| --- | --- | --- |
| `id` | 小写 kebab-case，可带类别前缀 | `editor-tool-selection-history` |
| `displayName` | 人类标题，任意语言 | `Selection History` |
| `tags` | 小写 kebab-case | `asset-pipeline` |

类别前缀（`editor-tool-`、`core-`、`libs-`、`framework-`）是 **SHOULD** 而非 **MUST**：
它让扁平的 `payloads/` 列表更易读，又不引入会破坏「id == 目录名」的嵌套。

### 3.2 引擎名

- **R-ID-4** `targets` 的键**必须**匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`，长度 2–32
  （`unity`、`godot`、`unreal`、`defold`）。
- **R-ID-5** 核心**禁止**枚举引擎名。引擎名只在两处获得含义：该引擎的适配器，以及
  `targets` 的键本身。没有适配器的引擎**可以**出现在数据里，但无法被规划安装。

---

## 4. 版本

- **R-VER-1** `version` **必须**形如 `major.minor.patch`，后面可带预发布后缀
  （`1.0.0`、`2.3.1`、`1.0.0-rc.1`）。这是 semver-lite：不使用构建元数据（`+build`）。
- **R-VER-2** 比较只用数字三元组，预发布后缀在排序中被忽略。因此预发布只用于**标记**，不用于优先级。
- **R-VER-3** 已发布的字节不可变。制品发生任何改变——哪怕只是注释——都**必须**以新的 `version`
  和新文件发布。**禁止**重写已经推送过的制品。
- **R-VER-4** 一份元信息描述该工具的**全部**已发布版本，每个版本一个 `versions[]` 条目；
  `latest` **必须**指向其中一个（见 R-VER-6）。读方若不认识该形状，**必须**拒绝而不是猜测。
- **R-VER-5** 同一份元信息里**禁止**出现两个相同的 `version`。
- **R-VER-6** `latest` **必须**与 `versions` 中某一项的 `version` 完全一致，且该项**禁止**是
  `yanked` 的：默认值不能指向一个不存在的、或被撤回的发布。

### 4.1 依赖约束

`dependencies[].version` 是约束：

| 形式 | 含义 |
| --- | --- |
| `^1.2.3` | `>= 1.2.3`，同一主版本 |
| `~1.2.3` | `>= 1.2.3`，同一主次版本 |
| `>=1.0.0`、`>`、`<=`、`<` | 单侧边界 |
| `1.4.2` | 精确该版本 |
| 省略 | 本库提供的任意版本 |

- **R-DEP-1** 依赖**必须**引用 `id`，**禁止**引用路径或 URL。
- **R-DEP-2** 工具**禁止**依赖自身。
- **R-DEP-3** 每个被引用的 `id` **必须**在本库中存在。
- **R-DEP-4** 必需依赖之间**禁止**存在环。
- **R-DEP-5** `optional: true` 的含义是：用户已选中它时就使用，绝不主动拉入。

依赖项**可以**用 `engines` 限定只在某些引擎上需要（例如只有 Unity 侧才需要的辅助工具），
这样一条依赖边不会被另一个引擎的安装计划继承。

---

## 5. 引擎 target 与下限

`targets` 是引擎名到 target 的映射。每个 target 有两个必备键：`requirements` 与 `artifact`。

```yaml
targets:
  unity:
    requirements:                 # 宿主下限；核心只定义 minEngineVersion
      minEngineVersion: '2019.4'
      minRuntimeVersion: '4.6'    # Unity 适配器定义的 .NET API 级别下限
    artifact:
      type: package               # archive | package | file | external（§6）
      format: unitypackage
      path: payloads/core-editor-utils/artifacts/core-editor-utils-1.1.0-unity.unitypackage
      size: 1709
      sha256: e2cadf5ee729033c1415eefb90d63af35a3af3d205d0e59c435b3589a2c236dd
```

- **R-TGT-1** `targets` **必须**是一个非空映射，键按 §3.2 命名。
- **R-TGT-2** 每个 target **必须**声明 `requirements` 与 `artifact` 两者；
  缺少任一个即拒绝（`E-TARGET-REQUIREMENTS` / `E-TARGET-ARTIFACT`）。
- **R-TGT-3** 一个 target 描述**一个引擎**。同一工具在不同引擎上的下限、容器与布局**必须**
  写进各自的 target，而**禁止**在顶层重复一份。

- **R-PLAT-1** `requirements.minEngineVersion` **必须**存在。
  Unity 侧格式为 `YYYY.MINOR` 或完整编辑器版本（`2020.3`、`2021.3.5f1`）；
  其他引擎由各自适配器定义比较方式。导入器与宿主版本比较，低于下限则拒绝安装。
- **R-PLAT-2** `requirements` 的其他键由**引擎适配器**定义，取值是扁平标量。Unity 适配器定义
  `minRuntimeVersion`（`4.6` 表示 .NET Framework；`6.0` / `7.0` / `8.0` 表示 .NET Standard 2.1 / .NET，
  与工程的 API 兼容性级别比较）；Godot 适配器定义 `minApiVersion`，依此类推。
  核心只保证 `minEngineVersion` 一定可比较。
- **R-PLAT-3** 即使工具没有实际下限，`minEngineVersion` 也是强制的——因为「字段缺失」与「忘了填」
  在数据上无法区分。这就是「最小必要属性集」规则：无法声明自己引擎下限的工具不予准入。

---

## 6. 四种制品类型

`artifact.type` 决定制品是什么，以及谁有能力打开它。四种取值互斥。

- **R-SRC-1** `artifact.type` **必须**是 `archive`、`package`、`file`、`external` 之一。
- **R-SRC-2** `artifact.path` **必须**形如 `payloads/<id>/artifacts/<file>`，
  其中 `<file>` **必须**符合 **R-LAYOUT-4** 的命名；目录段**必须**与该工具的 `id` 相同。
- **R-SRC-3** `archive` / `package` / `file` **必须**带 `format`、`path`、`size`、`sha256` 四项。
  `sha256` **必须**是制品文件本身的摘要（不是其内容的摘要），小写十六进制；`size` **必须**是其精确字节数。
- **R-SRC-4** `format` **必须**与容器真实字节一致（zip 以 `PK\x03\x04` 开头，gzip 压缩的 tar 以
  `1f 8b` 开头，zstd 以 `28 b5 2f fd` 开头）。标错格式会导致校验失败。
- **R-SRC-5** 容器内**禁止**包含绝对路径或 `..` 段（zip-slip / tar-slip）。

### 6.1 `archive` —— 核心自己能打开的容器

- **R-ART-1** `type: archive` 的 `format` **必须**是核心支持的格式之一：`zip`、`tgz`、`tar.gz`、
  `tar.zst`。核心不认识的容器**禁止**声明为 `archive`——引擎专属容器**必须**声明为 `package`，
  否则核心会尝试用通用解包器打开它，而正确做法是交给该引擎自己的导入管线。

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

`contentRoot` 声明解压目标（相对工程根）。归档条目应当就是它们出现在 `contentRoot` 下的样子。

### 6.2 `package` —— 只有该引擎适配器能打开的容器

- **R-ART-2** `type: package` 的 `format` 由**引擎适配器**注册，因此 `unitypackage` 是一个 **Unity 概念**
  而不是核心概念：核心只负责搬运和校验字节，打开它的是 `providers/engine-unity`。
  没有适配器的引擎，其 `package` 制品**可以**入库，但导入器**禁止**假装能打开它。
  `unitypackage` 内每个 GUID 目录**必须**带 `pathname` 条目，否则该引擎无法定位文件，
  导入结果不可预测。`unpack: auto` 表示由该引擎的适配器打开容器并取出条目——**这才是"装上"**；
  `none` 表示把整个制品原样放在 `targetPath`，条目要等引擎自己导入后才存在，因此此时 `targetPath` **必须**给出。

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

### 6.3 `file` —— 单文件制品

- **R-ART-3** `type: file` 描述**没有容器**的单文件制品（一个 dll、一个着色器、一份许可证文本）。
  它**必须**带 `targetPath`（相对工程根，声明该文件落到哪里），且 `unpack` **必须**是 `none`。
  `format` 沿用扩展名（`dll`、`pdb`、`so`、`dylib`、`txt`）。它和 `archive` 一样受 `size` + `sha256`
  约束，因此**不是**「散装文件」——它是一个被封存、可校验的单文件。

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

### 6.4 `external` —— 只存元信息

- **R-EXT-1** `type: external` **必须**带 `source`（`git` / `http` / `npm`）、`url`、`ref`，
  且**禁止**带 `path`、`size`、`sha256`：为本仓库里不存在的字节记一个摘要，是无法校验的。
  本库不为该工具存放任何制品。
- **R-EXT-2** `ref` **必须**是 tag 或 commit SHA，**禁止**是分支名，否则同一版本号下的两次安装
  会拿到不同代码，回执模型随之失效。
- **R-EXT-3** 当仓库根不是包根时使用 `subdirectory`；`upmPackageName` 用于让导入器检测与工程中
  已安装包的冲突，并优先交给引擎自身的包解析机制。
- **R-EXT-4** `unpack` **应当**是 `none`——本地没有可解开的容器。
- **R-EXT-5** 该形式的存在意义是给仓库存储封顶。当某个内置工具的源码变大，或上游已发布可用包时，
  应当优先改用它。

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

### 6.5 为什么仍然禁止散装文件

- **R-ART-4** payload **禁止**以散装文件树的形式导入：一个 payload 目录里只允许 `tool.yaml`、
  可选的 `README.md` 与 `artifacts/`，**源文件禁止提交进 payload**（R-LAYOUT-3）。
  理由是同一件事在 v1 就已成立：散装 `.cs` 会在工程里留下不受追踪、无法被哈希校验、也无法被干净移除的
  资源。需要交付单个文件时用 `type: file`，它带 `targetPath` 与摘要——那是被封存的单文件，
  而不是散装的源码树。

### 6.6 落点，以及把工具挪到别处

- **R-SRC-6** 清单里写的落点是**默认值**，不是唯一可能。一个 target 的所有安装路径都落在同一个目录下
  ——解包制品是 `contentRoot` 加上容器内部结构，封存单文件是 `targetPath` 所在的目录——消费方**可以**
  把整个目录装到工程里的别处（`utool install --into`）。
- **R-SRC-7** 迁移**必须**保留该目录以下的结构，且**禁止**把一个 payload 拆到两个根下：那个目录是回执
  记录的单元，散在两地的东西无法在不猜的前提下卸载。
- **R-SRC-8** 迁移只作用于调用方**点名要的**那个工具。依赖保持它自己清单声明的布局；两个工具合并进同一
  个目录会让"这些文件属于谁"变得无法判定。
- **R-SRC-9** 正因为 `targetPath` 与 `contentRoot` 只是默认值，它们**必须**指向该工具自己的目录
  （`Assets/<Tool>/...`），不能是共享目录——一个可以被挪走的部署，仍然应当能独立卸载。

---

## 7. 能力：`provides` 与 `injects`

`dependencies` 钉的是一个 **id**：我要 `core-editor-utils ^1.1.0`，别的都不行。
但很多需求不是「我要那个工具」，而是「我要这个能力，谁提供都行」——参数校验、对象池、
JSON 序列化。把这种需求写成依赖，会让消费者与某个实现绑死；实现一换，所有消费者都要改。

因此格式引入命名空间化的**能力名**：

```yaml
provides:                       # 本工具向其他工具提供的能力
  - unity.window.selection-history
injects:                        # 本工具需要的能力，由任意提供者满足
  - script.api.argument-guards
dependencies:                   # 钉死具体工具及其版本
  - id: core-editor-utils
    version: ^1.1.0
    reason: Uses Guard for argument validation.
```

- **R-CAP-1** `provides` 与 `injects` **必须**是字符串数组，各自最多 32 项、不得重复。
- **R-CAP-2** 能力名**必须**匹配 `^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$`，长度 ≤ 96，
  即**至少两段**点分小写 kebab-case。两段起步是有意的：能力名必须自报命名空间，
  而不是一个随时会撞名的裸词（`script.api.argument-guards` 而不是 `guards`）。
- **R-CAP-3** 同一个能力**可以**由多个工具提供——它们互为替代品，而这正是 `injects` 存在的理由：
  用户可以在满足同一能力的若干实现之间挑选。库级校验对这种情形只发**警告**
  （`W-CAP-MULTIPLE`），因为「有多个提供者」在库里是合法的。真正**必须**被拒绝的是**安装计划**里
  同时出现同一能力的两个提供者（`E-CAP-CONFLICT`，由导入工具的求解器判定）：那会让消费者无法说出
  自己拿到的是哪一个。所以冲突的判据是「一次安装」，而不是「一个库」。
- **R-CAP-4** 每个 inject **必须**能被库内某个工具满足，否则校验失败（`E-CAP-UNSATISFIED`）。
  本库发布的是「一族工具」，而不是任意单件。
- **R-CAP-5** `injects` **不是**依赖：它不指定 id，由**任意**提供该能力的工具满足。
  这正是提供者可以被替换而不必改动消费者声明的原因；也是为什么它与 `dependencies` 分开记两笔账。
- **R-CAP-6** 曾经的 `type: shader-pack` 已被移除：着色器模型是引擎专属的，因此它属于某个 target
  或一个 `tag`，而不是一个引擎中立的枚举值。`type` 现在只有
  `editor-tool`、`tool-library`、`framework`、`asset-pack`、`template`。

---

## 8. 字段参考

### 8.1 顶层必备（引擎中立）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `kind` | 常量 `tool` | 文档判别器 |
| `formatVersion` | 字符串 `'3'` | 读方拒绝不认识的版本（R-FMT-4、R-FMT-5） |
| `id` | 字符串 | §3 |
| `displayName` | 字符串，1–80 | 导入工具列表中的显示名 |
| `type` | 枚举 | `editor-tool`、`tool-library`、`framework`、`asset-pack`、`template`（R-CAP-6） |
| `description` | 字符串，10–600 | 一段话说明它做什么、解决什么问题 |
| `version` | 字符串 | §4 |
| `targets` | 映射 | §5，至少一个引擎 |

### 8.2 顶层可选（引擎中立）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `tags` | 字符串数组 | ≤ 12，小写 kebab-case |
| `author` | 字符串 | 归属信息 |
| `license` | 字符串 | SPDX 标识符，**可以**与仓库的 MIT 不同 |
| `licenseUrl` | URI | 许可证正文所在位置，用于项目自带 `LICENSE`、或该许可证没有 SPDX 页面的情况。可选：标识符本来就能解析到 spdx.org，所以这个字段用于指向**别处**，消费方**应当**优先采用它 |
| `homepage` | URI | 上游仓库或项目主页 |
| `documentation` | URI | 文档地址；与 `homepage` 分开，二者常常不是同一个地方 |
| `releaseNotes` | URI | 维护者发布版本说明的地址；只给链接，不存正文 |
| `provides` | 字符串数组 | §7，≤ 32 |
| `injects` | 字符串数组 | §7，≤ 32 |
| `dependencies` | 映射数组 | §4.1 |
| `releasedAt` | `YYYY-MM-DD` | 发布日期 |
| `deprecated` | 布尔 | 导入工具**应当**隐藏或给出警告 |

### 8.3 target 与 artifact

| 字段 | 位置 | 类型 | 说明 |
| --- | --- | --- | --- |
| `requirements` | target，必备 | 映射 | `minEngineVersion` 必备，其余键由适配器定义（§5） |
| `artifact` | target，必备 | 映射 | 恰好一个（R-TGT-2） |
| `artifact.type` | artifact，必备 | 枚举 | `archive`、`package`、`file`、`external`（§6） |
| `artifact.format` | artifact | 字符串 | 非 external 必备；容器或文件格式（R-SRC-3、R-SRC-4） |
| `artifact.path` | artifact | 字符串 | 非 external 必备，位于本 payload 的 `artifacts/`（R-SRC-2） |
| `artifact.size` / `sha256` | artifact | 整数 / 64 位小写十六进制 | 非 external 必备（R-SRC-3） |
| `artifact.source` / `url` / `ref` | artifact | 枚举 / 字符串 / 字符串 | external 必备（R-EXT-1、R-EXT-2） |
| `artifact.subdirectory` / `upmPackageName` | artifact | 字符串 | external 的子树与包名（R-EXT-3） |
| `artifact.unpack` | artifact | `none` / `auto` | 默认 `auto`；`file` **必须**是 `none`，且 `none` 一律需要 `targetPath`（R-ART-3） |
| `artifact.targetPath` | artifact | 字符串 | `file` 必备；任何 `unpack: none` 的制品同样必备 |
| `artifact.contentRoot` | artifact | 字符串 | 解包归档的目标目录，相对工程根 |
| `artifact.files` | artifact | 字符串数组 | 人类可读的落盘清单，安装前展示 |
| `artifact.editorOnly` | artifact | 布尔 | 该制品不进入播放器构建 |
| `artifact.restartRequired` | artifact | 布尔 | 生效前宿主需要重载 |

所有层级都设 `additionalProperties: false`：字段名写错是校验失败，而不是被静默忽略。

### 8.4 一个完整的样例

以下内容与 `payloads/core-editor-utils/tool.yaml` 逐字一致（注释已略），因此文档不会与真实数据漂移：

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

生成的扁平目录，使导入工具不必遍历目录树。`kind: index`。

索引条目**只带引擎名**，不带逐引擎的下限与制品路径——那些留在各自的 manifest 里，
因为索引的用途是「一次请求列出全部」，而不是「据此安装」。条目也带 `provides` / `injects` /
`dependencies` / `tags` / `manifestPath`，使消费者不必先读 manifest 就能筛出候选。

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

- **R-IDX-1** `index.yaml` **必须**由 payloads 派生；**禁止**手工编辑。
- **R-IDX-2** 它**必须**在新增或修改工具的同一个提交中重新生成，否则校验失败。

---

## 10. 分发通道

| 通道 | 机制 | 取舍 |
| --- | --- | --- |
| 导入工具 | 读 `index.yaml`，按 `--engine` 选定 target，拉取制品，解析依赖 | 按需选择；写回执；**唯一**受支持的路径 |
| 外部来源 | `artifact.type: external` 的 target 指向上游仓库而不存字节 | 仓库体积可控；但制品不在本仓库，因此不做哈希校验，由调用方求解 |

- **R-CHAN-1** 仓库根**禁止**出现 `Assets/` 目录，且本仓库**禁止**被整体安装。它只存数据；
  工具的选择属于导入工具。因此 Git URL 安装本身不会导入任何东西——这是**目的**，不是缺陷。
- **R-CHAN-2** 制品的字节**禁止**在仓库内出现第二份。一个制品只在
  `payloads/<id>/artifacts/` 下有一个位置，这样删除时只删一个目录，也不会留下陈旧的副本。

---

## 11. 迁移与演进

- **R-MIG-1** 对本规范做破坏性修改**必须**提升 `formatVersion`；读方**必须**拒绝不认识的版本。
- **R-MIG-2** 退役一个工具意味着先置 `deprecated: true` 至少一个发布周期，再删除 payload。
- **R-MIG-3** 删除 payload **必须**在同一个提交中更新 `index.yaml`。
- **R-MIG-4** 从 v1 迁移到 v2 **必须**：把 `formatVersion` 升为 `'2'`；把顶层的
  `minUnityVersion` / `minDotNetVersion` / `source` / `artifacts` / `files` / `install` /
  `packageName` / `assemblyName` 移入相应引擎的 `targets.<engine>`；把 `source.kind: bundled`
  译为 `artifact.type`（`unitypackage` → `package`，`zip` / `tgz` → `archive`，
  单文件 → `file`），`source.kind: external` 译为 `artifact.type: external`；
  并**必须**按 R-LAYOUT-4 重命名制品文件。迁移**可以**同时借机把「我需要某个工具」
  改写成 `injects` 能力声明。
- **R-MIG-5** 从 v2 迁移到 v3 **必须**：把 `formatVersion` 升为 `'3'`；把根部的 `version`、
  `targets`、`releasedAt`、`deprecated` 移入 `versions[0]`；新增 `latest`，其值**必须**等于
  该版本的 `version`。制品字节与文件名**不受影响**：v3 只改变了版本信息在文档中的位置。
  旧版本的 `deprecated` 是逐版本字段，因此迁移后它属于 `versions[]` 的某一项，而不是文档根部。

### 新增一个工具——精确步骤

```pwsh
# 1. 创建目录并从模板复制（含双引擎示例与填写说明）
New-Item -ItemType Directory -Force payloads/my-tool/artifacts
Copy-Item template/tool.bundled.yaml payloads/my-tool/tool.yaml

# 2. 每个引擎各产出一个制品（Unity：Assets > Export Package...；其他：Compress-Archive / tar -czf）

# 3. 单 target 用 <id>-<version>.<ext>，多 target 用 <id>-<version>-<engine>.<ext>
Copy-Item my-tool.unitypackage payloads/my-tool/artifacts/my-tool-1.0.0.unitypackage

# 4. 编辑 tool.yaml，用真实字节填入每个 target 的 size 与 sha256
node ../ToolImport/apps/cli/bin/utool.js digest payloads/my-tool/artifacts/my-tool-1.0.0.unitypackage

# 5. 重建索引并校验
node tools/registry.mjs write-index
node tools/registry.mjs validate
```

---

## 12. 尚未定义

以下内容**现在不属于格式**，读方遇到时应按未知字段拒绝。在此记录，是为了将来加入时能说清
那是一次格式修订，而不是悄悄扩展。

| 尚未定义 | 今天的替代做法 |
| --- | --- |
| `channels` 字段（`stable` / `preview`） | 用逐版本的 `deprecated` / `yanked` 表达成熟度与撤回 |
| `sha256` 之外的制品签名 | 只有 `sha256`；完整性由它与 `size` 保证 |
| `minEngineVersion` 之外的**通用**要求键 | 其余键一律由引擎适配器定义（见 R-PLAT-2），核心不认识具体名字 |
| Unity / Godot 之外的引擎适配器 | 没有适配器的引擎仍是**合法数据**，只是无法被规划安装（见 R-ENG-2） |

已经落地的**不在**此列：多版本元信息（`versions[]` + `latest`，见 R-VER-4）、逐版本
`deprecated` 与 `yanked`、Godot 适配器——它们都是当前格式的一部分。
