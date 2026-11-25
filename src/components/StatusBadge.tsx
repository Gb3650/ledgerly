export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'paid' || status === 'matched'
      ? 'badge-paid'
      : status === 'sent' || status === 'pending'
        ? 'badge-sent'
        : status === 'overdue' || status === 'unmatched'
          ? 'badge-overdue'
          : status === 'draft'
            ? 'badge-draft'
            : 'badge-void';
  return <span className={`badge ${cls}`}>{status.replace('_', ' ')}</span>;
}
