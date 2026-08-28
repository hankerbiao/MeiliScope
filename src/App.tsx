import { useMemo, useState } from 'react'
import {
  Activity, AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clipboard,
  Copy, Database, Filter, Gauge, KeyRound, Layers3, Link2, LoaderCircle, LogOut, Play,
  RefreshCw, Search, Server, SlidersHorizontal, X, Zap,
} from 'lucide-react'
import { createMeiliClient, MeiliApiError } from './api'
import type { ConnectionConfig, IndexCapabilities, IndexSummary, SearchDiagnostics, SearchParams, SearchResponse } from './types'

const STORAGE_KEY = 'meiliscope-connection'
const defaultConfig: ConnectionConfig = { host: 'http://10.17.158.114:7700', apiKey: '' }
const emptyCapabilities: IndexCapabilities = {
  searchableAttributes: [], filterableAttributes: [], sortableAttributes: [], displayedAttributes: [],
  faceting: {}, rankingRules: [], stopWords: [], synonyms: {}, distinctAttribute: null,
}

const parseList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
const formatNumber = (value?: number) => typeof value === 'number' ? new Intl.NumberFormat('zh-CN').format(value) : '—'
const pretty = (value: unknown) => JSON.stringify(value, null, 2)
const readStoredConfig = (): ConnectionConfig => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? { ...defaultConfig, ...JSON.parse(value) } : defaultConfig
  } catch { return defaultConfig }
}

