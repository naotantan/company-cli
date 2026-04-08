import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import {
  ChevronDown, ChevronRight, Copy, Check, Trash2, BookOpen,
  Loader2, Plus, X, GripVertical, Terminal, Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

interface RecipeStep {
  id: string;
  order: number;
  phase_label: string;
  skill: string | null;
  instruction: string;
  note: string | null;
}

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: string;
  steps?: RecipeStep[];
}

interface Plugin {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

// ステップ種別を instruction から判定（/skill-name で始まる = スキル）
function inferStepType(step: RecipeStep): 'skill' | 'command' {
  if (step.skill && step.instruction.trimStart().startsWith(`/${step.skill}`)) return 'skill';
  if (step.instruction.trimStart().startsWith('/')) return 'skill';
  return 'command';
}

// ---- CopyButton ----
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? t('recipes.copied') : t('recipes.copyInstruction')}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
        copied
          ? 'bg-green-50 text-green-600'
          : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? t('recipes.copied') : t('recipes.copyInstruction')}
    </button>
  );
}

// ---- StepCard ----
function StepCard({ step }: { step: RecipeStep }) {
  const [expanded, setExpanded] = useState(true);
  const stepType = inferStepType(step);

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
          {step.order}
        </span>
        <span className="flex-1 font-medium text-sm text-gray-800">{step.phase_label}</span>
        {step.skill && (
          stepType === 'skill' ? (
            // スキル（スラッシュコマンド）: 紫バッジ
            <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-2 py-0.5 font-mono">
              <Zap size={10} />
              /{step.skill}
            </span>
          ) : (
            // ツール/コマンド: グレーバッジ
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 border border-gray-200 rounded px-2 py-0.5 font-mono">
              <Terminal size={10} />
              {step.skill}
            </span>
          )
        )}
        {expanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className={clsx(
              'text-sm leading-relaxed whitespace-pre-wrap flex-1 font-mono',
              stepType === 'skill' ? 'text-indigo-700' : 'text-gray-700'
            )}>
              {step.instruction}
            </p>
            <CopyButton text={step.instruction} />
          </div>
          {step.note && (
            <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 mt-2">
              {step.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- CreateStepRow ----
interface DraftStep {
  phase_label: string;
  step_type: 'skill' | 'command';
  skill: string;
  instruction: string;
  note: string;
}

function CreateStepRow({
  step,
  index,
  plugins,
  onChange,
  onRemove,
}: {
  step: DraftStep;
  index: number;
  plugins: Plugin[];
  onChange: (s: DraftStep) => void;
  onRemove: () => void;
}) {
  const handleTypeChange = (type: 'skill' | 'command') => {
    let instruction = step.instruction;
    if (type === 'skill' && step.skill) {
      // スキルに切り替え: instructionに /skill を自動付与
      const prefix = `/${step.skill}`;
      if (!instruction.trimStart().startsWith(prefix)) {
        instruction = `${prefix} ${instruction.trimStart()}`.trim();
      }
    } else if (type === 'command' && step.skill) {
      // コマンドに切り替え: /skill-name プレフィックスを除去
      const prefix = `/${step.skill}`;
      if (instruction.trimStart().startsWith(prefix)) {
        instruction = instruction.trimStart().slice(prefix.length).trimStart();
      }
    }
    onChange({ ...step, step_type: type, instruction });
  };

  const handleSkillChange = (skill: string) => {
    let instruction = step.instruction;
    if (step.step_type === 'skill') {
      // 旧スキルのプレフィックスを新スキルに差し替え
      const oldPrefix = step.skill ? `/${step.skill}` : '';
      const body = oldPrefix && instruction.trimStart().startsWith(oldPrefix)
        ? instruction.trimStart().slice(oldPrefix.length).trimStart()
        : instruction;
      instruction = skill ? `/${skill} ${body}`.trim() : body;
    }
    onChange({ ...step, skill, instruction });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex gap-2 items-start">
      <div className="flex-shrink-0 pt-1 text-gray-300 cursor-grab">
        <GripVertical size={14} />
      </div>
      <div className="flex-1 flex flex-col gap-2">
        {/* フェーズラベル */}
        <input
          type="text"
          placeholder="フェーズ名（例: Phase 1: 設計）"
          value={step.phase_label}
          onChange={e => onChange({ ...step, phase_label: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />

        {/* ステップ種別 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('skill')}
            className={clsx(
              'inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors',
              step.step_type === 'skill'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
            )}
          >
            <Zap size={10} />
            スキル (/<span className="font-mono">skill-name</span>)
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('command')}
            className={clsx(
              'inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors',
              step.step_type === 'command'
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            )}
          >
            <Terminal size={10} />
            ツール / コマンド
          </button>
        </div>

        {/* スキル選択（スキル種別の場合のみ） */}
        {step.step_type === 'skill' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">/</span>
            <select
              value={step.skill}
              onChange={e => handleSkillChange(e.target.value)}
              className="flex-1 text-sm border border-indigo-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono text-indigo-700"
            >
              <option value="">スキルを選択...</option>
              {plugins.map(p => (
                <option key={p.id} value={p.name}>{p.name}{p.description ? ` — ${p.description.slice(0, 40)}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* 手順 (instruction) */}
        <textarea
          placeholder={step.step_type === 'skill'
            ? `/${step.skill || 'skill-name'} に続く引数や補足を入力...`
            : 'ツール名やコマンドを含む手順を入力（例: gh search repos で調査する）'
          }
          value={step.step_type === 'skill' && step.skill
            ? step.instruction.trimStart().startsWith(`/${step.skill}`)
              ? step.instruction.trimStart().slice(`/${step.skill}`.length).trimStart()
              : step.instruction
            : step.instruction
          }
          onChange={e => {
            const body = e.target.value;
            const instruction = step.step_type === 'skill' && step.skill
              ? `/${step.skill} ${body}`.trim()
              : body;
            onChange({ ...step, instruction });
          }}
          rows={2}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
        />

        {/* プレビュー */}
        {step.instruction && (
          <p className={clsx(
            'text-xs font-mono px-2 py-1 rounded',
            step.step_type === 'skill'
              ? 'bg-indigo-50 text-indigo-600'
              : 'bg-gray-100 text-gray-600'
          )}>
            {step.instruction}
          </p>
        )}

        {/* Note */}
        <input
          type="text"
          placeholder="補足メモ（任意）"
          value={step.note}
          onChange={e => onChange({ ...step, note: e.target.value })}
          className="w-full text-xs border border-gray-100 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 text-gray-500 italic"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors rounded mt-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ---- CreateRecipeModal ----
function CreateRecipeModal({
  plugins,
  onClose,
  onCreated,
}: {
  plugins: Plugin[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [steps, setSteps] = useState<DraftStep[]>([
    { phase_label: '', step_type: 'skill', skill: '', instruction: '', note: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStep = () => setSteps(s => [
    ...s,
    { phase_label: '', step_type: 'skill', skill: '', instruction: '', note: '' },
  ]);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('レシピ名を入力してください'); return; }
    if (steps.some(s => !s.phase_label.trim())) { setError('すべてのステップにフェーズ名を入力してください'); return; }
    if (steps.some(s => !s.instruction.trim())) { setError('すべてのステップに手順を入力してください'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/recipes', {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        steps: steps.map((s, i) => ({
          order: i + 1,
          phase_label: s.phase_label.trim(),
          skill: s.skill.trim() || null,
          step_type: s.step_type,
          instruction: s.instruction.trim(),
          note: s.note.trim() || null,
        })),
      });
      onCreated();
    } catch {
      setError('作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-12 px-4 pb-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">新規レシピを作成</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {/* メタ情報 */}
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="レシピ名 *"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="text"
              placeholder="説明（任意）"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="text"
              placeholder="カテゴリ（任意）"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* 凡例 */}
          <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <span className="inline-flex items-center gap-1 text-indigo-600">
              <Zap size={10} /> スキル — Claudeの<code className="font-mono">/skill-name</code>コマンドを直接呼び出す
            </span>
            <span className="inline-flex items-center gap-1 text-gray-600">
              <Terminal size={10} /> ツール/コマンド — CLIやMCPツールを使う自然言語の指示
            </span>
          </div>

          {/* ステップ一覧 */}
          <div className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <CreateStepRow
                key={i}
                step={s}
                index={i}
                plugins={plugins}
                onChange={updated => setSteps(prev => prev.map((x, j) => j === i ? updated : x))}
                onRemove={() => setSteps(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addStep}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 self-start"
          >
            <Plus size={14} /> ステップを追加
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg">
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            作成する
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- RecipeCard ----
function RecipeCard({
  recipe,
  selected,
  onSelect,
  onDelete,
}: {
  recipe: Recipe;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={clsx(
        'border rounded-xl p-4 cursor-pointer transition-all',
        selected
          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={14} className={selected ? 'text-indigo-600' : 'text-gray-400'} />
            <span className="text-sm font-semibold text-gray-800 truncate">{recipe.name}</span>
          </div>
          {recipe.description && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{recipe.description}</p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
          title={t('recipes.delete')}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {recipe.category && (
        <div className="mt-3">
          <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
            {recipe.category}
          </span>
        </div>
      )}
    </div>
  );
}

// ---- RecipesPage ----
export default function RecipesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: recipes = [], isLoading, error } = useQuery<Recipe[]>(
    ['recipes'],
    () => api.get('/recipes').then(r => {
      const data: Recipe[] = r.data.data ?? [];
      if (data.length === 1) setSelectedId(id => id ?? data[0].id);
      return data;
    }),
    { staleTime: 0, refetchOnMount: true }
  );

  const { data: detail, isLoading: loadingDetail } = useQuery<Recipe>(
    ['recipes', selectedId],
    () => api.get(`/recipes/${selectedId}`).then(r => r.data.data),
    { enabled: !!selectedId, staleTime: 0 }
  );

  // プラグイン一覧（スキル選択に使用）
  const { data: pluginData } = useQuery<Plugin[]>(
    ['plugins-for-recipe'],
    () => api.get('/plugins').then(r => r.data.data ?? []),
    { staleTime: 60_000 }
  );
  const plugins: Plugin[] = pluginData ?? [];

  const seedMutation = useMutation(
    () => api.post('/recipes/seed'),
    {
      onSuccess: (res) => {
        qc.invalidateQueries(['recipes']);
        const msg = res.data?.message ?? 'サンプルを追加しました';
        setSeedMsg(msg);
        setTimeout(() => setSeedMsg(null), 3000);
      },
    }
  );

  const deleteMutation = useMutation(
    (id: string) => api.delete(`/recipes/${id}`),
    {
      onSuccess: (_data, id) => {
        qc.invalidateQueries(['recipes']);
        if (selectedId === id) setSelectedId(null);
      },
    }
  );

  const handleDelete = (id: string) => {
    if (window.confirm(t('recipes.deleteConfirm'))) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('recipes.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('recipes.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {seedMsg && (
            <span className="text-sm text-green-600 font-medium">{seedMsg}</span>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Plus size={14} />
            新規作成
          </button>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {seedMutation.isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('recipes.seed')}
          </button>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          エラー: {String(error)}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <BookOpen size={40} strokeWidth={1.2} />
          <p className="text-sm">{t('recipes.empty')}</p>
          <button
            onClick={() => seedMutation.mutate()}
            className="text-sm text-indigo-600 hover:text-indigo-700 underline"
          >
            {t('recipes.seed')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Recipe list */}
          <div className="flex flex-col gap-3 lg:col-span-1">
            {recipes.map(r => (
              <RecipeCard
                key={r.id}
                recipe={r}
                selected={r.id === selectedId}
                onSelect={() => setSelectedId(r.id === selectedId ? null : r.id)}
                onDelete={() => handleDelete(r.id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selectedId ? (
              <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400">
                ← レシピを選択してステップを表示
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : detail ? (
              <div className="flex flex-col gap-3">
                <div className="mb-1">
                  <h2 className="text-lg font-semibold text-gray-900">{detail.name}</h2>
                  {detail.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{detail.description}</p>
                  )}
                </div>
                {/* 凡例 */}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1 text-indigo-500">
                    <Zap size={9} /> スキル（スラッシュコマンド）
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Terminal size={9} /> ツール/コマンド
                  </span>
                </div>
                {(detail.steps ?? []).map((step: RecipeStep) => (
                  <StepCard key={step.id} step={step} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateRecipeModal
          plugins={plugins}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries(['recipes']);
          }}
        />
      )}
    </div>
  );
}
