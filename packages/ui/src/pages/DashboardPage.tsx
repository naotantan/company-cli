import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import {
  Bot, Zap, Terminal, Loader2, Send, Square,
  Clock, FileCode, TrendingUp, ChevronRight,
  AlertTriangle, CheckCircle2, Circle, XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from '@maestro/i18n';
import api from '../lib/api.ts';
import { Alert, Card, CardBody, LoadingSpinner } from '../components/ui';

// ─── 型定義 ────────────────────────────────────────────────────────────────

interface AnalyticsOverview {
  active_agents: number;
  open_issues: number;
  today_sessions: number;
  total_skills: number;
}

interface SessionRow {
  id: string;
  headline: string | null;
  session_ended_at: string;
  changed_files: string[] | null;
  agent_id: string | null;
}

interface AnalyticsSessions {
  data: SessionRow[];
  meta: { total_sessions: number; total_files_changed: number; period: string };
}

interface SkillUsageStat {
  name: string;
  count: number;
}

interface Job {
  id: string;
  prompt: string;
  status: string;
  result: string | null;
  error_message: string | null;
  created_at: string;
}

interface CostEvent {
  id: string;
  model: string;
  cost_usd: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

// ─── ユーティリティ ─────────────────────────────────────────────────────────

function relativeTime(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('dashboard.justNow');
  if (min < 60) return t('dashboard.minutesAgo', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('dashboard.hoursAgo', { count: h });
  const d = Math.floor(h / 24);
  return t('dashboard.daysAgo', { count: d });
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

// ─── メトリクスカード ────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon, to, trend, trendLabel, barPercent, barColor,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  to?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  barPercent?: number;
  barColor?: string;
}) {
  const content = (
    <div className="relative bg-th-surface-0 rounded-th border border-th-border p-5 shadow-th overflow-hidden hover:border-th-accent/30 transition-colors group">
      <div className="flex justify-between items-start mb-3">
        <span className="text-[13px] font-medium text-th-text-3">{label}</span>
        <div className="bg-th-surface-2 text-th-text-3 p-1.5 rounded-th-md group-hover:text-th-accent transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold gradient-text">{value}</span>
        {trendLabel && (
          <span className={clsx(
            'text-xs font-medium flex items-center gap-0.5',
            trend === 'up' ? 'text-th-success' : trend === 'down' ? 'text-th-danger' : 'text-th-text-4',
          )}>
            {trendLabel}
          </span>
        )}
      </div>
      {barPercent !== undefined && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-th-surface-2">
          <div
            className={clsx('h-full rounded-r-full transition-all duration-700', barColor ?? 'bg-th-accent')}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      )}
    </div>
  );

  if (to) return <Link to={to} className="block">{content}</Link>;
  return content;
}

// ─── アクティビティフィード ──────────────────────────────────────────────────

function ActivityFeed() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<AnalyticsSessions>(
    ['analytics-sessions', '7d'],
    () => api.get('/analytics/sessions?period=7d').then(r => r.data),
    { staleTime: 5 * 60 * 1000, refetchInterval: 10 * 60 * 1000 },
  );

  const sessions = (data?.data ?? []).slice(0, 5);

  const sessionIcon = (s: SessionRow) => {
    const filesCount = Array.isArray(s.changed_files) ? s.changed_files.length : 0;
    if (filesCount > 0) return <FileCode className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-th-accent animate-pulse" />
            {t('dashboard.liveActivity')}
          </h2>
          <Link
            to="/sessions"
            className="flex items-center gap-1 text-[12px] text-th-accent hover:opacity-80 transition-opacity"
          >
            {t('dashboard.viewAll')} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-th bg-th-surface-1 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-th-text-4 text-center py-10">{t('dashboard.noSessions')}</p>
        ) : (
          <div className="space-y-1 relative">
            {/* タイムライン縦線 */}
            <div className="absolute left-[17px] top-9 bottom-0 w-px bg-th-border pointer-events-none" />

            {sessions.map((s, idx) => {
              const filesCount = Array.isArray(s.changed_files) ? s.changed_files.length : 0;
              const isLast = idx === sessions.length - 1;

              return (
                <Link
                  key={s.id}
                  to={`/sessions/${s.id}`}
                  className="relative flex gap-4 p-2.5 rounded-th-md hover:bg-th-surface-1 transition-colors group"
                >
                  {/* アイコン */}
                  <div className="relative z-10 flex-shrink-0 w-9 h-9 rounded-full border border-th-border bg-th-surface-0 flex items-center justify-center text-th-accent group-hover:border-th-accent/40 transition-colors">
                    {sessionIcon(s)}
                  </div>

                  {/* コンテンツ */}
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-th-text-2 group-hover:text-th-text transition-colors truncate">
                        {s.headline ?? t('dashboard.noTitle')}
                      </p>
                      <span className="flex-shrink-0 text-[11px] text-th-text-4 font-mono ml-2">
                        {relativeTime(s.session_ended_at, t)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {filesCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-th-text-4 bg-th-surface-2 px-1.5 py-0.5 rounded border border-th-border">
                          <FileCode className="h-2.5 w-2.5" />
                          {t('dashboard.filesChanged', { count: filesCount })}
                        </span>
                      )}
                      <span className="text-[10px] text-th-text-4">{shortDate(s.session_ended_at)}</span>
                    </div>
                  </div>

                  {/* タイムライン終端マーカー */}
                  {isLast && (
                    <div className="absolute left-[17px] top-9 bottom-0 w-px bg-gradient-to-b from-th-border to-transparent pointer-events-none" />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── ジョブキュー ─────────────────────────────────────────────────────────────

function JobQueue() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: recentJobs = [] } = useQuery<Job[]>(
    'jobs-recent',
    () => api.get('/jobs?limit=6').then(r => r.data.data),
    { refetchInterval: 5000 },
  );

  const handleSend = async () => {
    if (!prompt.trim() || sending) return;
    setSending(true);
    setJobError(null);
    try {
      await api.post('/jobs', { prompt: prompt.trim() });
      setPrompt('');
      queryClient.invalidateQueries('jobs-recent');
    } catch {
      setJobError(t('dashboard.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleStop = async (jobId: string) => {
    try {
      await api.patch(`/jobs/${jobId}`, { status: 'cancelled' });
      queryClient.invalidateQueries('jobs-recent');
    } catch { /* noop */ }
  };

  const activeJob = recentJobs.find(j => j.status === 'pending' || j.status === 'running');

  const STATUS_STYLE: Record<string, string> = {
    done: 'bg-th-success-dim text-th-success',
    running: 'bg-th-accent-dim text-th-accent',
    pending: 'bg-th-warning-dim text-th-warning',
    error: 'bg-th-danger-dim text-th-danger',
    cancelled: 'bg-th-surface-2 text-th-text-4',
  };

  const STATUS_ICON: Record<string, React.ReactNode> = {
    done: <CheckCircle2 className="h-3 w-3" />,
    running: <Loader2 className="h-3 w-3 animate-spin" />,
    pending: <Circle className="h-3 w-3" />,
    error: <AlertTriangle className="h-3 w-3" />,
    cancelled: <XCircle className="h-3 w-3" />,
  };

  const jobStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      done: t('dashboard.statusDone'),
      running: t('dashboard.statusRunning'),
      pending: t('dashboard.statusPending'),
      error: t('dashboard.statusError'),
      cancelled: t('dashboard.statusCancelled'),
    };
    return map[status] ?? status;
  };

  const activeCount = recentJobs.filter(j => j.status === 'running' || j.status === 'pending').length;

  return (
    <Card>
      <CardBody className="p-5 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2">
            <Terminal className="h-4 w-4 text-th-text-3" />
            {t('dashboard.jobQueue')}
          </h2>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="bg-th-accent-dim text-th-accent text-[10px] font-bold px-2 py-0.5 rounded-full">
                {t('dashboard.activeJobs', { count: activeCount })}
              </span>
            )}
            <Link to="/jobs" className="flex items-center gap-1 text-[11px] text-th-accent hover:opacity-80 transition-opacity">
              {t('dashboard.jobListLink')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* ジョブエラー */}
        {jobError && <Alert variant="danger" message={jobError} onClose={() => setJobError(null)} />}

        {/* 指示入力 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder={t('dashboard.instructionPlaceholder')}
            disabled={sending || !!activeJob}
            className="flex-1 bg-th-surface-1 border border-th-border rounded-th-md px-3 py-2 text-sm text-th-text placeholder-th-text-4 focus:outline-none focus:border-th-accent disabled:opacity-50"
          />
          {activeJob ? (
            <button
              onClick={() => handleStop(activeJob.id)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-th-md border border-th-danger/30 bg-th-danger-dim px-3 py-2 text-sm font-medium text-th-danger hover:opacity-80 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
              {t('dashboard.stopJob')}
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!prompt.trim() || sending}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-th-md border border-th-accent/30 bg-th-accent-dim px-3 py-2 text-sm font-medium text-th-accent hover:opacity-80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {t('common.send', { defaultValue: '送信' })}
            </button>
          )}
        </div>

        {/* ジョブリスト */}
        {recentJobs.length > 0 && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {recentJobs.map(job => (
              <div
                key={job.id}
                className="flex items-start gap-2.5 rounded-th-sm border border-th-border bg-th-surface-1 px-2.5 py-2 hover:bg-th-surface-2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-th-text-2 truncate">{job.prompt}</p>
                  {job.result && (
                    <p className="text-[10px] text-th-text-4 mt-1 truncate">{job.result}</p>
                  )}
                  {job.error_message && (
                    <p className="text-[10px] text-th-danger mt-1 truncate">{job.error_message}</p>
                  )}
                </div>
                <span className={clsx(
                  'flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap',
                  STATUS_STYLE[job.status] ?? 'bg-th-surface-2 text-th-text-4',
                )}>
                  {STATUS_ICON[job.status]}
                  {jobStatusLabel(job.status)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* キュー一時停止ボタン */}
        {activeCount > 0 && (
          <button
            className="w-full py-2 text-[12px] font-medium text-th-text-3 hover:text-th-text border border-th-border rounded-th-md transition-colors bg-th-surface-1 hover:bg-th-surface-2 flex justify-center items-center gap-2"
            onClick={() => recentJobs
              .filter(j => j.status === 'pending')
              .forEach(j => handleStop(j.id))}
          >
            <Square className="h-3.5 w-3.5" />
            {t('dashboard.pauseQueue')}
          </button>
        )}
      </CardBody>
    </Card>
  );
}

// ─── スキル使用グラフ ─────────────────────────────────────────────────────────

function SkillUsageChart() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<{ data: SkillUsageStat[] }>(
    ['skill-usage', '7d'],
    () => api.get('/plugins/usage-stats?period=7d').then(r => r.data),
    { staleTime: 3 * 60 * 60 * 1000, refetchInterval: 3 * 60 * 60 * 1000 },
  );

  const stats = (data?.data ?? []).slice(0, 7);
  const maxCount = stats.reduce((m, s) => Math.max(m, s.count), 1);

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-th-text-3" />
            {t('dashboard.skillUsageTop7')}
          </h2>
          <span className="text-[10px] text-th-text-4">7d</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 rounded bg-th-surface-1 animate-pulse" />
            ))}
          </div>
        ) : stats.length === 0 ? (
          <p className="text-xs text-th-text-4 text-center py-6">{t('dashboard.noSkillUsage')}</p>
        ) : (
          <div className="space-y-2.5">
            {stats.map((stat, i) => {
              const pct = Math.round((stat.count / maxCount) * 100);
              return (
                <div key={stat.name} className="flex items-center gap-2">
                  <span className="text-[10px] text-th-text-4 w-3.5 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-th-text-2 truncate max-w-[75%]" title={stat.name}>
                        {stat.name}
                      </span>
                      <span className="text-xs font-bold text-th-accent flex-shrink-0 ml-1">{stat.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-th-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-th-accent/60 to-th-accent transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── コスト概要 ───────────────────────────────────────────────────────────────

function CostSummary() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<{ data: CostEvent[] }>(
    'costs-30d',
    () => api.get('/costs').then(r => r.data),
    { staleTime: 10 * 60 * 1000, refetchInterval: 15 * 60 * 1000 },
  );

  const events = data?.data ?? [];
  const totalUsd = events.reduce((sum, e) => sum + parseFloat(e.cost_usd || '0'), 0);

  const byModel: Record<string, number> = {};
  for (const e of events) {
    byModel[e.model] = (byModel[e.model] ?? 0) + parseFloat(e.cost_usd || '0');
  }
  const topModels = Object.entries(byModel).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-th-text flex items-center gap-2">
            <Clock className="h-4 w-4 text-th-text-3" />
            {t('dashboard.last30DaysCost')}
          </h2>
          <Link to="/costs" className="flex items-center gap-1 text-[11px] text-th-accent hover:opacity-80 transition-opacity">
            {t('dashboard.costDetail')} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 rounded bg-th-surface-1 animate-pulse" />
            <div className="h-16 rounded bg-th-surface-1 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-[11px] text-th-text-4 mb-1">{t('dashboard.last30DaysTotal')}</p>
              <p className="text-3xl font-bold gradient-text">${totalUsd.toFixed(4)}</p>
            </div>

            {topModels.length > 0 ? (
              <div className="space-y-2">
                {topModels.map(([model, cost]) => (
                  <div key={model} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-th-text-3 truncate flex-1" title={model}>
                      {model.replace('claude-', '').replace(/-\d{8}$/, '')}
                    </span>
                    <span className="text-xs font-medium text-th-text flex-shrink-0">
                      ${cost.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-th-text-4 text-center py-4">{t('dashboard.noCostRecords')}</p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ─── セッションテーブル ───────────────────────────────────────────────────────

function SessionsTable() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<AnalyticsSessions>(
    ['analytics-sessions-table', '7d'],
    () => api.get('/analytics/sessions?period=7d').then(r => r.data),
    { staleTime: 5 * 60 * 1000, refetchInterval: 10 * 60 * 1000 },
  );

  const sessions = data?.data ?? [];
  const meta = data?.meta;

  return (
    <Card>
      {/* テーブルヘッダー */}
      <div className="px-5 py-3.5 border-b border-th-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-th-text">{t('dashboard.liveActivity')}</h2>
          {meta && (
            <span className="text-[11px] text-th-text-4">
              7d · {meta.total_sessions}{t('common.noData').includes('data') ? '' : '件'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to="/sessions"
            className="text-[12px] text-th-text-3 hover:text-th-accent px-2 py-1 rounded border border-th-border hover:border-th-accent/30 transition-all flex items-center gap-1"
          >
            {t('dashboard.viewAll')} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-th-surface-1 animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-th-text-4 text-center py-10">{t('dashboard.noSessions')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="text-[10px] uppercase text-th-text-4 font-bold tracking-wider border-b border-th-border bg-th-surface-1">
              <tr>
                <th className="px-5 py-3 font-medium">Session ID</th>
                <th className="px-5 py-3 font-medium">{t('dashboard.noTitle').replace('（', '').replace('）', '') === 'No title' ? 'Objective' : '内容'}</th>
                <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                <th className="px-5 py-3 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-border text-[13px]">
              {sessions.slice(0, 8).map((s) => {
                const filesCount = Array.isArray(s.changed_files) ? s.changed_files.length : 0;
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-th-surface-1 transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <Link to={`/sessions/${s.id}`} className="font-mono text-[11px] text-th-text-4 hover:text-th-accent transition-colors">
                        {s.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-5 py-3 max-w-xs">
                      <Link to={`/sessions/${s.id}`} className="text-th-text-2 group-hover:text-th-text transition-colors truncate block">
                        {s.headline ?? t('dashboard.noTitle')}
                      </Link>
                      {filesCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-th-text-4 mt-0.5">
                          <FileCode className="h-2.5 w-2.5" />
                          {t('dashboard.filesChanged', { count: filesCount })}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-th-success-dim text-th-success border border-th-success/20">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('dashboard.statusDone')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-th-text-4 text-[11px] text-right">
                      {relativeTime(s.session_ended_at, t)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* フッター */}
      {sessions.length > 0 && (
        <div className="px-5 py-3 border-t border-th-border flex justify-between items-center text-xs text-th-text-4">
          <span>{meta ? `${meta.total_sessions}件 (7日間)` : ''}</span>
          <Link to="/sessions" className="hover:text-th-accent transition-colors">
            {t('dashboard.viewAll')} →
          </Link>
        </div>
      )}
    </Card>
  );
}

// ─── ページ本体 ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation();

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery<{ data: AnalyticsOverview }>(
    'analytics-overview',
    () => api.get('/analytics/overview').then(r => r.data),
    { refetchInterval: 3 * 60 * 1000, staleTime: 2 * 60 * 1000 },
  );

  const { data: costsData } = useQuery<{ data: CostEvent[] }>(
    'costs-30d-overview',
    () => api.get('/costs').then(r => r.data),
    { staleTime: 10 * 60 * 1000, refetchInterval: 15 * 60 * 1000 },
  );

  const stats = overview?.data;
  const totalCost = (costsData?.data ?? []).reduce((sum, e) => sum + parseFloat(e.cost_usd || '0'), 0);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  if (overviewLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold gradient-text">{t('dashboard.title')}</h1>
          <p className="text-th-text-3 text-sm">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center justify-center h-40">
          <LoadingSpinner text={t('dashboard.loading')} />
        </div>
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold gradient-text">{t('dashboard.title')}</h1>
        </div>
        <Alert variant="danger" title={t('dashboard.loadFailed')} message={t('dashboard.loadFailedMessage')} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* ページヘッダー */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold gradient-text">{t('dashboard.title')}</h1>
        <p className="text-sm text-th-text-4">{today}</p>
      </div>

      {/* メトリクスカード × 4 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={t('dashboard.activeAgents')}
          value={stats?.active_agents ?? '—'}
          icon={<Bot className="h-4 w-4" />}
          to="/agents"
          barPercent={Math.min(100, (stats?.active_agents ?? 0) * 10)}
          barColor="bg-th-success"
        />
        <MetricCard
          label={t('dashboard.todaySessions')}
          value={stats?.today_sessions ?? '—'}
          icon={<Clock className="h-4 w-4" />}
          to="/sessions"
        />
        <MetricCard
          label={t('dashboard.last30DaysCost')}
          value={`$${totalCost.toFixed(2)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          to="/costs"
        />
        <MetricCard
          label={t('dashboard.totalAgents')}
          value={stats?.total_skills ?? '—'}
          icon={<Zap className="h-4 w-4" />}
          to="/plugins"
          barPercent={75}
        />
      </div>

      {/* メインエリア: アクティビティ + ジョブキュー */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
        <div>
          <JobQueue />
        </div>
      </div>

      {/* ボトムエリア: スキル使用 + コスト概要 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SkillUsageChart />
        <CostSummary />
      </div>

      {/* セッションテーブル */}
      <SessionsTable />
    </div>
  );
}
