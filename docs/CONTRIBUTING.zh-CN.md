# 贡献指南

**语言**：[中文](CONTRIBUTING.zh-CN.md) · [English](CONTRIBUTING.en.md) · [返回目录](../README.md)

本注册库刻意保持严格：导入工具信任它，所以被准入的东西必须可校验、可插拔、可移除。
好在新增一个工具只需要**一个目录 + 每个引擎一个制品 + 一条命令**。

---

## 你能贡献什么

| 你想做的 | 需要动的 | 做什么 |
| --- | --- | --- |
| **加一个新工具** | `payloads/<新 id>/` | 从模板开始，填元信息、放制品。这是最常见的一种。 |
| **发布已有工具的新版本** | `payloads/<已有 id>/` | 产出新制品，加一个 `versions` 条目。 |
| **只改元信息** | `payloads/<id>/tool.yaml` | 改描述、标签、依赖、下限。制品字节不动。 |
| **引用别处已有的包** | `payloads/<id>/tool.yaml` | `type: external`，本仓库不存字节，只登记它在哪。 |
| **改格式或工具链** | `schema/`、`tools/` | 先读[格式规范](SPEC.zh-CN.md)；这是破坏性变更，需要格式修订号。 |

只改文档、修错别字一样欢迎，直接提 PR 即可。

**不确定某个字段填什么？** 查 [属性速查](ATTRIBUTES.zh-CN.md)：每个字段一节，含取值含义与可直接复制的示例。

## 流程

```text
1. 建目录，从 template/ 复制骨架
2. 填元信息，改 id 与目录名一致
3. 每个引擎各产出一个制品
4. 跑 utool digest，把 size 与 sha256 填回去
5. 重建索引并校验
6. 提交
```

