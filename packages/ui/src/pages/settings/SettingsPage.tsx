import { useState, useEffect } from 'react';
import { useTranslation } from '@company/i18n';
import i18n from '@company/i18n';
import api from '../../lib/api.ts';

export default function SettingsPage() {
  const { t } = useTranslation();

  // エージェント実行モード
  const [defaultAgentType, setDefaultAgentType] = useState<'claude_local' | 'claude_api'>('claude_local');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  // 組織情報
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');

  // 言語
  const [language, setLanguage] = useState(i18n.language || 'ja');

  // UI状態
  const [saving, setSaving] = useState('');  // セクション名
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // 設定を取得
    api.get('/settings').then(r => {
      const s = r.data.data;
      if (s.defaultAgentType) setDefaultAgentType(s.defaultAgentType);
      setHasApiKey(!!s.hasAnthropicApiKey);
    }).catch(() => {});

    // 組織情報を取得
    api.get('/org').then(r => {
      const o = r.data.data;
      setOrgName(o.name || '');
      setOrgDescription(o.description || '');
    }).catch(() => {});
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveAgentMode = async () => {
    setSaving('agentMode');
    try {
      const body: Record<string, string> = { defaultAgentType };
      // APIキーが入力されている場合のみ送信
      if (anthropicApiKey) body.anthropicApiKey = anthropicApiKey;
      await api.patch('/settings', body);
      if (anthropicApiKey) setHasApiKey(true);
      setAnthropicApiKey('');
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  const handleSaveOrg = async () => {
    setSaving('org');
    try {
      await api.patch('/org', { name: orgName, description: orgDescription });
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  const handleSaveLanguage = async () => {
    setSaving('language');
    try {
      await i18n.changeLanguage(language);
      localStorage.setItem('language', language);
      showMessage('success', t('settings.saved'));
    } catch {
      showMessage('error', t('errors.serverError'));
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">{t('settings.title')}</h1>

      {message && (
        <div className={`px-4 py-2 rounded border ${
          message.type === 'success'
            ? 'bg-green-900 border-green-700 text-green-200'
            : 'bg-red-900 border-red-700 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* エージェント実行モード */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
        <div>
          <h2 className="text-lg font-bold">{t('settings.agentMode')}</h2>
          <p className="text-sm text-slate-400 mt-1">{t('settings.agentModeDesc')}</p>
        </div>

        <div className="space-y-3">
          {/* claude_local */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
            defaultAgentType === 'claude_local'
              ? 'border-sky-500 bg-sky-900/20'
              : 'border-slate-600 hover:border-slate-500'
          }`}>
            <input
              type="radio"
              name="agentType"
              value="claude_local"
              checked={defaultAgentType === 'claude_local'}
              onChange={() => setDefaultAgentType('claude_local')}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium">{t('settings.agentModeSubscription')}</div>
              <div className="text-sm text-slate-400 mt-0.5">{t('settings.agentModeSubscriptionDesc')}</div>
            </div>
          </label>

          {/* claude_api */}
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
            defaultAgentType === 'claude_api'
              ? 'border-sky-500 bg-sky-900/20'
              : 'border-slate-600 hover:border-slate-500'
          }`}>
            <input
              type="radio"
              name="agentType"
              value="claude_api"
              checked={defaultAgentType === 'claude_api'}
              onChange={() => setDefaultAgentType('claude_api')}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium">{t('settings.agentModeApi')}</div>
              <div className="text-sm text-slate-400 mt-0.5">{t('settings.agentModeApiDesc')}</div>
            </div>
          </label>
        </div>

        {/* Anthropic API キー（claude_api 選択時のみ表示） */}
        {defaultAgentType === 'claude_api' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('settings.anthropicApiKey')}</label>
            {hasApiKey && !anthropicApiKey && (
              <p className="text-xs text-slate-400">{t('settings.anthropicApiKeySet')}</p>
            )}
            <input
              type="password"
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              placeholder={hasApiKey ? '••••••••••••' : t('settings.anthropicApiKeyPlaceholder')}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500"
            />
          </div>
        )}

        <button
          onClick={handleSaveAgentMode}
          disabled={saving === 'agentMode'}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors"
        >
          {saving === 'agentMode' ? '保存中...' : t('common.save')}
        </button>
      </div>

      {/* 組織情報 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
        <h2 className="text-lg font-bold">{t('settings.orgInfo')}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.orgName')}</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.orgDescription')}</label>
            <textarea
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white resize-none"
            />
          </div>
        </div>
        <button
          onClick={handleSaveOrg}
          disabled={saving === 'org'}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors"
        >
          {saving === 'org' ? '保存中...' : t('common.save')}
        </button>
      </div>

      {/* 言語設定 */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-3">
        <h2 className="text-lg font-bold">{t('settings.language')}</h2>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
        >
          <option value="ja">{t('settings.languageJa')}</option>
          <option value="en">{t('settings.languageEn')}</option>
        </select>
        <button
          onClick={handleSaveLanguage}
          disabled={saving === 'language'}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors"
        >
          {saving === 'language' ? '保存中...' : t('common.save')}
        </button>
      </div>
    </div>
  );
}
