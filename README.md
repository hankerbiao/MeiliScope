# MeiliScope

Meilisearch 搜索诊断台。一个运行在浏览器中的只读调试工具，用来连接真实的 Meilisearch 实例，检查索引设置、搜索参数、字段能力和响应性能。

## 项目定位

MeiliScope 面向需要排查“为什么搜不到、为什么不能过滤、为什么排序不生效”的开发者和运维人员。它直接调用 Meilisearch REST API，不经过第三方代理，不修改索引数据或索引配置。

## 功能

- 连接自托管或云端 Meilisearch 实例
- 自动加载索引列表并切换索引
- 读取索引 settings，查看字段的搜索、过滤、排序和展示能力
- 使用 query、filter、sort、facets、facetFilters 和分页进行搜索
- 调整 matching strategy、拼写容错、distinct、highlight、crop 等高级参数
- 标记查询中引用但未在 settings 中声明的字段
- 以动态表格查看搜索结果，点击记录查看完整 JSON
- 查看请求 URL、请求体、原始响应和请求/处理耗时
- 复制请求体或文档 JSON，便于复现问题
- 在浏览器本地保存当前连接配置

## 项目名称

**MeiliScope**

- `Meili`：来自 Meilisearch
- `Scope`：表示观察、定位和诊断搜索行为

中文名称：**Meilisearch 搜索诊断台**

## 快速开始

环境要求：Node.js 18+，npm 9+。

```bash
npm install
npm run dev
```

打开终端中显示的本地地址，默认通常是：

```text
http://localhost:5173/
```

生产构建：

```bash
npm run build
npm run preview
```

## 连接实例

连接页默认填充生产 Meilisearch 地址：

```text
http://10.17.158.114:7700
```

输入 API Key 后点击“连接并加载索引”。连接配置只保存在当前浏览器的 `localStorage` 中，不会提交到 MeiliScope 自己的服务器。

> 请不要把 Master Key 写入源码、提交到 Git，或粘贴到公开 issue。调试完成后可以点击“断开”，并清理浏览器本地存储。

## CORS 与权限

MeiliScope 使用浏览器直连 Meilisearch，因此目标实例必须允许当前页面来源的 CORS 请求。如果连接失败，请检查：

1. Meilisearch 的 CORS 配置是否允许 `http://localhost:5173`。
2. API Key 是否至少拥有读取索引、读取 settings 和执行搜索的权限。
3. URL 是否包含正确的协议和端口，例如 `http://10.17.158.114:7700`。
4. 浏览器所在机器是否能够访问目标地址。

## 技术栈

- React
- TypeScript
- Vite
- lucide-react
- Meilisearch REST API

## 目录结构

```text
src/
  api.ts       Meilisearch API client 和错误处理
  types.ts     连接、索引、搜索和诊断类型
  App.tsx      连接页与搜索调试工作台
  styles.css   全局设计 token、布局和响应式样式
  main.tsx     React 应用入口
```

## 当前范围

当前版本专注于只读搜索诊断，不包含：

- 文档新增、编辑或删除
- 索引 settings 写入
- 任务队列管理
- 同义词、停用词和词典编辑
- 多连接配置管理

## 许可证

项目许可证可根据团队发布策略补充。当前仓库未声明开源许可证。
