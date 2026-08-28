export type ConnectionConfig = { host: string; apiKey: string }

export type IndexSummary = {
  uid: string
  primaryKey?: string
  createdAt?: string
  updatedAt?: string
  name?: string
}

export type IndexCapabilities = {
  searchableAttributes: string[]
  filterableAttributes: string[]
  sortableAttributes: string[]
  displayedAttributes: string[]
  faceting: Record<string, unknown>
  rankingRules: string[]
  stopWords: string[]
  synonyms: Record<string, string[]>
  distinctAttribute?: string | null
}

export type SearchParams = {
  q: string
  offset: number
  limit: number
  filter?: string
  facets?: string[]
  facetFilters?: string[][]
  sort?: string[]
  attributesToRetrieve?: string[]
  matchingStrategy?: 'last' | 'all'
  attributesToHighlight?: string[]
  highlightPreTag?: string
  highlightPostTag?: string
  attributesToCrop?: string[]
  cropLength?: number
  showRankingScore?: boolean
}

export type SearchResponse = {
  hits: Record<string, unknown>[]
  query: string
  processingTimeMs: number
  limit: number
  offset: number
  estimatedTotalHits?: number
  totalHits?: number
  facetDistribution?: Record<string, Record<string, number>>
  facetStats?: Record<string, { min: number; max: number }>
}

export type SearchDiagnostics = {
  requestUrl: string
  requestBody: SearchParams
  responseBody?: SearchResponse
  responseTimeMs: number
  processingTimeMs: number
  estimatedTotalHits?: number
  error?: string
}
