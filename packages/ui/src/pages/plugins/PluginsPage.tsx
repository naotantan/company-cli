import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import { Alert, Button, Card, LoadingSpinner } from '../../components/ui';
import { PluginCard, StarIcon, type Plugin } from './PluginCard.tsx';
import { PluginDetailModal } from './PluginDetailModal.tsx';
import { usePluginActions } from './usePluginActions.ts';
import api from '../../lib/api.ts';
import { Sparkles, Search, X, Zap, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const ALL_CATEGORY = '__all__';
const FAVORITES_TAB = '__favorites__';

/** localStorageでお気に入りスキルIDを管理するhook */
function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('plugin_favorites');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      try { localStorage.setItem('plugin_favorites', JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}

const RefreshIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const EditIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const CategoryIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h8M4 18h12" />
  </svg>
);

const SyncIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2v6h-6M3 22v-6h6M21 13a9 9 0 01-15.36 6.36M3 11A9 9 0 0118.36 4.64" />
  </svg>
);

/** コピー可能なプロンプト表示 */
function CopyablePrompt({ prompt }: { prompt: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs font-mono bg-th-surface-2 hover:bg-th-surface-3 text-th-text-2 px-2 py-1 rounded-th-sm transition-colors border border-th-border"
    >
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      <span>{copied ? t('plugins.copiedPrompt') : prompt}</span>
    </button>
  );
}

interface PluginGridProps {
  plugins: Plugin[];
  deleting: string | null;
  onToggle: (p: Plugin) => void;
  onUninstall: (p: Plugin) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function PluginGrid({ plugins, deleting, onToggle, onUninstall, favorites, onToggleFavorite, t }: PluginGridProps) {
  const [detailPlugin, setDetailPlugin] = useState<Plugin | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {plugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            deleting={deleting}
            onToggle={onToggle}
            onUninstall={onUninstall}
            onShowDetail={setDetailPlugin}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            t={t}
          />
        ))}
      </div>

      {detailPlugin && (
        <PluginDetailModal
          plugin={detailPlugin}
          onClose={() => setDetailPlugin(null)}
        />
      )}
    </>
  );
}

interface RecommendResult {
  id: string; name: string; description?: string; category?: string;
  trigger_type?: string; usage_count?: number; similarity: number;
}

/** スキル推薦ウィジェット */
interface DuplicatePair {
  similarity: number;
  plugin_a: { id: string; name: string; description: string | null; enabled: boolean };
  plugin_b: { id: string; name: string; description: string | null; enabled: boolean };
}

