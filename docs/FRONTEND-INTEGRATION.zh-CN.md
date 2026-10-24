# 工具库导入工具 —— 对接契约

**语言**：[中文](FRONTEND-INTEGRATION.zh-CN.md) · [English](FRONTEND-INTEGRATION.en.md) · [返回目录](../README.md)

本文档是 ToolRegistry（本仓库）与 **ToolImport**（工具库导入工具）之间的接口约定。

导入工具是**唯一**向使用者工程写入文件的组件。本仓库只提供数据；解析、校验、安装与回滚
全部由导入工具负责。

英文版见 [`FRONTEND-INTEGRATION.en.md`](FRONTEND-INTEGRATION.en.md)。

---

## 1. 架构：后端与界面分离

导入工具**不是**一个 Unity 包，而是两层，后端本身又分成引擎中立的核心与逐引擎的适配器：

```text
  ┌─────────────────────── 与引擎无关 ───────────────────────────┐
  │  packages/utool-core —— 引擎中立的核心（Node / npm）         │
  │    * .yaml 解析、kind / formatVersion 头检查                │
  │    * index 读取、依赖求解、能力（provides / injects）校验    │
  │    * 版本约束、要求（requirements）比对                      │
  │    * 制品校验（size / sha256 / 容器魔数 / 归档路径安全）      │
  │    * 安装计划、落盘、回执、回滚指针、卸载计划                 │
  │    核心不认任何引擎：容器格式与版本比较都由适配器注册         │
  ├──────────────────────────────────────────────────────────────┤
  │  providers/engine-unity —— Unity 适配器                      │
  │    * unitypackage 容器（打开 GUID 目录、读 pathname）         │
  │    * Unity 版本与 .NET API 级别（minRuntimeVersion）比较      │
  │    没有适配器的引擎仍然是合法数据，但无法被规划安装            │
  ├──────────────────────────────────────────────────────────────┤
  │  apps/cli —— `utool`，后端的唯一对外接口，可脱离 Unity 运行   │
  └──────────────────────────────────────────────────────────────┘
                               ▲
                               │ 子进程调用 + 记录流（--records）/ JSON
                               │
  ┌───────────────────────────┴──────────────────────────────────┐
  │  frontends/unity-editor —— Unity 编辑器界面                   │
  │    * 列出可导入项、展示详情与文件清单                          │
  │    * 展示安装计划、确认后执行                                  │
  │    * 展示已安装项与卸载入口                                    │
  └──────────────────────────────────────────────────────────────┘
```

### 1.1 为什么这样分层

| 理由 | 说明 |
| --- | --- |
| **编译错误下仍可干预** | 工程存在编译错误时，Unity 不会加载任何编辑器程序集，界面层完全无法执行。核心逻辑在 Node 里，此时 CLI 仍可正常工作——这是最实际的收益。 |
| **跨引擎** | 核心只认 `.yaml` 文档与制品字节，连 `unitypackage` 都不认识；Unity 支持来自 `providers/engine-unity`。接 Godot / Unreal 需要新增一个适配器与一个界面层，而不是改写核心。 |
| **可测试** | 解析、依赖与能力求解、校验都能在无 Editor、无网络的情况下做单元测试。 |
| **可复用** | CI 可以直接用同一个 CLI 校验或安装，不必启动 Unity。 |

**代价**：多一层进程边界，界面层无法直接持有后端对象，必须通过 `--records` 记录流或 JSON 通信。

---

## 2. 数据流

```text
  index.yaml           （1 次请求，扁平目录）        -> 构建可选列表（id、engines、provides、injects）
     |
     v
   每个工具的 tool.yaml  （每个被查看的工具 1 次请求）  -> 依赖、能力、逐引擎的 requirements 与 artifact
     |
     v
   制品字节              （每个 target 每次安装 1 次请求） -> 校验 size + sha256 + 容器后导入
```

导入工具不需要完整克隆仓库，每次只取一个文件。**引擎选择发生在读完 manifest 之后**：
`index.yaml` 只告诉你某个工具面向哪些引擎，具体下限与制品路径在 manifest 的 `targets` 里。

### 2.1 免克隆的获取方式

