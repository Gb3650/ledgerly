export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'paid' || status === 'matched' || status === 'received'
      ? 'badge-paid'
      : status === 'sent' || status === 'pending' || status === 'partial'
        ? 'badge-sent'
        : status === 'overdue' || status === 'unmatched' || status === 'cancelled'
          ? 'badge-overdue'
          : status === 'draft'
            ? 'badge-draft'
            : 'badge-void';
  return <span className={`badge ${cls}`}>{status.replace('_', ' ')}</span>;
}
