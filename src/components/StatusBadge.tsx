export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'paid' ||
    status === 'matched' ||
    status === 'received' ||
    status === 'accepted' ||
    status === 'converted'
      ? 'badge-paid'
      : status === 'sent' || status === 'pending' || status === 'partial' || status === 'open'
        ? 'badge-sent'
        : status === 'overdue' ||
            status === 'unmatched' ||
            status === 'cancelled' ||
            status === 'declined'
          ? 'badge-overdue'
          : status === 'draft'
            ? 'badge-draft'
            : 'badge-void';
  return <span className={`badge ${cls}`}>{status.replace(/_/g, ' ')}</span>;
}