| 方式 | 请求形式 | 说明 |
| --- | --- | --- |
| GitHub raw | `https://raw.githubusercontent.com/JokeVallen/ToolRegistry/<ref>/index.yaml` | 最简单；`<ref>` 钉到 tag 才可复现 |
| `git` CLI | `git clone --depth 1 --filter=blob:none <url>` 后读工作树 | raw 不可用或走镜像时兜底 |
| 本地路径 | 直接读一个目录（省略 `--registry` 时会自动查找） | 开发与测试用，无需网络 |

`index.yaml` 与元信息应当缓存。制品按 `sha256` 内容寻址，因此以摘要为键的缓存永不需要失效。

---

## 3. 数据模型

```csharp
// index.yaml -> tools[] 的一行（只有引擎名，没有逐引擎细节）
sealed class RegistryToolSummary
{
    public string Id;
    public string DisplayName;
    public string Type;              // editor-tool | tool-library | framework | asset-pack | template
    public string Description;
    public string Version;
    public string[] Engines;         // 引擎名，如 ["godot", "unity"]
    public string[] Provides;
    public string[] Injects;
    public DependencyRef[] Dependencies;
    public string[] Tags;
    public string ManifestPath;      // 仓库相对路径，指向权威的 tool.yaml
}

// 完整的 tool.yaml
sealed class ToolManifest
{
    public string Kind;              // 必须是 "tool"
    public string FormatVersion;     // 只接受 "2"
    public string Id;
    public string DisplayName;
    public string Type;
    public string Description;
    public string Version;
    public string License;
    public string Author;
    public string Homepage;
    public string[] Tags;
    public string[] Provides;        // 本工具提供的能力
    public string[] Injects;         // 需要由任意提供者满足的能力
    public DependencyRef[] Dependencies;
    public Dictionary<string, ToolTarget> Targets;   // 引擎名 -> target
    public string ReleasedAt;
    public bool Deprecated;
}

sealed class ToolTarget
{
    public string Engine;                            // 映射的键
    public Dictionary<string, string> Requirements;  // minEngineVersion 必备，其余由适配器定义
    public string MinEngineVersion;                  // requirements.minEngineVersion
    public Dictionary<string, string> ExtraRequirements;  // 其余键，交适配器比对
    public ArtifactRef Artifact;                     // 恰好一个
}

sealed class DependencyRef
{
    public string Id;
    public string Version;           // 约束，省略表示任意版本
    public bool Optional;
    public string Reason;
    public string[] Engines;         // 空表示所有引擎
}

sealed class ArtifactRef
{
    public string Type;              // archive | package | file | external
    public string Format;            // 非 external 必备
    public string Path;              // 非 external 必备，payloads/<id>/artifacts/...
    public long Size;                // 非 external 必备
    public string Sha256;            // 非 external 必备
    public string Source;            // external：git | http | npm
    public string Url;               // external
    public string Ref;               // external：tag 或 commit
    public string Subdirectory;      // external
    public string UpmPackageName;    // external
    public string Unpack;            // none | auto
    public string TargetPath;        // type: file 必备
    public string ContentRoot;       // 解包归档的目标目录
    public string[] Files;           // 人类可读的落盘清单
    public bool EditorOnly;
    public bool RestartRequired;
}
```

**展示任何内容之前必须执行的拒绝规则：**

- `kind` 不是 `tool`，或 `formatVersion` 不是 `2` → 拒绝该工具并提示「导入工具版本过旧」
  （v1 文档不会被当成 v2 读）；
- 元信息中的 `id` 与所在目录不一致 → 拒绝；
- 缺失 `targets`，或某个 target 缺 `requirements` / `artifact` → 拒绝；
- `artifact.type == "external"` 却缺 `url` 或 `ref` → 拒绝；
- `artifact.type` 不是四种之一，或 `type: file` 缺 `targetPath` → 拒绝；
- 非 external 制品的 `path` 不是 `payloads/<id>/artifacts/<id>-<version>[-<engine>].<ext>` → 拒绝。

---

## 4. 版本约束求解

比较只用数字三元组，预发布后缀在排序中被忽略（见 SPEC §4.1）。

```text
satisfies(version, constraint):
    无约束             -> true
    ^1.2.3             -> version >= 1.2.3 且 major 相同
    ~1.2.3             -> version >= 1.2.3 且 major.minor 相同
    >=、>、<=、<       -> 三元组数值比较
    1.4.2 / =1.4.2     -> 三元组精确相等
```

