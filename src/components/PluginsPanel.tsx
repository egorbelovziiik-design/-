import { useState, useEffect } from 'react';
import { Puzzle, Download, Trash2, Power, FolderOpen, CheckCircle2, Sparkles } from 'lucide-react';
import { useApp } from '../state/store';
import type { PluginManifest } from '@shared/types';

export default function PluginsPanel() {
  const notify = useApp((s) => s.notify);
  const [installed, setInstalled] = useState<PluginManifest[]>([]);
  const [builtin, setBuiltin] = useState<PluginManifest[]>([]);

  const refresh = async () => {
    const res = await window.wincode.pluginsList();
    setInstalled(res.installed);
    setBuiltin(res.builtin);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between px-3" style={{ borderBottom: '1px solid var(--wc-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Plugins
        </span>
        <button
          className="rounded p-1 hover:bg-[var(--wc-hover)]"
          title="Install plugin from folder"
          onClick={async () => {
            const dir = await window.wincode.pickFolder();
            if (!dir) return;
            try {
              const p = await window.wincode.pluginsInstall(dir);
              notify('success', `Installed plugin: ${p.name}`);
              await refresh();
            } catch (err) {
              notify('error', 'Plugin install failed', (err as Error).message);
            }
          }}
        >
          <Download size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Built-in extensions
        </div>
        {builtin.map((p) => (
          <div key={p.id} className="mb-1.5 rounded-lg border p-2.5" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)' }}>
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} color="var(--wc-neon)" />
              <span className="text-[12px] font-medium">{p.name}</span>
              <span className="ml-auto text-[10px]" style={{ color: 'var(--wc-muted)' }}>v{p.version}</span>
            </div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--wc-muted)' }}>{p.description}</div>
            <div className="mt-1.5 flex items-center gap-1 text-[10px]" style={{ color: '#22C55E' }}>
              <CheckCircle2 size={10} /> Active · {p.kind}
            </div>
          </div>
        ))}

        <div className="mb-2 mt-4 px-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Installed plugins
        </div>
        {installed.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-[11px]" style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-muted)' }}>
            <Puzzle size={20} className="mx-auto mb-2 opacity-50" />
            No external plugins installed.
            <br />
            A plugin is a folder with <span className="font-mono">wincode-plugin.json</span>.
            <br />
            Use <span className="inline-flex items-center gap-1"><FolderOpen size={10} /> Install</span> above.
          </div>
        ) : (
          installed.map((p) => (
            <div key={p.id} className="mb-1.5 rounded-lg border p-2.5" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)' }}>
              <div className="flex items-center gap-1.5">
                <Puzzle size={13} color="var(--wc-accent)" />
                <span className="text-[12px] font-medium">{p.name}</span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--wc-muted)' }}>v{p.version}</span>
              </div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--wc-muted)' }}>{p.description}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  className="wc-btn py-0.5 text-[10px]"
                  onClick={async () => {
                    await window.wincode.pluginsToggle(p.id, !p.enabled);
                    await refresh();
                  }}
                >
                  <Power size={10} /> {p.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  className="wc-btn py-0.5 text-[10px]"
                  style={{ color: '#EF4444' }}
                  onClick={async () => {
                    await window.wincode.pluginsUninstall(p.id);
                    notify('info', `Uninstalled ${p.name}`);
                    await refresh();
                  }}
                >
                  <Trash2 size={10} /> Uninstall
                </button>
                <span className="ml-auto text-[10px]" style={{ color: p.enabled ? '#22C55E' : 'var(--wc-muted)' }}>
                  {p.enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
