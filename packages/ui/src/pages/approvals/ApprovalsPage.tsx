import { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '@company/i18n';
import api from '../../lib/api.ts';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  LoadingSpinner,
  EmptyState,
  Alert,
} from '../../components/ui';
import { clsx } from 'clsx';

interface Approval {
  id: string;
  issue_id: string;
  approver_id: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
  decided_at?: string | null;
}

const statusBadgeVariants: Record<string, 'pending' | 'success' | 'danger'> = {
  pending: 'pending',
  approved: 'success',
  rejected: 'danger',
};

export default function ApprovalsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    pending: t('approvals.pending'),
    approved: t('approvals.approved'),
    rejected: t('approvals.rejected'),
  };

  const { data: approvals, isLoading, error } = useQuery<Approval[]>(
    ['approvals', statusFilter],
    () =>
      api
        .get('/approvals', {
          params: { status: statusFilter === 'all' ? undefined : statusFilter },
        })
        .then((r) => r.data.data),
  );

  const handleApprove = async (id: string) => {
    setActingId(id);
    setActionError(null);
    try {
      await api.post(`/approvals/${id}/approve`);
      await queryClient.invalidateQueries('approvals');
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t('approvals.approveFailed'));
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActingId(id);
    setActionError(null);
    try {
      await api.post(`/approvals/${id}/reject`);
      await queryClient.invalidateQueries('approvals');
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t('approvals.rejectFailed'));
    } finally {
      setActingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text={t('approvals.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-bold">{t('approvals.title')}</h1>
        <Alert
          variant="danger"
          message={t('approvals.fetchError')}
        />
      </div>
    );
  }

  const items = approvals ?? [];
  const pendingCount = items.filter((approval) => approval.status === 'pending').length;
  const approvedCount = items.filter((approval) => approval.status === 'approved').length;
  const rejectedCount = items.filter((approval) => approval.status === 'rejected').length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
          {t('approvals.title')}
        </h1>
        <p className="text-slate-400">
          {t('approvals.summary', {
            pending: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
          })}
        </p>
      </div>

      {actionError && <Alert variant="danger" message={actionError} onClose={() => setActionError(null)} />}

      {pendingCount > 0 && statusFilter !== 'approved' && (
        <Alert
          variant="warning"
          title={t('approvals.actionRequiredTitle')}
          message={t('approvals.actionRequiredMessage', { count: pendingCount })}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900',
              statusFilter === status
                ? 'bg-sky-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            {status === 'all' ? t('common.all') : statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {items.length > 0 ? (
          items.map((approval) => {
            const isPending = approval.status === 'pending';

            return (
              <Card key={approval.id} hoverable>
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariants[approval.status] ?? 'default'}>
                        {statusLabels[approval.status] ?? approval.status}
                      </Badge>
                      <span className="text-xs text-slate-500">{t('approvals.approvalId', { id: approval.id })}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{t('approvals.issueTitle', { id: approval.issue_id })}</h3>
                      <p className="mt-1 text-sm text-slate-400">{t('approvals.approver', { id: approval.approver_id })}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                    {t('approvals.createdAtValue', { value: approval.created_at })}
                  </div>
                </CardHeader>

                <CardBody className="space-y-3 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('approvals.issueContext')}</p>
                      <p className="mt-2 break-all text-slate-300">{approval.issue_id}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('approvals.decision')}</p>
                      <p className="mt-2 text-slate-300">{approval.decided_at ?? t('approvals.undecided')}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {t('approvals.apiNote')}
                  </p>
                </CardBody>

                {isPending && (
                  <CardFooter className="flex flex-wrap gap-3">
                    <Button
                      variant="success"
                      size="md"
                      loading={actingId === approval.id}
                      onClick={() => handleApprove(approval.id)}
                      disabled={actingId !== null}
                    >
                      {t('approvals.approve')}
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      loading={actingId === approval.id}
                      onClick={() => handleReject(approval.id)}
                      disabled={actingId !== null}
                    >
                      {t('approvals.reject')}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon="□"
            title={statusFilter === 'pending' ? t('approvals.noApprovals') : t('approvals.noMatchingApprovals')}
            description={t('approvals.emptyDescription')}
          />
        )}
      </div>
    </div>
  );
}
