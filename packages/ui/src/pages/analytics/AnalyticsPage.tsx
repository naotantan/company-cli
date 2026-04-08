import { useState } from 'react';
import { useQuery } from 'react-query';
import { BarChart2, CheckSquare, Zap } from 'lucide-react';
import api from '../../lib/api.ts';
import { Alert, LoadingSpinner, StatGrid } from '../../components/ui';
import { useTranslation } from '@maestro/i18n';

interface AnalyticsOverview {
  total_sessions?: number;
  completed_tasks?: number;
  skill_usage_count?: number;
  sessions_change?: string;
  tasks_change?: string;
  skill_change?: string;
}

interface SkillStat {
  name: string;
  count: number;
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('30');

  const periodOptions = [
    { value: '7',  label: t('analytics.period7') },
    { value: '30', label: t('analytics.period30') },
    { value: '90', label: t('analytics.period90') },
  ];

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery<AnalyticsOverview>(
    ['analytics-overview', period],
    () => api.get('/analytics/overview', { params: { days: period } }).then((r) => r.data.data ?? r.data),
  );

  const { data: skillStats, isLoading: skillsLoading } = useQuery<SkillStat[]>(
    ['analytics-skills', period],
    () => api.get('/analytics/skills', { params: { days: period } }).then((r) => r.data.data ?? r.data),
  );

  const maxCount = (skillStats ?? []).reduce((acc, s) => Math.max(acc, s.count), 1);

  const stats = [
    {
      label: t('analytics.totalSessions'),
      value: overview?.total_sessions ?? '—',
      change: overview?.sessions_change,
      changeType: (overview?.sessions_change ?? '').startsWith('+') ? 'up' as const : undefined,
      icon: <BarChart2 size={16} />,
    },
    {
      label: t('analytics.completedTasks'),
      value: overview?.completed_tasks ?? '—',
      change: overview?.tasks_change,
      changeType: (overview?.tasks_change ?? '').startsWith('+') ? 'up' as const : undefined,
      icon: <CheckSquare size={16} />,
    },
    {
      label: t('analytics.skillUsage'),
      value: overview?.skill_usage_count ?? '—',
      change: overview?.skill_change,
      changeType: (overview?.skill_change ?? '').startsWith('+') ? 'up' as const : undefined,
      icon: <Zap size={16} />,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: period === opt.value ? 'var(--color-primary)' : 'var(--color-surface)',
                color: period === opt.value ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {overviewError != null && <Alert variant="danger" message={t('analytics.loadError')} />}

      {overviewLoading ? (
        <LoadingSpinner text={t('analytics.loading')} />
      ) : (
        <StatGrid stats={stats} />
      )}

      {/* Skill usage bar chart */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          {t('analytics.skillTop10', { period })}
        </div>
        <div style={{ padding: '20px 24px' }}>
          {skillsLoading ? (
            <LoadingSpinner text={t('analytics.skillLoading')} />
          ) : !skillStats || skillStats.length === 0 ? (
            <div style={{ color: 'var(--color-text-3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              {t('analytics.noData')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {skillStats.slice(0, 10).map((s) => {
                const pct = Math.round((s.count / maxCount) * 100);
                return (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 140,
                        fontSize: 12,
                        color: 'var(--color-text-2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        textAlign: 'right',
                      }}
                    >
                      {s.name}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 14,
                        background: 'var(--color-border)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: 'linear-gradient(to right, var(--color-primary), var(--color-primary-hover))',
                          borderRadius: 2,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: 36,
                        fontSize: 12,
                        color: 'var(--color-text-3)',
                        textAlign: 'right',
                        flexShrink: 0,
                      }}
                    >
                      {s.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