冲突策略：多数工具只发布一个版本，因此冲突通常只会在**校验期**以 `E-DEP-VERSION` 出现，
不会在安装期出现。若未来 `formatVersion` 引入多版本元信息，导入工具应在**满足该 id 全部约束的
最高版本**中选择；若无法满足，报「无法解决的冲突」，**禁止**猜测。

**引擎下限不是版本约束**：`requirements.minEngineVersion`、`minRuntimeVersion` 等由适配器比较，
比较失败的表述应当包含「要求的是什么、宿主是什么、是哪个工具的哪个 target 提出的」。

---

## 5. 依赖与能力求解

```text
Resolve(requestedIds, engine, alsoEngines):
    resolved = {}                      # id -> manifest
    queue    = requestedIds

    while queue 非空:
        id = queue.pop()
        if id 已在 resolved: continue
        manifest = FetchManifest(id)   # 找不到 -> 硬错误「未知工具」
        resolved[id] = manifest

        CheckRequirements(manifest, engine)   # 缺该引擎 target 或下限不满足 -> 硬错误
        for dep in manifest.Dependencies:
            if dep.Engines 非空 且 engine 不在其中: continue
            if dep.Optional 且 dep.Id 不在 requestedIds: continue
            if dep.Id 已在 resolved: continue
            CheckConstraint(dep, registryLookup(dep.Id))   # 不满足 -> 硬错误
            queue.push(dep.Id)

    CheckCapabilities(resolved)   # 见 5.2
    if HasCycle(resolved): throw CycleError(环路径)
    return TopologicalOrder(resolved)  # 依赖先于依赖者
```

规则：

- **必需**依赖总是被递归拉入；`engines` 限定了引擎的依赖只在对应引擎的计划里出现。
- **可选**依赖只在用户已选中它时解析；绝不主动拉入，也绝不能让安装计划因此失败。
- 有环是硬错误，**禁止**自动打破。
- 安装顺序为拓扑序：依赖先于依赖它的工具。
- 一个工具在本次计划里**必须**有被请求引擎的 target，否则报「该工具不支持 <engine>」。
  `--also-engine` 可以再附加另一个引擎的 target（例如把同一个跨引擎工具同时装进两个引擎），
  但**主引擎**必须支持：装错引擎的字节比拒绝更糟。

### 5.1 要求（引擎下限）门禁

```text
CheckRequirements(manifest, engine):
    target = manifest.Targets[engine]        # 缺失 -> 硬错误
    adapter = adapters[engine]               # 缺失 -> 硬错误「没有该引擎的适配器」
    if !adapter.meets(target.Requirements, host[engine])   -> PlatformMismatch(...)
```

核心不比较任何版本；比较由适配器完成（Unity 侧比较 `minEngineVersion` 与 `minRuntimeVersion`，
后者对应工程的 API 兼容性级别）。宿主事实由调用方声明：`--host-unity` / `--host-dotnet`，
或从 `<project>/ProjectSettings/ProjectVersion.txt` 读取 Unity 版本。
**两者都不给时不强制下限**，并在人类可读输出里明确说明「未声明宿主，下限未强制」。

### 5.2 能力（`provides` / `injects`）

依赖边与能力边是两笔账：

- 依赖边钉死一个 id，按 §5 递归求解；
- 能力边只说「我需要这个名字」。计划内**任意**提供该能力的工具即可满足它，
  `installedBecause` 因此记的是提供者与需求方的关系，而不是一条固定依赖。

注意冲突的判据是**一次安装计划**，而不是整个库：库里允许若干工具提供同一能力（它们互为替代品，
`tools/registry.mjs` 只发 `W-CAP-MULTIPLE` 警告，界面上应当把它当作提示而不是错误）；
只有计划里同时出现两个提供者才是硬错误。

```text
CheckCapabilities(resolved):
    for cap in 所有 provides:
        若计划内有两个工具提供同一 cap -> 硬错误 E-CAP-CONFLICT
    for cap in 所有 injects:
        若计划内没有工具提供 cap -> 硬错误 E-CAP-UNSATISFIED
            （提示用户一并选中一个提供者）
```

能力名不合规（不足两段、含大写或下划线等）在**校验期**报 `E-CAP-FORMAT`。

---

## 6. 安装计划与回执

### 6.1 计划（写入任何东西之前）

