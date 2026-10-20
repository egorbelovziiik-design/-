import { ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../state/store';

export default function PermissionModal() {
  const req = useApp((s) => s.permissionReq);
  const setPermissionReq = useApp((s) => s.setPermissionReq);

  if (!req) return null;

  const respond = (approved: boolean) => {
    void window.wincode.aiPermissionResponse(req.id, approved);
    setPermissionReq(null);
    if (approved) useApp.getState().notify('info', `Approved: ${req.tool}`);
    else useApp.getState().notify('warning', `Denied: ${req.tool}`);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className="w-[480px] max-w-[92vw] rounded-2xl border p-5 shadow-panel animate-fade-in"
        style={{ background: 'var(--wc-panel)', borderColor: req.dangerous ? '#EF4444' : 'var(--wc-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: req.dangerous ? 'rgba(239,68,68,0.15)' : 'var(--wc-active)' }}
          >
            <ShieldAlert size={18} color={req.dangerous ? '#EF4444' : 'var(--wc-neon)'} />
          </div>
          <div>
            <div className="text-[13px] font-semibold">Permission required</div>
            <div className="text-[10.5px]" style={{ color: 'var(--wc-muted)' }}>
              WinCode Intelligence wants to run: <b>{req.tool}</b>
            </div>
          </div>
        </div>

        <div className="mt-3.5 rounded-xl border p-3 text-[11px]" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)' }}>
          <div className="font-medium">{req.description}</div>
          <pre className="selectable mt-2 max-h-[140px] overflow-y-auto whitespace-pre-wrap font-mono text-[10px]" style={{ color: 'var(--wc-muted)' }}>
            {req.detail}
          </pre>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="text-[10px]" style={{ color: 'var(--wc-muted)' }}>
            {req.dangerous ? '⚠️ This action may be destructive — review carefully.' : 'This action is considered safe.'}
          </div>
          <button className="wc-btn ml-auto text-[11.5px]" onClick={() => respond(false)}>
            <XCircle size={12} color="#EF4444" /> Deny
          </button>
          <button className="wc-btn wc-btn-primary px-5 text-[11.5px]" onClick={() => respond(true)}>
            <CheckCircle2 size={12} /> Allow
          </button>
        </div>
      </div>
    </div>
  );
}