function App() {
  const [config, setConfig] = useState<ConnectionConfig>(() => typeof window !== 'undefined' ? readStoredConfig() : defaultConfig)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [indexes, setIndexes] = useState<IndexSummary[]>([])
  const [selectedUid, setSelectedUid] = useState('')
  const [capabilities, setCapabilities] = useState<IndexCapabilities>(emptyCapabilities)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState('')
  const [facets, setFacets] = useState('')
  const [facetFilters, setFacetFilters] = useState('')
  const [retrieve, setRetrieve] = useState('')
  const [highlight, setHighlight] = useState('')
  const [crop, setCrop] = useState('')
  const [cropLength, setCropLength] = useState(10)
  const [matchingStrategy, setMatchingStrategy] = useState<'last' | 'all'>('last')
  const [typoTolerance, setTypoTolerance] = useState(true)
  const [distinct, setDistinct] = useState('')
  const [showRankingScore, setShowRankingScore] = useState(false)
  const [limit, setLimit] = useState(20)
  const [page, setPage] = useState(1)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [diagnostics, setDiagnostics] = useState<SearchDiagnostics | null>(null)
  const [selectedHit, setSelectedHit] = useState<Record<string, unknown> | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const client = useMemo(() => connected ? createMeiliClient(config) : null, [connected, config])
  const selectedIndex = indexes.find((index) => index.uid === selectedUid)
  const hits = response?.hits || []
  const columns = useMemo(() => {
    const keys = new Set<string>()
    hits.forEach((hit) => Object.keys(hit).forEach((key) => keys.add(key)))
    return Array.from(keys).slice(0, 8)
  }, [hits])
  const searchFieldWarnings = useMemo(() => {
    const fields = [...parseList(facets), ...parseList(sort), ...parseList(retrieve), ...parseList(highlight), ...parseList(crop)]
    const known = new Set([...capabilities.searchableAttributes, ...capabilities.filterableAttributes, ...capabilities.sortableAttributes, ...capabilities.displayedAttributes])
    return Array.from(new Set(fields.filter((field) => field && !known.has(field))))
  }, [capabilities, facets, sort, retrieve, highlight, crop])

  const loadSettings = async (uid: string, api = client) => {
    if (!api || !uid) return
    setSettingsLoading(true)
    try { setCapabilities(await api.getSettings(uid)) } catch (error) { setCapabilities(emptyCapabilities); setSearchError(error instanceof Error ? error.message : '读取索引设置失败。') }
    finally { setSettingsLoading(false) }
  }

  const connect = async () => {
    if (!config.host.trim() || !config.apiKey.trim()) { setConnectionError('请输入 Meilisearch URL 和 API Key。'); return }
    setConnecting(true); setConnectionError(''); setSearchError('')
    const nextConfig = { host: config.host.trim(), apiKey: config.apiKey.trim() }
    try {
      const api = createMeiliClient(nextConfig)
      const data = await api.listIndexes()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig))
      setConfig(nextConfig); setIndexes(data.results || []); setConnected(true)
      const first = data.results?.[0]?.uid || ''
      setSelectedUid(first)
      if (first) await loadSettings(first, api)
    } catch (error) { setConnectionError(error instanceof Error ? error.message : '连接失败。') }
    finally { setConnecting(false) }
  }

  const disconnect = () => { setConnected(false); setIndexes([]); setSelectedUid(''); setResponse(null); setDiagnostics(null); setSelectedHit(null) }
  const changeIndex = async (uid: string) => { setSelectedUid(uid); setResponse(null); setDiagnostics(null); await loadSettings(uid) }

  const buildSearchParams = (pageNumber = page): SearchParams => {
    const params: SearchParams = { q: query, offset: (pageNumber - 1) * limit, limit, matchingStrategy, typoTolerance }
    const listFields: Array<[keyof SearchParams, string]> = [['facets', facets], ['sort', sort], ['attributesToRetrieve', retrieve], ['attributesToHighlight', highlight], ['attributesToCrop', crop]]
    listFields.forEach(([key, value]) => { const list = parseList(value); if (list.length) (params[key] as string[]) = list })
    if (filter.trim()) params.filter = filter.trim()
    if (facetFilters.trim()) params.facetFilters = facetFilters.split('\n').map((line) => parseList(line).map((item) => item.trim())).filter((line) => line.length)
    if (distinct.trim()) params.distinct = distinct.trim()
    if (showRankingScore) params.showRankingScore = true
    if (parseList(highlight).length) { params.highlightPreTag = '<mark>'; params.highlightPostTag = '</mark>' }
    if (parseList(crop).length) params.cropLength = cropLength
    return params
  }

  const runSearch = async (pageNumber = page) => {
    if (!client || !selectedUid) return
    setSearching(true); setSearchError(''); setSelectedHit(null)
    const params = buildSearchParams(pageNumber); const started = performance.now()
    try {
      const result = await client.search(selectedUid, params)
      setResponse(result)
      setDiagnostics({ requestUrl: `${client.host}/indexes/${encodeURIComponent(selectedUid)}/search`, requestBody: params, responseBody: result, responseTimeMs: Math.round(performance.now() - started), processingTimeMs: result.processingTimeMs, estimatedTotalHits: result.estimatedTotalHits ?? result.totalHits })
    } catch (error) {
      const message = error instanceof MeiliApiError ? `${error.message}${error.code ? ` (${error.code})` : ''}` : error instanceof Error ? error.message : '搜索失败。'
      setSearchError(message); setDiagnostics({ requestUrl: `${client.host}/indexes/${encodeURIComponent(selectedUid)}/search`, requestBody: params, responseTimeMs: Math.round(performance.now() - started), processingTimeMs: 0, error: message })
    } finally { setSearching(false) }
  }

  const resetSearch = () => { setQuery(''); setFilter(''); setSort(''); setFacets(''); setFacetFilters(''); setRetrieve(''); setHighlight(''); setCrop(''); setDistinct(''); setPage(1); setResponse(null); setDiagnostics(null); setSearchError('') }
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value) } catch { /* clipboard permission is optional */ } }

  if (!connected) return <ConnectionScreen config={config} setConfig={setConfig} connecting={connecting} error={connectionError} connect={connect} />

  return (
    <div className="app-shell">
      <header className="global-nav">
        <div className="brand"><span className="brand-mark">M</span><span>MeiliScope</span><span className="brand-sub">DEBUG WORKBENCH</span></div>
        <div className="nav-status"><span className="status-dot online" />{config.host.replace(/^https?:\/\//, '')}</div>
        <button className="nav-action" onClick={disconnect}><LogOut size={15} />断开</button>
      </header>
      <div className="sub-nav">
        <div className="sub-nav-title"><Activity size={17} />搜索调试</div>
        <div className="sub-nav-actions"><span className="connection-pill"><span className="status-dot online" />已连接</span><button className="icon-button" title="刷新索引" onClick={connect}><RefreshCw size={16} /></button></div>
      </div>

      <main className="workspace">
        <section className="workspace-heading">
          <div><p className="eyebrow">MEILISEARCH / INSPECTOR</p><h1>看见每一次搜索。</h1><p className="heading-copy">在真实索引上拆解查询、字段能力与响应性能。</p></div>
          <div className="index-picker"><label htmlFor="index-select">当前索引</label><div className="select-wrap"><Database size={15} /><select id="index-select" value={selectedUid} onChange={(event) => changeIndex(event.target.value)}>{indexes.map((index) => <option key={index.uid} value={index.uid}>{index.uid}</option>)}</select><ChevronDown size={15} /></div></div>
        </section>

        <div className="workspace-grid">
          <aside className="control-column">
            <section className="panel query-panel">
              <div className="panel-heading"><div><span className="section-kicker"><Search size={14} />QUERY</span><h2>搜索参数</h2></div><button className="text-button" onClick={resetSearch}>重置</button></div>
              <label className="field-label" htmlFor="query">查询词</label>
              <div className="query-input"><Search size={17} /><input id="query" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} onKeyDown={(event) => event.key === 'Enter' && runSearch()} placeholder="输入要搜索的内容" /><kbd>↵</kbd></div>
              <div className="field-grid two"><Field label="每页数量"><input type="number" min={1} max={1000} value={limit} onChange={(event) => { setLimit(Math.max(1, Number(event.target.value))); setPage(1) }} /></Field><Field label="匹配策略"><select value={matchingStrategy} onChange={(event) => setMatchingStrategy(event.target.value as 'last' | 'all')}><option value="last">last · 默认</option><option value="all">all · 全部</option></select></Field></div>
              <Field label="过滤表达式" hint="支持 AND / OR、比较运算"><textarea value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={'例如：price > 20 AND category = "book"'} rows={3} /></Field>
              <Field label="排序规则" hint="每行一个，字段:asc 或字段:desc"><textarea value={sort} onChange={(event) => setSort(event.target.value)} placeholder="price:asc\n_createdAt:desc" rows={2} /></Field>
              <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}><SlidersHorizontal size={15} />高级参数 <span>{showAdvanced ? '收起' : '展开'}</span><ChevronDown className={showAdvanced ? 'rotated' : ''} size={15} /></button>
              {showAdvanced && <div className="advanced-fields"><Field label="Facet 字段"><input value={facets} onChange={(event) => setFacets(event.target.value)} placeholder="brand, categories" /></Field><Field label="Facet 过滤" hint="每行一组 OR 条件"><textarea value={facetFilters} onChange={(event) => setFacetFilters(event.target.value)} placeholder={'brand:Apple, brand:Sony\ncategories:Audio'} rows={2} /></Field><Field label="返回字段"><input value={retrieve} onChange={(event) => setRetrieve(event.target.value)} placeholder="title, price, brand" /></Field><div className="field-grid two"><Field label="高亮字段"><input value={highlight} onChange={(event) => setHighlight(event.target.value)} placeholder="title, description" /></Field><Field label="裁剪字段"><input value={crop} onChange={(event) => setCrop(event.target.value)} placeholder="description" /></Field></div><Field label="裁剪长度"><input type="number" min={1} max={200} value={cropLength} onChange={(event) => setCropLength(Number(event.target.value))} /></Field><Field label="Distinct 字段"><input value={distinct} onChange={(event) => setDistinct(event.target.value)} placeholder="例如：product_id" /></Field><label className="toggle-row"><input type="checkbox" checked={typoTolerance} onChange={(event) => setTypoTolerance(event.target.checked)} /><span className="toggle-track" /><span>启用拼写容错</span></label><label className="toggle-row"><input type="checkbox" checked={showRankingScore} onChange={(event) => setShowRankingScore(event.target.checked)} /><span className="toggle-track" /><span>返回排序分数</span></label></div>}
              <button className="run-button" onClick={() => runSearch()} disabled={searching || !selectedUid}>{searching ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />}运行搜索 <span>⌘ ↵</span></button>
            </section>

            <section className="panel capabilities-panel">
              <div className="panel-heading"><div><span className="section-kicker"><Layers3 size={14} />INDEX SETTINGS</span><h2>字段能力</h2></div>{settingsLoading ? <LoaderCircle className="spin muted" size={16} /> : <button className="icon-button small" title="刷新设置" onClick={() => loadSettings(selectedUid)}><RefreshCw size={14} /></button>}</div>
              <p className="panel-note">{selectedIndex?.primaryKey ? `主键 · ${selectedIndex.primaryKey}` : '当前索引的可用能力'}</p>
              <CapabilityGroup title="可搜索" icon={<Search size={13} />} fields={capabilities.searchableAttributes} tone="blue" />
              <CapabilityGroup title="可过滤" icon={<Filter size={13} />} fields={capabilities.filterableAttributes} tone="purple" />
              <CapabilityGroup title="可排序" icon={<Zap size={13} />} fields={capabilities.sortableAttributes} tone="orange" />
              <CapabilityGroup title="可展示" icon={<Check size={13} />} fields={capabilities.displayedAttributes} tone="green" />
              {searchFieldWarnings.length > 0 && <div className="warning-note"><AlertCircle size={14} /><span>查询引用了未在 settings 中声明的字段：<strong>{searchFieldWarnings.join(', ')}</strong></span></div>}
            </section>
          </aside>

          <section className="results-column">
            <div className="metric-row"><Metric icon={<Gauge size={16} />} label="命中结果" value={formatNumber(response?.estimatedTotalHits ?? response?.totalHits)} /><Metric icon={<Zap size={16} />} label="处理耗时" value={response ? `${response.processingTimeMs} ms` : '—'} /><Metric icon={<Activity size={16} />} label="请求耗时" value={diagnostics ? `${diagnostics.responseTimeMs} ms` : '—'} /><Metric icon={<Server size={16} />} label="返回数量" value={formatNumber(hits.length)} /></div>
            {searchError && <div className="error-banner"><AlertCircle size={17} /><span>{searchError}</span><button onClick={() => runSearch()} disabled={searching}><RefreshCw size={14} />重试</button></div>}
            <section className="panel results-panel">
              <div className="panel-heading results-heading"><div><span className="section-kicker"><Database size={14} />RESULTS</span><h2>{selectedUid || '选择索引后开始'}</h2></div><div className="results-actions"><button className={`utility-button ${showDiagnostics ? 'active' : ''}`} onClick={() => setShowDiagnostics(!showDiagnostics)}><Activity size={14} />诊断</button><span className="response-badge">POST /search</span></div></div>
              {!response && !searching ? <EmptyState onRun={runSearch} /> : searching ? <div className="loading-state"><LoaderCircle className="spin" size={23} /><span>正在请求 Meilisearch…</span></div> : <><div className="table-wrap"><table><thead><tr><th className="row-number">#</th>{columns.map((column) => <th key={column}>{column}</th>)}<th className="open-col" /></tr></thead><tbody>{hits.map((hit, index) => <tr key={`${index}-${String(hit.id ?? '')}`} onClick={() => setSelectedHit(hit)}><td className="row-number">{(page - 1) * limit + index + 1}</td>{columns.map((column) => <td key={column}>{renderCell(hit[column])}</td>)}<td className="open-col"><ChevronRight size={16} /></td></tr>)}</tbody></table></div><div className="results-footer"><span>显示 {(page - 1) * limit + 1}–{(page - 1) * limit + hits.length} 条</span><div className="pagination"><button className="icon-button small" disabled={page <= 1} onClick={() => { const target = page - 1; setPage(target); runSearch(target) }}><ChevronLeft size={15} /></button><span>第 {page} 页</span><button className="icon-button small" disabled={hits.length < limit} onClick={() => { const target = page + 1; setPage(target); runSearch(target) }}><ChevronRight size={15} /></button></div></div></>}
            </section>
            {showDiagnostics && diagnostics && <Diagnostics diagnostics={diagnostics} copy={copy} />}
          </section>
        </div>
      </main>
      {selectedHit && <JsonDrawer hit={selectedHit} close={() => setSelectedHit(null)} copy={copy} />}
    </div>
  )
}

