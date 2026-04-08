import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import api from '../../lib/api.ts';
import { useTranslation } from '@maestro/i18n';

interface PlaneSettings {
  baseUrl: string;
  workspaceSlug: string;
  projectId: string;
  apiToken: string;
  hasApiToken: boolean;
}

export default function PlaneSection() {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState('http://localhost:8090');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [projectId, setProjectId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data } = useQuery<PlaneSettings>(
    'plane-settings',
    () => api.get('/settings/plane').then((r) => r.data.data),
  );

  useEffect(() => {
    if (!data) return;
    setBaseUrl(data.baseUrl || 'http://localhost:8090');
    setWorkspaceSlug(data.workspaceSlug || '');
    setProjectId(data.projectId || '');
    setApiToken(data.hasApiToken ? '***masked***' : '');
  }, [data]);

  const save = useMutation(
    () => api.patch('/settings/plane', { baseUrl, workspaceSlug, projectId, apiToken }),
    { onSuccess: () => setTestResult({ ok: true, message: t('plane.saveSuccess') }) },
  );

  const test = useMutation(
    async () => {
      await api.patch('/settings/plane', { baseUrl, workspaceSlug, projectId, apiToken });
      return api.get('/jobs/plane/test').then((r) => r.data.data);
    },
    {
      onSuccess: (d) => {
        setTestResult({
          ok: d.connected,
          message: d.connected
            ? t('plane.testSuccess', { count: d.states_count })
            : t('plane.testFail', { message: d.message }),
        });
      },
      onError: () => setTestResult({ ok: false, message: t('plane.testError') }),
    },
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 14,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
    color: 'var(--color-text)',
  };

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t('plane.title')}</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 4 }}>
          {t('plane.description')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Plane URL</label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:8090"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('plane.workspaceSlug')}</label>
          <input
            type="text"
            value={workspaceSlug}
            onChange={(e) => setWorkspaceSlug(e.target.value)}
            placeholder="my-workspace"
            style={inputStyle}
          />
          <p
            style={{ fontSize: 12, color: 'var(--color-text-4)', marginTop: 4 }}
            dangerouslySetInnerHTML={{
              __html: t('plane.workspaceSlugHint', { url: baseUrl || 'http://localhost:8090' }),
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('plane.projectId')}</label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: 'var(--color-text-4)', marginTop: 4 }}>
            {t('plane.projectIdHint')}
          </p>
        </div>
        <div>
          <label style={labelStyle}>{t('plane.apiToken')}</label>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder={data?.hasApiToken ? t('plane.apiTokenMasked') : 'your-api-token'}
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: 'var(--color-text-4)', marginTop: 4 }}>
            {t('plane.apiTokenHint')}
          </p>
        </div>

        {testResult && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              background: testResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: testResult.ok ? '#16a34a' : '#dc2626',
              border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            {testResult.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => test.mutate()}
            disabled={test.isLoading || !workspaceSlug || !projectId}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: 14,
              opacity: test.isLoading || !workspaceSlug || !projectId ? 0.5 : 1,
            }}
          >
            {test.isLoading ? t('plane.testing') : t('plane.testButton')}
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isLoading}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              opacity: save.isLoading ? 0.6 : 1,
            }}
          >
            {save.isLoading ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