```csharp
sealed class InstallPlan       { public PlannedTool[] Steps; }   // 拓扑序
sealed class PlannedTool
{
    public string Id, Version;
    public string Engine;            // 本次计划为哪个引擎安装
    public string ArtifactType;      // archive | package | file | external
    public string ArtifactFormat;    // 引擎容器或核心容器
    public string ArtifactPath;
    public long Size;
    public string Sha256;
    public string[] Files;           // 在确认面板中展示
    public string ContentRoot;       // 解包归档时
    public string TargetPath;        // type: file 时
    public bool EditorOnly;
    public string[] InstalledBecause;  // 需要它的 id，或 "user"
}
```

计划必须在执行前展示，包含文件清单，使「不想装的」在写入之前就被拦下。
`--dry-run` 是同一套计算，只是跳过执行。

### 6.2 校验

每一步在解包之前：

1. 取回制品字节；
2. `sha256(bytes) == artifact.sha256` —— 不符则中止整个计划，什么都不写；
3. `len(bytes) == artifact.size` —— 同上；
4. 格式检查：`zip` 必须是 `50 4b 03 04`，gzip 容器（`tgz` / `tar.gz` / `unitypackage`）必须是
   `1f 8b`，`tar.zst` 必须是 `28 b5 2f fd`；
5. 拒绝任何绝对路径或含 `..` 的归档条目（zip-slip / tar-slip）；
6. `file` 类型没有容器：只校验摘要与 `targetPath` 是否落在工程根之内；
7. `unitypackage` 由 `providers/engine-unity` 打开，要求每个 GUID 目录都有 `pathname` 条目，
   并把 `asset`、`asset.meta`、`pathname` 视为一个整体。

声明了 `unpack: none` 的容器不打开，而是原样放到它的 `targetPath`：写下的只是一个文件，里面的条目
要等引擎自己的资源管线导入后才存在。`unitypackage` 通常用 `auto`——由适配器解开，于是"装上"这件事由
导入工具完成，而不是装完再靠人工导入。

### 6.3 回执