function ConnectionScreen({ config, setConfig, connecting, error, connect }: { config: ConnectionConfig; setConfig: (config: ConnectionConfig) => void; connecting: boolean; error: string; connect: () => void }) {
  return <div className="connection-shell"><header className="global-nav"><div className="brand"><span className="brand-mark">M</span><span>MeiliScope</span><span className="brand-sub">DEBUG WORKBENCH</span></div><div className="nav-status muted-nav">LOCAL TOOL · 01</div></header><main className="connection-main"><div className="connection-intro"><div className="intro-mark"><Server size={20} /></div><h1>Meilisearch<br /><em>调试工作台</em></h1></div><section className="connection-card"><div className="card-topline"><span className="section-kicker"><Link2 size={14} />NEW CONNECTION</span><span className="secure-label"><KeyRound size={13} />仅保存在此浏览器</span></div><h2>连接到 Meilisearch</h2><p className="card-copy">使用一个拥有读取权限的 API Key 即可开始。Master Key 也支持，但不会被写入代码。</p><Field label="Meilisearch URL" hint="生产地址：10.17.158.114:7700"><div className="input-with-icon"><Server size={16} /><input value={config.host} onChange={(event) => setConfig({ ...config, host: event.target.value })} placeholder="https://meili.example.com" onKeyDown={(event) => event.key === 'Enter' && connect()} /></div></Field><Field label="API Key"><div className="input-with-icon"><KeyRound size={16} /><input type="password" value={config.apiKey} onChange={(event) => setConfig({ ...config, apiKey: event.target.value })} placeholder="输入 API Key" onKeyDown={(event) => event.key === 'Enter' && connect()} /></div></Field>{error && <div className="connection-error"><AlertCircle size={16} /><span>{error}</span></div>}<button className="connect-button" onClick={connect} disabled={connecting}>{connecting ? <LoaderCircle className="spin" size={17} /> : <Link2 size={17} />} {connecting ? '正在连接…' : '连接并加载索引'}<span>↵</span></button><p className="cors-note"><CircleHelp size={14} />浏览器直连需要实例允许 CORS 请求</p></section></main><footer className="connection-footer"><span>MeiliScope v0.1</span><span>直接连接 · 不经代理 · 只读调试</span></footer></div>
}

