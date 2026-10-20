import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useApp } from '../state/store';

const icons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};
const colors = {
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#60A5FA',
};

export default function Notifications() {
  const notifications = useApp((s) => s.notifications);
  const dismiss = useApp((s) => s.dismissNotification);

  return (
    <div className="pointer-events-none fixed bottom-9 right-4 z-[80] flex w-[330px] flex-col gap-2">
      {notifications.map((n) => {
        const Icon = icons[n.kind];
        return (
          <div
            key={n.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 shadow-panel animate-fade-in"
            style={{ background: 'var(--wc-panel)', borderColor: 'var(--wc-border)' }}
          >
            <Icon size={15} style={{ color: colors[n.kind] }} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-medium">{n.message}</div>
              {n.detail && (
                <div className="mt-0.5 text-[10px] leading-snug" style={{ color: 'var(--wc-muted)' }}>
                  {n.detail.slice(0, 180)}
                </div>
              )}
            </div>
            <button className="rounded p-0.5 hover:bg-white/10" onClick={() => dismiss(n.id)}>
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