安装成功后写入，使卸载精确；跨引擎安装只写**一份**回执（一个工具是一次决定，
`installedEngines` 记录这次落了哪些引擎）：

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
previousSha256: null        # 版本指针：本次安装替换掉的旧制品摘要；首次安装为 null
```

回执位于 `Library/` 下，Unity 从不提交该目录，因此它天然只是本地状态。

卸载规则——**按目录所有权判定**：

- 回执中记录的文件，只有在**没有其他回执仍声明它**时才可删除；
- 共享文件（由依赖装入的）在最后一个依赖者离开时移除；
- **工具拥有它安装到的那些目录**：装入期间写下的文件，卸载时一律移除，不区分用户此后是否改过。
  这不是冷漠，而是因为「这个改动算不算用户的」在数据上无法判定，而留在原地的文件就是残留——
  一个声称无污染的工具不能留下它。

用户手动改动导致的问题由用户负责，工具不承担处理职责，但**提供还原路径**：重新安装会用原始字节
覆盖回去（安装本身是幂等的，会重新校验摘要）。因此卸载前会**把改动过的文件单独列出并要求一次确认**：
不是为了拒绝删除，而是不让一次破坏性操作在用户没有看见的情况下发生。想保留某个改动，
请先把它移到工具目录之外。

**卸载现已执行，边界如下：**

- **卸载会真正删除文件。** `utool uninstall` 先给出 `delete` / `keep`（被其他回执认领）两份清单，
  随后执行删除（`--dry-run` 只打印计划）。三条约束保证它不会越界：路径必须落在工程内，
  被其他回执仍认领的共享文件一律保留，目录**只在其为空时**才移除，且 `Assets` 与 `Assets/Editor`
  永不删除。回执最后清除，这样中途中断仍留有记录描述磁盘上的现状。
- **被依赖的工具默认拒绝卸载。** 若其他**仍处于安装状态**的工具需要它，卸载会被拒绝（退出码 2）
  并列出依赖方；加 `--force` 可强行继续。判断依据是回执里的 `installedByTools`——即**本工程**
  的实际关系，而不是注册库里「可能被谁依赖」。依赖方已经卸掉时该记录不再构成阻止，
  否则被依赖过的工具将永远无法移除。
- **留下孤儿依赖时报出，但不自动删。** 卸载掉某工具后，若它当初自动拉进来的依赖已无人需要，
  会提示「no longer needed by anything installed」并给出移除命令。用户没点名的工具不会
  因为一次卸载而消失。`utool status` 也会显示每个工具的来源（谁要求了它）。
- **回滚只报告指针，不执行。** `utool rollback` 读 `previousSha256`，告诉你「当前是 X，
  记录的前一版是 Y」以及需要重新发布哪些字节。被替换掉的旧制品**不保证仍在库内**：
  维护者可以在无人钉住旧版后删掉它，工具因此无法假定取得到——报出准确摘要比假装修好更诚实。
- **external 源不会被真正解析。** 后端把 `type: external` 的 target 报告为
  「由调用方解析」并记录 `url` / `ref`，它不会自己去 clone 或浅取；这一步同样没有实现。

---

## 7. 导入工具的义务

| # | 义务 |
| --- | --- |
| 1 | 绝不导入散装文件树；只导入封存制品（`archive` / `package` / `file`） |
| 2 | 写入任何东西之前校验非 external 制品的 `sha256` 与 `size`，并核对容器魔数 |
| 3 | 拒绝不安全的归档条目 |
| 4 | 按被请求引擎的 target 强制检查 `requirements`（`minEngineVersion` 必备） |
| 5 | 递归解析必需依赖；绝不自动打破环 |
| 6 | 求解 `injects`：没有提供者就报错，绝不假装满足 |
| 7 | 执行前展示安装计划（文件、体积、每个工具为何被纳入） |
| 8 | 每个已安装工具写一份回执；绝不删除其他工具的文件 |
| 9 | 拒绝自己未实现的 `kind` / `formatVersion` / `artifact.type`，并说明原因 |
| 10 | 暴露校验失败，而不是绕过它 |

---

## 8. 后端 CLI 约定

CLI 是后端的唯一对外接口，界面层通过子进程调用它。默认输出人类可读的表，
`--json` 输出单个 JSON 文档，`--records` 输出逐行 TAB 分隔的记录（供 Unity 界面层解析）。
失败时以非零退出码结束；`--records` 模式下错误也走记录流，而不是 stderr。

```text
utool list      [--registry <path|url>] [--json|--records] [--quiet]
utool show      <id> [--registry ...] [--json|--records]
utool plan      <id...> [--engine <name>] [--also-engine <name>]... [--host-unity <ver>] [--host-dotnet <ver>] [--registry ...] [--json|--records]
utool verify    <id...>  同上，只校验、不写盘
utool install   <id...> [--project <dir>] [--dry-run]   其余同上
utool uninstall <id...> --project <dir> [--dry-run] [--json]
utool rollback  <id...> --project <dir> [--json]
utool status    --project <dir> [--json|--records]
utool validate  [<registry>] [--no-hash] [--write-index] [--quiet] [--json|--records]
```

| 选项 | 含义 |
| --- | --- |
| `--registry <path\|url>` | 注册库位置。省略时**自动查找**：工作目录附近的 `ToolRegistry/`，或任何同时含 `index.yaml` 与 `payloads/` 的目录 |
| `--mirror <url>` | 增加一个**同构镜像**主机，可重复，按给出顺序排在 `--registry` 之后；也可用环境变量 `UTOOL_MIRROR`（逗号或分号分隔）。见下文「镜像主机」 |
| `--project <dir>` | 工程根，默认当前目录 |
| `--engine <name>` | 目标引擎，默认 `unity` |
| `--also-engine <name>` | 额外再规划一个引擎的 target，可重复；用于把一个跨引擎工具同时装进两个引擎 |
| `--host-unity <ver>` | 声明宿主 Unity 版本（如 `2021.3.5f1`），启用下限门禁 |
| `--host-dotnet <ver>` | 声明宿主 .NET API 级别（如 `4.6`、`6.0`），启用下限门禁 |
| `--auto-provider` | 当某工具 `injects` 的能力在计划内无人提供时，代为选定一个提供者。默认**关闭**：静默塞进用户没要的工具，比直接说明缺口更糟。开启后选择是确定性的（id 最小者胜出），并会列出备选项 |
| `--no-hash` | 跳过 sha256 校验，仅比对大小与容器格式。用于网络受限或大制品调试，**不得**用于生产安装 |
| `--dry-run` | 只规划与校验，不写盘 |
| `--no-hash` | 跳过 sha256 校验（仍校验 size 与格式） |
| `--write-index` | 重新生成 `index.yaml`（仅 validate） |
| `--json` | 单个 JSON 文档 |
| `--records` | 逐行记录（TAB 分隔），给嵌入式界面层用 |
| `--quiet` | 抑制逐项检查输出 |

### 镜像主机

镜像指的是**同构镜像**：另一个主机，提供完全相同的目录布局。它解决的是"这个地址我这儿连不上"，
不解决"这个文件在这儿没有"。

```text
utool install my-tool --registry https://primary.example/registry \
                      --mirror https://gitee.example/registry
