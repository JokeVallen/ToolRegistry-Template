# 错误码参考

工具链会发出的全部错误码，**唯一出处**。按「你会怎么遇到它」分组，而不是按代码模块分组。

前缀：`E-` 是失败，`W-` 是警告（不阻断任何操作）。

**语言**：[中文](ERRORS.zh-CN.md) · [English](ERRORS.en.md) · [返回目录](../README.md)

---

## 你要提交工具，只关心这一节

跑 `node tools/registry.mjs validate` 时可能看到的码。左边是你看到的，右边是真正该改的地方。

### 元信息本身

| 码 | 含义 | 怎么修 |
| --- | --- | --- |
| `E-LAYOUT` | 仓库根缺少 `payloads/` | 确认你在仓库根运行 |
| `E-MANIFEST-MISSING` | payload 目录里没有 `tool.yaml` | 从 `template/` 复制一份 |
| `E-MANIFEST` | `tool.yaml` 读取失败——不是合法 YAML、含多个文档，或根不是映射 | 检查缩进；制表符不能用于缩进；一个文件只能有一个文档 |
| `E-UTOOL-BOM` | 文件以 UTF-8 BOM 开头 | 用「UTF-8 无 BOM」重新保存。BOM 会把第一个键名变成 `\uFEFFkind` |
| `E-SCHEMA` | 违反 schema：缺必需字段、未知字段、取值不符 | 按报出的字段路径改；能力名不合规也在这里报出 |

### 身份与结构