/** 重複スキル候補ウィジェット */
function DuplicateDetector({ onShowDetail }: { onShowDetail: (p: Plugin) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery<{ data: DuplicatePair[]; meta: { threshold: number } }>(
    ['plugins-duplicates', 0.95],
    () => api.get('/plugins/duplicates?threshold=0.95').then((r) => r.data),
    { staleTime: 5 * 60 * 1000 },
  );
  const pairs = data?.data ?? [];
  if (isLoading || pairs.length === 0) return null;

  return (
    <div className="rounded-th border border-th-warning/40 bg-th-warning-dim overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-th-warning/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-th-warning flex-shrink-0" />
          <span className="text-sm font-medium text-th-warning">
            {t('plugins.duplicateDetected', { count: pairs.length })}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-th-warning" /> : <ChevronDown className="h-4 w-4 text-th-warning" />}
      </button>

      {open && (
        <div className="border-t border-th-warning/20 divide-y divide-th-warning/10">
          {pairs.map((pair, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <span className="mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-th-warning/20 text-th-warning flex-shrink-0">
                {pair.similarity}%
              </span>
              <div className="flex-1 min-w-0 flex flex-wrap gap-2 items-center text-sm text-th-text-2">
                <button
                  onClick={() => onShowDetail({ id: pair.plugin_a.id, name: pair.plugin_a.name, description: pair.plugin_a.description, enabled: pair.plugin_a.enabled } as Plugin)}
                  className="font-mono text-xs px-2 py-0.5 rounded bg-th-surface-2 hover:bg-th-surface-3 text-th-text transition-colors truncate max-w-[180px]"
                >
                  {pair.plugin_a.name}
                </button>
                <span className="text-th-text-4 text-xs">≈</span>
                <button
                  onClick={() => onShowDetail({ id: pair.plugin_b.id, name: pair.plugin_b.name, description: pair.plugin_b.description, enabled: pair.plugin_b.enabled } as Plugin)}
                  className="font-mono text-xs px-2 py-0.5 rounded bg-th-surface-2 hover:bg-th-surface-3 text-th-text transition-colors truncate max-w-[180px]"
                >
                  {pair.plugin_b.name}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillRecommender({ onShowDetail }: { onShowDetail: (p: Plugin) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecommendResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/plugins/recommend', { params: { q, limit: 6 } });
      setResults(res.data.data ?? []);
      setSearched(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  return (
    <div className="rounded-th border border-th-accent/30 bg-gradient-to-br from-th-accent/5 to-transparent p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-th-accent" />
        <span className="text-sm font-semibold text-th-text">{t('plugins.aiRecommend')}</span>
        <span className="text-xs text-th-text-4">— {t('plugins.aiRecommendHint')}</span>
      </div>

      {/* 検索入力 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-th-text-4" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('plugins.aiRecommendPlaceholder')}
          className="w-full pl-9 pr-9 py-2 text-sm rounded-th border border-th-border bg-th-surface-1 text-th-text placeholder:text-th-text-4 focus:outline-none focus:border-th-accent"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setSearched(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-4 hover:text-th-text">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 結果 */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-th-text-4 py-1">
          <div className="w-3 h-3 border-2 border-th-accent/40 border-t-th-accent rounded-full animate-spin" />
          {t('plugins.searching')}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-xs text-th-text-4 py-1">{t('plugins.noRecommendations')}</p>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => onShowDetail(r as unknown as Plugin)}
              className="text-left rounded-th-sm border border-th-border bg-th-surface-1 hover:border-th-accent/50 hover:bg-th-accent/5 px-3 py-2.5 transition-all group"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-mono font-semibold text-th-accent truncate">
                  /{r.name}
                </span>
                <span className="text-[10px] text-th-text-4 shrink-0 flex items-center gap-0.5">
                  <Zap className="h-2.5 w-2.5" />
                  {Math.round(r.similarity * 100)}%
                </span>
              </div>
              {r.description && (
                <p className="text-[11px] text-th-text-3 mt-0.5 line-clamp-2 leading-relaxed">{r.description}</p>
              )}
              {r.category && (
                <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-th-surface-2 text-th-text-4">{r.category}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PluginsPage() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newRepositoryUrl, setNewRepositoryUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [recommendDetail, setRecommendDetail] = useState<Plugin | null>(null);
  const { favorites, toggleFavorite } = useFavorites();

  const {
    busyOp,
    actionError,
    syncResult,
    deleting,
    installResult,
    setActionError,
    setSyncResult,
    setInstallResult,
    handleCreate,
    handleSync,
    handleUpdateAllRepos,
    handleFetchUsage,
    handleCategorize,
    handleTranslateUsage,
    handleToggleEnabled,
    handleUninstall,
  } = usePluginActions();

  const { data: plugins, isLoading, error } = useQuery<Plugin[]>(
    'plugins',
    () => api.get('/plugins').then((r) => r.data.data),
  );

  const categories = [
    ALL_CATEGORY,
    ...Array.from(new Set((plugins ?? []).map((p) => p.category ?? t('plugins.otherCategory')))).sort(),
  ];

  const filtered = (plugins ?? []).filter((p) => {
    if (selectedCategory === FAVORITES_TAB) return favorites.has(p.id);
    if (selectedCategory === ALL_CATEGORY) return true;
    return (p.category ?? t('plugins.otherCategory')) === selectedCategory;
  });

  const grouped: Record<string, Plugin[]> = {};
  if (selectedCategory === ALL_CATEGORY) {
    for (const p of filtered) {
      const cat = p.category ?? t('plugins.otherCategory');
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }
  }
  const groupKeys = Object.keys(grouped).sort();

  const onInstallSuccess = () => {
    setNewRepositoryUrl('');
    setShowCreate(false);
  };

  if (isLoading) return <div className="p-6"><LoadingSpinner text={t('common.loading')} /></div>;
  if (error) return <div className="p-6"><Alert variant="danger" message={t('plugins.fetchError')} /></div>;

  return (
    <div className="p-6 space-y-5">
      {actionError && <Alert variant="danger" message={actionError} onClose={() => setActionError('')} />}

      {syncResult && (
        <div className="bg-th-success-dim border border-th-success/20 rounded-th-md px-4 py-3 text-th-success text-sm">
          {syncResult}
          <button
            onClick={() => setSyncResult('')}
            aria-label={t('common.close')}
            className="ml-2 text-th-success/60 hover:text-th-success"
          >
            ✕
          </button>
        </div>
      )}

      {/* インストール完了プレビューカード */}
      {installResult && (
        <div className="bg-th-surface-0 border border-th-accent/30 rounded-th-md p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-th-success text-lg">✓</span>
                <h2 className="font-semibold text-th-text">
                  {t('plugins.installSuccess', { count: installResult.imported })}
                </h2>
              </div>
              <p className="text-th-text-4 text-xs">{installResult.repo}</p>
            </div>
            <button
              onClick={() => setInstallResult(null)}
              aria-label={t('common.close')}
              className="text-th-text-3 hover:text-th-text text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {installResult.designCount > 0 && (
            <div className="bg-th-accent-dim border border-th-accent/20 rounded-th-sm px-3 py-2 text-sm text-th-accent">
              🎨 {t('plugins.designCollection', { count: installResult.designCount })}
            </div>
          )}

          <div className="space-y-2">
            {installResult.skillDetails.map((skill) => (
              <div key={skill.name} className="bg-th-surface-1 rounded-th-sm p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-th-accent-dim text-th-accent px-2 py-0.5 rounded-th-sm border border-th-accent/20">
                    {skill.name}
                  </span>
                  {skill.isDesign && <span className="text-xs text-th-text-4">{t('plugins.designCollectionLabel')}</span>}
                </div>
                <p className="text-xs text-th-text-3">{skill.description}</p>
                {skill.samplePrompt && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-th-text-4">{t('plugins.exampleLabel')}</span>
                    <CopyablePrompt prompt={skill.samplePrompt} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-th-text-4">
            {t('plugins.installSuccessHint')}
          </p>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-th-text">{t('plugins.title')}</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* 管理アクション群 */}
          <div className="flex items-center gap-1.5 border border-th-border rounded-th-md p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpdateAllRepos}
              loading={busyOp === 'update'}
              disabled={busyOp !== null && busyOp !== 'update'}
              icon={<RefreshIcon />}
              title={t('plugins.updateAllTitle')}
            >
              {t('plugins.updateAll')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFetchUsage}
              loading={busyOp === 'fetchUsage'}
              disabled={busyOp !== null && busyOp !== 'fetchUsage'}
              icon={<EditIcon />}
            >
              {t('plugins.fetchUsage')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCategorize}
              loading={busyOp === 'categorize'}
              disabled={busyOp !== null && busyOp !== 'categorize'}
              icon={<CategoryIcon />}
            >
              {t('plugins.categorize')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranslateUsage}
              loading={busyOp === 'translate'}
              disabled={busyOp !== null && busyOp !== 'translate'}
              icon={<EditIcon />}
            >
              {t('plugins.translateUsage')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              loading={busyOp === 'sync'}
              disabled={busyOp !== null && busyOp !== 'sync'}
              icon={<SyncIcon />}
            >
              {t('plugins.sync')}
            </Button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreate(true)}
          >
            {t('plugins.newPlugin')}
          </Button>
        </div>
      </div>

      {/* 重複スキル検知ウィジェット */}
      <DuplicateDetector onShowDetail={(p) => setRecommendDetail(p)} />

      {/* AIスキル推薦ウィジェット */}
      <SkillRecommender onShowDetail={(p) => setRecommendDetail(p)} />

      {/* 新規作成フォーム */}
      {showCreate && (
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-th-text">{t('plugins.skillInstallTitle')}</h2>
          <input
            type="text"
            value={newRepositoryUrl}
            onChange={(e) => setNewRepositoryUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate(newRepositoryUrl, onInstallSuccess)}
            placeholder={t('plugins.skillInstallPlaceholder')}
            className="w-full bg-th-surface-1 border border-th-border rounded-th-sm px-3 py-2 text-th-text text-sm placeholder:text-th-text-4 focus:outline-none focus:ring-2 focus:ring-th-accent focus:border-transparent"
            autoFocus
          />
          <p className="text-th-text-4 text-xs">{t('plugins.skillInstallHelp')}</p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleCreate(newRepositoryUrl, onInstallSuccess)}
              disabled={!newRepositoryUrl.trim() || busyOp !== null}
              loading={busyOp === 'install'}
            >
              {t('plugins.install')}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setShowCreate(false); setNewRepositoryUrl(''); }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      )}

      {/* カテゴリタブ */}
      {(plugins ?? []).length > 0 && (
        <div className="flex gap-2 flex-wrap border-b border-th-border pb-3">
          {/* お気に入りタブ（先頭） */}
          <button
            onClick={() => setSelectedCategory(FAVORITES_TAB)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === FAVORITES_TAB
                ? 'bg-amber-500 text-white'
                : 'bg-th-surface-1 hover:bg-th-surface-2 text-amber-500'
            }`}
          >
            <StarIcon filled={selectedCategory === FAVORITES_TAB} />
            {t('plugins.favoritesTab')}
            <span className={`text-xs ${selectedCategory === FAVORITES_TAB ? 'text-white/70' : 'text-th-text-4'}`}>
              {favorites.size}
            </span>
          </button>

          {categories.map((cat) => {
            const count = cat === ALL_CATEGORY
              ? (plugins ?? []).length
              : (plugins ?? []).filter((p) => (p.category ?? t('plugins.otherCategory')) === cat).length;
            const label = cat === ALL_CATEGORY ? t('plugins.allCategory') : cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-th-accent text-white'
                    : 'bg-th-surface-1 hover:bg-th-surface-2 text-th-text-2'
                }`}
              >
                {label}
                <span className={`ml-1.5 text-xs ${selectedCategory === cat ? 'text-white/70' : 'text-th-text-4'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* スキル一覧 */}
      {(plugins ?? []).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-th-text-3">{t('plugins.noPluginsInstalled')}</p>
          <Button
            variant="primary"
            size="md"
            className="mt-4"
            onClick={() => setShowCreate(true)}
          >
            {t('plugins.createFirst')}
          </Button>
        </div>
      ) : selectedCategory === ALL_CATEGORY ? (
        // グループ表示
        <div className="space-y-8">
          {groupKeys.map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-semibold text-th-text">{cat}</h2>
                <span className="text-xs text-th-text-4 bg-th-surface-1 px-2 py-0.5 rounded-full">
                  {grouped[cat].length}
                </span>
              </div>
              <PluginGrid
                plugins={grouped[cat]}
                deleting={deleting}
                onToggle={handleToggleEnabled}
                onUninstall={handleUninstall}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                t={t}
              />
            </div>
          ))}
        </div>
      ) : (
        // フィルタ表示 / お気に入り
        <PluginGrid
          plugins={filtered}
          deleting={deleting}
          onToggle={handleToggleEnabled}
          onUninstall={handleUninstall}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          t={t}
        />
      )}

      {/* 推薦結果のDetailモーダル */}
      {recommendDetail && (
        <PluginDetailModal plugin={recommendDetail} onClose={() => setRecommendDetail(null)} />
      )}
    </div>
  );
}