function Field({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) { return <label className="field"><span className="field-label">{label}{hint && <small>{hint}</small>}</span>{children || <input />}</label> }
function CapabilityGroup({ title, icon, fields, tone }: { title: string; icon: React.ReactNode; fields: string[]; tone: string }) { return <div className="capability-group"><div className="capability-title"><span className={`capability-icon ${tone}`}>{icon}</span>{title}<span className="capability-count">{fields.length}</span></div><div className="chip-list">{fields.length ? fields.slice(0, 18).map((field) => <span className="field-chip" key={field}>{field}</span>) : <span className="empty-fields">未设置</span>}{fields.length > 18 && <span className="field-chip more">+{fields.length - 18}</span>}</div></div> }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="metric"><span className="metric-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div> }
function EmptyState({ onRun }: { onRun: () => void }) { return <div className="empty-state"><div className="empty-icon"><Search size={24} /></div><h3>准备好检查你的索引了吗？</h3><p>输入查询词或直接运行空查询，查看真实的命中结果。</p><button className="empty-action" onClick={onRun}><Play size={15} fill="currentColor" />运行第一次搜索</button></div> }
function Diagnostics({ diagnostics, copy }: { diagnostics: SearchDiagnostics; copy: (value: string) => void }) { return <section className="panel diagnostics-panel"><div className="panel-heading"><div><span className="section-kicker"><Activity size={14} />REQUEST DIAGNOSTICS</span><h2>请求与响应</h2></div><button className="icon-button small" title="复制请求体" onClick={() => copy(pretty(diagnostics.requestBody))}><Copy size={14} /></button></div><div className="diagnostic-grid"><div><span className="diag-label">REQUEST URL</span><code>{diagnostics.requestUrl}</code></div><div><span className="diag-label">TIMINGS</span><code>{diagnostics.responseTimeMs} ms total · {diagnostics.processingTimeMs} ms processing</code></div></div>{diagnostics.error && <div className="diagnostic-error"><AlertCircle size={14} />{diagnostics.error}</div>}<div className="code-block"><div className="code-header"><span>REQUEST · application/json</span><button onClick={() => copy(pretty(diagnostics.requestBody))}><Clipboard size={13} />复制</button></div><pre>{pretty(diagnostics.requestBody)}</pre></div>{diagnostics.responseBody && <div className="code-block response-code"><div className="code-header"><span>RESPONSE · application/json</span><button onClick={() => copy(pretty(diagnostics.responseBody))}><Clipboard size={13} />复制</button></div><pre>{pretty(diagnostics.responseBody)}</pre></div>}</section> }
function JsonDrawer({ hit, close, copy }: { hit: Record<string, unknown>; close: () => void; copy: (value: string) => void }) { return <div className="drawer-backdrop" onClick={close}><aside className="json-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="section-kicker"><Layers3 size={14} />DOCUMENT</span><h2>完整 JSON</h2></div><div className="drawer-actions"><button className="icon-button small" title="复制 JSON" onClick={() => copy(pretty(hit))}><Copy size={15} /></button><button className="icon-button small" title="关闭" onClick={close}><X size={17} /></button></div></div><div className="drawer-meta"><span>ID</span><strong>{String(hit.id ?? '未提供')}</strong></div><pre className="json-view">{pretty(hit)}</pre></aside></div> }
function renderCell(value: unknown) { if (value === null || value === undefined) return <span className="null-cell">null</span>; if (typeof value === 'object') return <span className="object-cell">{Array.isArray(value) ? `[${value.length} 项]` : '{…}'}</span>; const text = String(value); return <span title={text}>{text.length > 90 ? `${text.slice(0, 90)}…` : text}</span> }

export default App
