import { useQuery } from 'react-query';
import { useTranslation } from '@company/i18n';
import api from '../../lib/api.ts';

interface Routine {
  id: string;
  name: string;
  schedule: string;
  lastRun: string;
  status: string;
}

export default function RoutinesPage() {
  const { t } = useTranslation();
  const { data: routines, isLoading, error } = useQuery<Routine[]>(
    'routines',
    () => api.get('/routines').then((r) => r.data),
  );

  const handleRun = async (id: string) => {
    await api.post(`/routines/${id}/run`);
  };

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>;
  if (error) return <div className="p-6 text-red-400">{t('errors.serverError')}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('routines.title')}</h1>

      <div className="space-y-3">
        {routines && routines.length > 0 ? (
          routines.map((routine) => (
            <div
              key={routine.id}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex justify-between items-center"
            >
              <div>
                <h3 className="font-bold">{routine.name}</h3>
                <p className="text-xs text-slate-400">
                  {t('routines.scheduleValue', { value: routine.schedule })}
                </p>
                <p className="text-xs text-slate-400">{t('routines.lastRunValue', { value: routine.lastRun })}</p>
              </div>
              <button
                onClick={() => handleRun(routine.id)}
                className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium text-sm"
              >
                {t('routines.runNow')}
              </button>
            </div>
          ))
        ) : (
          <p className="text-slate-400">{t('routines.noRoutines')}</p>
        )}
      </div>
    </div>
  );
}