```

```bash
# CI 里更省事：环境变量。逗号或分号分隔，顺序即优先级
UTOOL_MIRROR=https://gitee.example/registry,https://backup.example/registry
```

规则只有三条，但每一条都影响你排障时看到的东西：

1. **只有在"完全连不上"时才换下一个主机**（`E-NETWORK`：DNS 失败、连接被拒、超时）。
   404 和"文档格式不对"都**不算**连不上——注册库已经答复了，去问第二个主机同一个问题，
   答案不会变，只会把一个清楚的"缺文件"变成一个缓慢而含糊的失败。
2. **先 `--registry`，再按 `--mirror` 给出的顺序**依次尝试。同时给出 `--mirror` 和
   `UTOOL_MIRROR` 时以 `--mirror` 为准，环境变量不会悄悄追加到命令行的意图之后。
3. **所有主机都连不上时，错误信息会逐个列出每个主机和各自的失败原因**，不会只报第一个。

镜像**不写在 `index.yaml` 里**。你能连上哪个主机，是你所在网络的性质，不是注册库数据的性质；
一个能给自己指定镜像的注册库，也就等于能把读者重定向到任何地方。因此镜像也必须**显式给出**，
永远不会被自动尝试：连不上就如实报告，而不是悄悄换成用户没有指定过的另一个来源。

`--registry` 是一个本地目录时，给出 `--mirror` 会直接报 `E-MIRROR-LOCAL`。目录已经是可达且精确的，
在这里接受镜像，等于暗示工具可能拿远端内容替换调用方明确指定的路径。

**`--records` 的记录类型**：`META`、`TOOL`、`TARGET`、`DETAIL`、`DEPENDENCY`、`WILLINSTALL`、
`PROBLEM`、`PLANTOOL`、`PLANFILE`、`PLAN`、`INSTALLED`、`INSTALLEDFILE`、`SKIPPED`、`RESULT`、
`RECEIPT`、`WARNING`、`ERROR`。值中的 TAB / CR / LF 会被转义，因此一条记录永远只占一行。

**`TARGET` 记录**（`show` 时每个引擎一条，避免把多引擎的下限与制品摊平后对不上号）：

```text
TARGET  <engine>  <minEngineVersion>  <其余要求键 k=v 逗号分隔>  <type>  <format>
        <artifactPath>  <contentRoot>  <targetPath>  <editorOnly true|false>
        <external.url>  <external.ref>
```

其余关键记录：

```text
TOOL        <id> <version> <type> <engines 逗号分隔> <provides 逗号分隔> <injects 逗号分隔>
            <displayName> <tags 逗号分隔> <dependencies id@version 逗号分隔> <manifestPath>