每一步的细节见下文对应小节。**第一次做**建议按顺序读完；**只是加个版本**直接跳到
[发布新版本](#发布已有工具的新版本)。

> **不想读文档？** 双击 `tools/guide.html`。它把上面这六步按顺序列出来，命令里已经代入你填的
> id 与引擎，复制即可运行；每一步旁边有对应文档的入口，**先做，卡住了再点进去**。
> 这份文档是给想知道「为什么这么做」、或者卡在某个报错上的人看的。

**第一步先用 `tools/editor.html` 把元信息填出来。** 双击打开即可，不用装 Node：按表填写，
把制品拖进去就自动算出 `size` 与 `sha256`，填写有前提的字段（`targetPath`、`contentRoot`）
只在前提成立时出现，生成时立刻用同一个校验器检查一遍。生成的 YAML 直接存成
`payloads/<id>/tool.yaml`。

也可以用 `tools/validate.html` 随时复查一份已有元信息：把 `tool.yaml` 拖进去或点「选择文件」。它是**自动生成**的单文件页面（`npm run build:validator`），内嵌的是
**同一个**校验器与同一份 schema，所以结论与 CLI 一致；不联网、不上传。它只检查元信息本身的形状——
哈希、依赖求解与安装需要整个注册库，那是 `utool validate` 的事。

---

## 新增一个打包型工具

### 1. 从模板开始

```pwsh
New-Item -ItemType Directory -Force payloads/my-tool/artifacts
Copy-Item template/tool.bundled.yaml payloads/my-tool/tool.yaml
```

先把 `id` 与目录名改成一致（小写 kebab-case），然后决定要支持哪些引擎：**用不到的 target 直接删掉**。

模板里每个字段上方都有注释说明填什么。**某个字段具体该填什么值、取值有哪些**，查
[`ATTRIBUTES.zh-CN.md`](ATTRIBUTES.zh-CN.md)——那份文件由 schema 自动生成，因此不会与校验器不一致。

### 2. 每个引擎各产出一个制品

**Unity 编辑器工具 / 脚本 / 资源 → `.unitypackage`**（保留 GUID 与导入设置）：

```text
Unity：选中资源 > Assets > Export Package... > 取消勾选 "Include dependencies"
       > 保存为 <id>-<version>[-unity].unitypackage
```

只导出该工具真正需要的文件。**如果它需要本库中另一个工具的文件，不要重复导出——声明依赖。**

> **每个工具必须自成一个目录。** 把 `Assets/<Tool>/...` 作为唯一落点，例如
> `Assets/CoreEditorUtils/`。**不要**按用途分类散落（`Assets/Runtime/Core/`、`Assets/Editor/`）：
> 那样一个工具会铺进与整个工程共用的目录，"这个工具拥有哪些文件"就再也无法定义，
> 卸载也就失去了干净的边界。
>
> 这不是 Unity 强加的路径依赖——unitypackage 的落点就是打包时写进去的，**是打包选择**。
> `tools/check-payload-code.mjs` 会强制这条规则，散落会直接失败。

**与引擎无关的源码 / 文档 / Godot 插件 → 归档**：构建时让条目就是它们应当出现在 `contentRoot` 下的样子：

```pwsh
Compress-Archive -Path .\MyTool\* -DestinationPath my-tool-1.0.0.zip
tar -czf my-tool-1.0.0-godot.tgz -C MyTool .
```

**单个文件 → `type: file`**：不需要容器，但要声明 `targetPath` 并设 `unpack: none`。

> **一个 `file` 制品只对应一个文件。** 这一点常被误解，所以写清楚：
> `file` 是"这一坨字节原样落到 `targetPath`"，它没有条目概念，也不存在
> "一个制品带两个文件"的写法。
>
> **dll + xml（类库 + XML 注释）必须打成归档**，不能写成两个 `file` 制品——
> 一个 target 下的 `artifact` 是单数，第二个文件没有地方可声明。
> 打包时让条目路径就是它们该出现的位置，两者自然并排落地：
>
> ```pwsh
> # 目录结构先摆成目标的样子，再整目录打包
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
>   contentRoot: Assets        # 归档里的 Assets/ 铺到工程的 Assets/ 下
> ```
>
> `.xml` 注释文件与 `.dll` 放在一起，Unity 与 IDE 才会自动关联出文档提示；
> 分开落地（例如 dll 进 `Assets/`、xml 进别处）虽然能装上，但注释不会被识别。

### 3. 按规则命名并放入指定位置

```pwsh
# 只有一个 target
Copy-Item my-tool.unitypackage payloads/my-tool/artifacts/my-tool-1.0.0.unitypackage
# 有多个 target 时必须带引擎段，否则两个引擎的制品会撞名
Copy-Item my-tool.unitypackage payloads/my-tool/artifacts/my-tool-1.0.0-unity.unitypackage
Copy-Item my-tool.tgz         payloads/my-tool/artifacts/my-tool-1.0.0-godot.tgz
```

**绝不要修改已经提交过的制品。** 字节变了就意味着新 `version` 和新文件。

### 4. 用真实字节填入每个 target 的 `size` 与 `sha256`

```pwsh
node ../ToolImport/apps/cli/bin/utool.js digest payloads/my-tool/artifacts/my-tool-1.0.0-unity.unitypackage
```

对每个 target 各跑一次，并把结果写进该 target 的 `artifact`；`artifact.path` 必须指向同一个文件。

### 5. 声明能力

`provides` 是本工具向别人提供的能力；`injects` 是它需要、由**任意**提供者满足的能力。
两者都是至少两段的点分小写名（`script.api.argument-guards`），不是裸词：

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

先检查你要 `injects` 的能力是否已有工具提供，否则校验会以 `E-CAP-UNSATISFIED` 失败。
`provides` 一个别人已经提供的能力**不是错误**：多个提供者互为替代品，库级校验只发
`W-CAP-MULTIPLE` 警告；但一次安装里同时装进同一能力的两个提供者会被导入工具拒绝
（`E-CAP-CONFLICT`），所以别在同一份安装计划里依赖两个能力相同的工具。
真正需要某个具体工具（某个版本、某个 API）时才写 `dependencies`。

> `.unitypackage` 的手工打包陷阱：归档内每个 GUID 目录的 `pathname` 条目**必须**是**相对工程根**的
> 路径（以 `Assets/` 开头），不是相对仓库根的路径。写错会导致文件被放进错误的位置。

### 6. 重建索引并校验

```pwsh
node tools/registry.mjs write-index
node tools/registry.mjs validate
```

`--write-index` 会重写 `index.yaml`；`validate` 必须以 `PASSED` 结束。

---

## 新增一个外部引用型工具

当上游已发布可用包，或内置源码会让本仓库膨胀时使用。此时**不存制品**：`artifact.type` 是
`external`，且**禁止**出现 `path` / `size` / `sha256`。从 `template/tool.external.yaml` 复制。

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

`ref` **必须**是 tag 或 commit SHA。用分支头意味着相隔一周的两次导入可能在同一版本号下拿到不同代码，
这会摧毁回执模型。

请在该 payload 目录下补一个 `README.md` 说明源码实际在哪——否则这个目录在 GitHub 上看起来是空的。

注意：**导入工具侧对 external 源的解析尚未实现**。后端目前把它报告为「由调用方解析」，
并记录 `url` / `ref`；它不会自己去 clone 或浅取。因此这个形式今天只是可校验的元信息。

---

## 发布已有工具的新版本

1. 产出新制品，命名为 `<id>-<新版本>.<ext>`（多 target 时带引擎段）。
2. 放进 `payloads/<id>/artifacts/`，仅在确认没有任何东西还需要钉住旧版时才删除旧文件。
3. 更新 `version`、每个 target 的 `artifact`（path/format/size/sha256），以及在变化时的下限、
   能力声明与 `dependencies`。
4. 重建索引、校验、提交。

如果希望旧版本仍可取用，旧文件可以保留；校验只要求**声明的**制品存在，且 `artifacts/` 中没有
**未声明的**文件。若保留旧文件，就必须让它被声明——否则请删除。

注意：给已有工具新增一个引擎的 target，会改变制品文件名（从 `<id>-<version>.<ext>` 变成
`<id>-<version>-<engine>.<ext>`），因为规则只看 target 个数。这是一次版本升级。

---

## 版本号提升建议

| 变更 | 提升 |
| --- | --- |
| 修 bug，API 未变 | patch |
| 新增功能，向后兼容 | minor |
| 破坏性 API 变更，或抬高任一 target 的 `minEngineVersion` / 适配器要求键 | major |
| 新增一个引擎的 target（增加能力，不动已有引擎） | minor |
| 纯元信息修正（`description` 打字错误） | patch，制品字节不变 |

只有在代码确实需要时才抬高下限：抬高 `minEngineVersion` 对任何低于新下限的人都是破坏性变更。
下限是**逐 target** 的，所以抬高 Unity 侧不影响 Godot 侧。

---

## 提交前检查清单

每一项都由 `tools/registry.mjs` 强制。推送前跑一遍；CI 也会跑。

**先装一次本地钩子，省一轮往返：**

```pwsh
git config core.hooksPath .githooks
```

装好之后，如果提交内容涉及 `payloads/`、`schema/`、`tools/` 或 `index.yaml`，而 `index.yaml`
没跟上，提交会在本地被拦下并提示该跑哪条命令——而不是等你推送完、CI 失败、再回来补。
它**只检查、不改写**：提交时悄悄改动你已暂存的文件，比多一次提示更让人不信任钩子。
单次跳过用 `git commit --no-verify`。

- [ ] `payloads/<id>/tool.yaml` 存在且满足 `schema/tool.schema.json`
- [ ] `<id>` 是小写 kebab-case，且等于目录名
- [ ] `kind: tool` 与当前 `formatVersion` 都在（写法与取值见 [属性速查](ATTRIBUTES.zh-CN.md#formatversion)；历史修订号的迁移见 [`SPEC.zh-CN.md`](SPEC.zh-CN.md) R-MIG-4）
- [ ] `displayName`、`description`、`type`、`latest`、`versions` 已填
- [ ] `versions` 非空，每个要支持的引擎在各版本里各有 target（见 [`SPEC.zh-CN.md`](SPEC.zh-CN.md) §5）
- [ ] 每个 target 的 `requirements.minEngineVersion` 反映真实下限（不要猜，不要省）
- [ ] 每个 target 的 `artifact.type` 是 `archive` / `package` / `file` / `external` 之一，
      且非 external 时 `format` / `path` / `size` / `sha256` 齐全、与磁盘字节一致
- [ ] 制品文件名符合规则：一个 target 用 `<id>-<version>.<ext>`，多个 target 用
      `<id>-<version>-<engine>.<ext>`
- [ ] `latest` 指向 `versions` 里真实存在、且未被撤回的版本
- [ ] 若为 `external`：`source` + `url` + `ref` 已固定（tag 或 commit，**不是**分支），
      且没有 `path` / `size` / `sha256`
- [ ] `provides` / `injects` 的能力名是至少两段的点分小写名；`injects` 里每一项都有库内工具提供
- [ ] `dependencies` 引用的 `id` 都存在、约束可满足、无环
- [ ] payload 目录内**没有**源文件、DLL 或游离制品
- [ ] 已运行并提交 `node tools/registry.mjs write-index`
- [ ] `node tools/registry.mjs validate` 通过

`template/` 放的是当前骨架：`tool.bundled.yaml`（含双引擎示例与逐步填写说明）、
`tool.external.yaml`、`index.yaml`、`receipt.yaml`。先读模板再读规范。

## 遇到错误码

全部错误码与各自的修法见 [`ERRORS.zh-CN.md`](ERRORS.zh-CN.md)（**唯一出处**）。

提交一个工具时命中最多的是 `E-DEP-VERSION`：如果你抬高了某个依赖的主版本却忘了放宽约束，
它会立刻失败。其次是 `E-CAP-UNSATISFIED`，在「先写消费者、后写提供者」时最容易踩到。

校验器只发一个警告、**不会**让构建失败的是 `W-CAP-MULTIPLE`：同一能力有多个提供者，
这是合法的，它们互为替代品。被拒绝的是**一次安装计划**里同时出现两个同一能力的提供者
（`E-CAP-CONFLICT`，由导入工具的求解器判定，不属于本校验器）。

## 风格

- `description`：一段话、现在时、不要营销形容词。导入工具会原样展示。
- `displayName`：标题式大小写，短到能放进一行列表。
- `tags`：小写 kebab-case，≤ 12 个。
- 能力名：至少两段，命名空间在前（`script.api.argument-guards`、`unity.window.selection-history`），
  小写 kebab-case，≤ 96 字符。
- `displayName` / `description` 中出现非 ASCII 文本没问题；所有文件都是 **UTF-8 且不带 BOM**。
- 除非 payload 确实携带其他许可证，否则用 `"license": "MIT"`——仓库的 LICENSE 不会覆盖 payload 自己的字段。
- 注释：`.yaml` 是 YAML，可以写注释。请用它解释**为什么**这个工具存在、有哪些坑，而不是复述字段名。

## 提交信息

```text
add: <id> <version>            新增工具
update: <id> <old> -> <new>    已有工具的新版本
meta: <id> ...                 仅元信息变更，制品字节不变
remove: <id>                   删除 payload（同一提交内更新索引）
docs: ...                      仅文档或工具链
```
