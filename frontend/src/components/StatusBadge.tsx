type StatusBadgeProps = {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label =
    status === 'CONFIRMED'
      ? 'Confirmada'
      : status === 'COMPLETED'
        ? 'Completada'
        : status === 'OPEN'
          ? 'Abierto'
          : status === 'RESOLVED'
            ? 'Resuelto'
            : status === 'SENT'
              ? 'Enviado'
              : status === 'SKIPPED'
                ? 'Pendiente'
                : status === 'FAILED'
                  ? 'Fallido'
            : 'Cancelada'

  return <span className={`status-badge status-${status.toLowerCase()}`}>{label}</span>
}
