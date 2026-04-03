import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from '@company/i18n';
import api from '../../lib/api.ts';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
}

export default function ProjectsPage() {
  const { t } = useTranslation();
  const { data: projects, isLoading, error } = useQuery<Project[]>(
    'projects',
    () => api.get('/projects').then((r) => r.data),
  );

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>;
  if (error) return <div className="p-6 text-red-400">{t('errors.serverError')}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('projects.title')}</h1>
        <button className="bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded font-medium">
          {t('projects.newProject')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects && projects.length > 0 ? (
          projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-sky-500 transition"
            >
              <h3 className="text-lg font-bold mb-1">{project.name}</h3>
              <p className="text-slate-400 text-sm mb-3">{project.description}</p>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{project.createdAt}</span>
                <span
                  className={`px-2 py-1 rounded ${
                    project.status === 'active'
                      ? 'bg-green-900 text-green-200'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {project.status === 'active' ? t('projects.active') : t('projects.archived')}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-slate-400">{t('projects.noProjects')}</p>
        )}
      </div>
    </div>
  );
}