DETAIL      id <id> / engines <逗号分隔> / provides <逗号分隔> / injects <逗号分隔> / ...
WILLINSTALL <file> <engine>
PROBLEM     <code> <message>
PLAN        tools <n> bytes <n> ok <true|false> dryRun <true|false>
```

`WILLINSTALL` 报的是制品**声明**的文件清单（`Versions[].targets.<engine>.artifact.files`），一条
记录一个文件。`<file>` 在第 0 个字段，引擎是**追加在末尾**的字段：只按第 0 个字段读的旧读取端
不受影响，而装进某一个引擎的前端可以只显示该引擎的那些，而不是把两个引擎的清单拼在一起——那会让
Unity 用户以为 Godot 的载荷也要写进 `Assets`。引擎字段为空表示"清单没有绑定到某个引擎"（旧后端，
或没有解析出版本的调用方），此时对所有引擎都显示。

### `--records` 的契约版本

后端的每条记录流都以一条 `META` 记录开头，声明契约版本：

```text
META  recordsVersion  2
META  registry  <注册库位置>
```

**读方应当先看版本再解析其余内容。** 版本号在最后，是为了让读方在解析任何一个值之前就能拒绝
一条自己不认识的流——这正是「格式变了」从「静默得到错数据」变成「明确报错」的地方。

| 版本 | 变化 |
| --- | --- |
| 1 | 最初的记录集合：`META`、`TOOL`、`TARGET`、`DETAIL`、`DEPENDENCY`、`WILLINSTALL`、`PROBLEM`、`PLANTOOL`、`PLANFILE`、`PLAN`、`INSTALLED`、`INSTALLEDFILE`、`SKIPPED`、`RESULT`、`RECEIPT`、`WARNING`、`ERROR` |
| 2 | 新增 `VERSIONS`：一个工具可以发布多个版本，因此每个版本一条记录 |

**什么时候要提升版本号：** 删掉一种记录、调换字段顺序、改变某个字段的含义——任何读方可能误读的改动。
**什么时候不用：** 新增一种记录、在末尾追加字段。按类型取值的读方不受影响。

缺失版本号（老后端）**不表示错误**：它只会新增记录，因此按已知类型取值的读方仍能正确工作。

退出码约定：

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 一般失败（校验不过、制品哈希不符等） |
| 2 | 用法错误 |
| 3 | 解析失败（未知工具、约束不满足、有环、能力无人提供） |
| 4 | 引擎下限不满足（Unity / .NET 或适配器定义的其他要求） |

## 9. 错误码

全部错误码见 [`ERRORS.zh-CN.md`](ERRORS.zh-CN.md)——**唯一出处**，已与代码逐一核对。
它按「你会怎么遇到它」分组，并明确标出哪些只在实现导入工具时才会出现。

实现导入工具时最需要记住的一条：**引擎适配器对不认识的需求键返回 `undefined`，不是 `false`**。
核心把 `undefined` 读作「无法判断」，于是**报告**该下限而不强制它。

## 10. 可迁移性

这套工具**不绑定任何具体的仓库名、Git 主机或机器**，因为位置是运行时找到的，不是写死的。
下表是逐项保证，以及每一项靠什么成立：

| 场景 | 是否可用 | 靠什么成立 |
| --- | --- | --- |
| 仓库改名 | 可用 | 注册库工具**扫描兄弟目录**寻找导入工具，不按名字找；CLI 的默认注册库也是找到的，不是写死的 |
| 换 Git 主机（GitHub → Gitee → 自建） | 可用 | 只有 `--registry <url>` 里的地址是主机；文档里的 GitHub URL 是**示例**，不是配置 |
| 只放本地、不推远程 | 可用 | `--registry <本地目录>` 是一等用法；`git` 远端只在一个地方被识别，且被明确拒绝（`E-SOURCE-GIT`） |
| 换机器 / 换系统 | 可用 | 代码里没有绝对路径、盘符或用户目录；回执只记录**工程相对路径** |
| 整个工作区搬到别的盘 | 可用 | 同上；workspace 链接由 `npm install` 重建 |
| 只改目录层级（不再是兄弟目录） | 可用，需一次显式指定 | 设 `UTOOL_CORE`（注册库工具）或 `--registry`（CLI） |

**不保证的一件事**：`external` 类型的 `url`。它指向**上游**仓库，那是数据，不是本工具的配置；
上游改名或消失时那个工具确实会失效，这是必须如实说明的——但我们不会因此悄悄换成别处。

**为什么默认值是「找到」而不是「写死」**：目录名不是契约的一部分。这个默认值曾经写死成
`UnityDevCommonLib`，而它早已改名为 `ToolRegistry`，于是所有不带 `--registry` 的命令都会
报「缺少 index」——一个与真实原因毫无关系的错误。找目录也会误判：`template/` 里也有一份
`index.yaml`，所以候选目录必须**同时**有 `index.yaml` 与 `payloads/`。

## 11. 目录与仓库边界

`ToolImport/` 是与本仓库**并列**的兄弟目录，位于本仓库之外，拥有独立的本地 git 历史。

| | ToolRegistry | ToolImport |
| --- | --- | --- |
| 职责 | payload 格式与库内条目 | 解析、校验、安装的界面与后端 |
| 后端布局 | `schema/`、`payloads/`、`index.yaml` | `packages/utool-core`（引擎中立）、`providers/engine-unity`（Unity 适配器）、`apps/cli`、`frontends/unity-editor` |
| 版本管理 | 任意 Git 主机；下方地址只是**当前**所在，不是本工具的配置 | 本地 git 即可，不需要远程 |
| 变更时机 | 发布一个工具时 | 工具持续迭代时 |

两侧只通过本文件与 `schema/tool.schema.json` 通信，因此任一侧都可以在契约不变的前提下被替换。
