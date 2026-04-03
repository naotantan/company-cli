import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from '@company/i18n';
import api from '../../lib/api.ts';

interface Goal {
  id: string;
  title: string;
  progress: number;
  status: string;
  dueDate: string;
}

export default function GoalsPage() {
  const { t } = useTranslation();
  const { data: goals, isLoading, error } = useQuery<Goal[]>(
    'goals',
    () => api.get('/goals').then((r) => r.data),
  );

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>;
  if (error) return <div className="p-6 text-red-400">{t('errors.serverError')}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('goals.title')}</h1>
        <button className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium">
          {t('goals.newGoal')}
        </button>
      </div>

      <div className="space-y-3">
        {goals && goals.length > 0 ? (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold">{goal.title}</h3>
                <span className="text-xs text-slate-400">{goal.dueDate}</span>
              </div>
              <div className="w-full bg-slate-700 rounded h-2">
                <div
                  className="bg-sky-600 h-2 rounded transition-all"
                  style={{ width: `${goal.progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {t('goals.progressValue', { value: goal.progress })}
              </p>
            </div>
          ))
        ) : (
          <p className="text-slate-400">{t('goals.noGoals')}</p>
        )}
      </div>
    </div>
  );
}