| 码 | 含义 | 怎么修 |
| --- | --- | --- |
| `E-ID-FORMAT` | `id` 不是小写 kebab-case | 小写字母、数字、单个连字符；3–64 字符 |
| `E-ID-DIR` | 目录名与 `id` 不一致 | 让两者完全相同 |
| `E-PAYLOAD-EXTRA` | payload 里有游离文件（源码、DLL、备份……） | 见[允许放什么](#允许放什么) |
| `E-TARGETS-MISSING` | `targets` 缺失或为空 | 至少声明一个引擎 |
| `E-TARGET-REQUIREMENTS` | target 缺少 `requirements` 或 `minEngineVersion` | `minEngineVersion` 是必填，不要猜也不要省 |


### 制品

| 码 | 含义 | 怎么修 |
| --- | --- | --- |
| `E-ARTIFACT-TYPE` | `type` 不是四种之一，或 `file` 没有 `unpack: none` | 见[属性速查](ATTRIBUTES.zh-CN.md#artifact-type) |
| `E-ARTIFACT-NAME` | 文件名或所在目录不符合约定：必须是 `payloads/<id>/artifacts/<id>-<版本>[-<引擎>].<扩展名>` | 一个 target 不带引擎段，多个 target 必须带；位置与文件名一起检查 |
| `E-ARTIFACT-MISSING` | target 没有 `artifact`，或声明的制品不存在 | 每个 target 恰好一个制品，且文件要在磁盘上 |
| `E-ARTIFACT-PATHNAME` | unitypackage 内的 `pathname` 不是相对工程根的路径 | 必须以 `Assets/` 开头 |
| `E-ARTIFACT-SIZE` | `size` 与实际字节数不符 | 跑 `utool digest` 重新填 |
| `E-ARTIFACT-HASH` | `sha256` 与实际摘要不符 | 跑 `utool digest` 重新填 |
| `E-ARTIFACT-TARGETPATH` | `type: file`，或任何 `unpack: none` 的制品，缺少 `targetPath` | 补上落点，或去掉 `unpack: none` 让处理器解包 |
| `E-ARTIFACT-FORMAT` | 字节与声明的 `format` 不符 | 扩展名改了但内容没变，是最常见的原因 |
| `E-ARTIFACT-FORMAT-UNSUPPORTED` | 没有该格式的处理器 | `unitypackage` 需要 Unity 适配器已加载 |
| `E-ARTIFACT-EMPTY` | 归档里一个条目都没有 | 重新打包 |
| `E-ARTIFACT-UNSAFE` | 条目名逃出目标根目录（tar-slip / zip-slip） | 重新打包，不要用绝对路径或 `..` |
| `E-ARTIFACT-STRAY` | `artifacts/` 中有未声明的文件 | 删掉它，或在 `versions` 里声明它 |
| `E-EXTERNAL-INCOMPLETE` | `external` 缺 `source` / `url` / `ref` | 三者齐全，且**禁止** `path`/`size`/`sha256` |

### 版本与依赖

| 码 | 含义 | 怎么修 |
| --- | --- | --- |
| `E-VERSIONS-MISSING` | `versions` 缺失或为空 | 至少一个版本 |
| `E-LATEST-UNKNOWN` | `latest` 不指向 `versions` 里任何一项 | 让两者完全一致 |
| `E-VERSIONS-DUPLICATE` | 同一个版本号出现两次 | 合并或改名 |
| `E-YANKED-LATEST` | `latest` 指向一个被撤回的版本 | 把 `latest` 移到未撤回的版本 |
| `E-DEP-MISSING` | 依赖了不存在的 `id` | 检查拼写，或先提交被依赖的工具 |
| `E-DEP-VERSION` | 约束不被本库提供的版本满足 | 抬高依赖版本后忘了放宽约束，最常见 |
| `E-DEP-CONSTRAINT` | 约束表达式本身非法 | 见[属性速查](ATTRIBUTES.zh-CN.md#dependencies) |
| `E-VERSION-NOT-FOUND` | 显式指定的版本没有发布 | 核对可用版本；`utool show <id>` 会列出它们 |
| `E-DEP-SELF` | 依赖自身 | 删掉 |
| `E-DEP-CYCLE` | 依赖成环 | 断开；**禁止**自动打破 |
| `E-CAP-FORMAT` | 能力名不合法 | 至少两段点分小写，如 `script.api.argument-guards` |
| `E-CAP-UNSATISFIED` | 注入的能力无人提供 | 先写提供者，或改为 `dependencies` |
| `W-CAP-MULTIPLE` | 同一能力有多个提供者 | **合法**，仅提示；它们互为替代品 |

### 索引

| 码 | 含义 | 怎么修 |
| --- | --- | --- |
| `E-INDEX-MISSING` | 缺少 `index.yaml` | 跑 `node tools/registry.mjs write-index` |
| `E-INDEX` | `index.yaml` 读取失败（不是合法 YAML、`kind` 不是 `index` 等） | 它是生成物，重新生成而不是手改 |
| `E-INDEX-STALE` | 索引与 payloads 不一致 | 跑 `write-index` 并一起提交；装了本地钩子会提前拦住 |

## 允许放什么

`payloads/<id>/` 下**只允许**：

```text
payloads/<id>/
├─ tool.yaml            必需
├─ artifacts/           必需（external 类型可以没有）
│  └─ <id>-<版本>[-<引擎>].<扩展名>
└─ README.md            可选，仅用于 external 说明源码在哪
```

源文件、DLL、压缩包、备份文件一律不允许——它们会让「只导入封存制品」这条规则失效。
被 `artifacts/` 引用到的文件必须在 `versions` 里声明；反过来，`artifacts/` 里也不能有未声明的文件。

## 你实现导入工具时才会遇到的码

按阶段分组。这些不会在 `utool validate` 时出现。

### 文档加载

| 码 | 含义 |
| --- | --- |
| `E-UTOOL-READ` | 文件无法读取 |
| `E-UTOOL-YAML` | 不是合法 YAML，或含多个文档 |
| `E-UTOOL-EMPTY` | 文档为空 |
| `E-UTOOL-ROOT` | 根节点不是映射 |
| `E-UTOOL-KIND-MISSING` | 缺少 `kind` 判别器 |
| `E-UTOOL-KIND-UNKNOWN` | `kind` 不认识；读方**必须**拒绝而不是猜测 |
| `E-UTOOL-KIND-MISMATCH` | `kind` 与期望不符（期望 `tool` 却拿到 `index`） |
| `E-UTOOL-VERSION-MISSING` | 缺少 `formatVersion` |
| `E-UTOOL-VERSION-UNSUPPORTED` | `formatVersion` 不是本实现支持的版本 |
| `E-ID-MISMATCH` | 请求的 id 与文档声明的 id 不一致 |
| `E-MANIFEST` | 清单读取失败，且底层没有给出更具体的码 |

### 求解

| 码 | 含义 |
| --- | --- |
| `E-DEP-FETCH` | 依赖的清单无法取得 |
| `E-CAP-CONFLICT` | **同一个安装计划内**同一能力有多个提供者；消费者无法分辨拿到的是哪个 |
| `E-CAP-PROVIDER` | 选中的提供者清单无法加载 |
| `E-CAP-PROVIDER-ENGINE` | 唯一的提供者不支持所请求的引擎 |
| `E-CAP-PROVIDER-DEP` | 提供者自身的依赖不在计划内，拒绝半途加入 |
| `E-PLATFORM` | 宿主低于某个声明下限；错误里带上要求项与提出要求的工具 |
| `E-PLATFORM-PARSE` | 下限值无法比较（写法非法） |

引擎适配器对**自己不认识的**需求键返回 `undefined` 而不是 `false`。核心把 `undefined` 读作
「该适配器无法判断」，于是**报告**该下限而不强制。若返回 `false`，一旦有人新增一个需求键，
安装就会被静默阻断——那正是适配器分离要避免的耦合。

### 制品与容器

| 码 | 含义 |
| --- | --- |
| `E-ARTIFACT` | 制品处理失败，且底层没有给出更具体的码 |
| `E-ARTIFACT-GZIP` | 不是可读的 gzip 数据 |
| `E-ARTIFACT-ZSTD` | 不是可读的 zstd 帧 |
| `E-ARTIFACT-CODEC` | 该 Node 构建缺少所需编解码器（zstd 需要 Node 22 以上） |
| `E-ARTIFACT-ZIP` | zip 中央目录损坏 |
| `E-ARTIFACT-ZIP-METHOD` | zip 使用了受支持之外的压缩方法（仅 stored 与 deflate） |
| `E-ARTIFACT-TAR` | tar 头损坏 |
| `E-HANDLER-CONTRACT` | 容器处理器违反契约（返回既无字节、也无读取方式的条目） |
| `E-INSTALL-INTO` | `--into` 给的目标不是可用的工程内相对目录（为空、绝对路径、带盘符、或含 `..`） |
| `E-INSTALL-ROOT` | 某个计划落点不在该工具自己的安装目录内，无法整体迁移；此时不写入任何文件 |

### 来源与网络

| 码 | 含义 |
| --- | --- |
| `E-SOURCE-GIT` | 传入了 git 远端；后端不 shell out 到 git，请先克隆再传目录 |
| `E-NETWORK` | 无法访问注册库地址。配置了镜像时，只有这个码会触发切换 |
| `E-HTTP` | 非 2xx 响应 |
| `E-NOT-FOUND` | 请求的文件在注册库中不存在。**不会**触发镜像切换：注册库已经答复了 |
| `E-NO-FETCH` | 该运行时没有可用的 fetch 实现 |
| `E-MIRROR-LOCAL` | 给本地目录注册库指定了镜像；本地目录不接受镜像 |

### 回执

| 码 | 含义 |
| --- | --- |
| `E-RECEIPT-INVALID` | 回执无法读取，必须修复或删除 |
| `E-RECEIPT-MISSING` | 没有该工具的回执，因此没有可回滚的目标 |

### 工具链自身

| 码 | 含义 |
| --- | --- |
| `E-UNINSTALL-FILE` | 卸载时某个文件无法删除（常见原因：被编辑器或版本控制占用） |
| `E-DEP-REQUIRED` | 该工具仍被其他已安装的工具依赖；卸载被拒绝，除非加 `--force` |
| `E-DIGEST-READ` | `utool digest` 无法读取指定文件 |
| `E-UNEXPECTED` | 未预期的内部错误；属于缺陷，请报告 |
| `E-UNKNOWN` | 无法归类的失败 |
