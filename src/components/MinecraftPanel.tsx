import { useState, useEffect } from 'react';
import { Pickaxe, Hammer, Gamepad2, Rocket, Layers, Terminal, Sparkles, ExternalLink, ShieldAlert } from 'lucide-react';
import { useApp } from '../state/store';
import type { MCVersionCompat } from '@shared/types';

export default function MinecraftPanel({ mode }: { mode?: 'debug' }) {
  const setOverlay = useApp((s) => s.setOverlay);
  const buildTasks = useApp((s) => s.buildTasks);
  const runBuild = useApp((s) => s.runBuild);
  const problems = useApp((s) => s.problems);
  const lastBuild = useApp((s) => s.lastBuild);
  const projectKinds = useApp((s) => s.projectKinds);
  const [versions, setVersions] = useState<MCVersionCompat[]>([]);

  useEffect(() => {
    void window.wincode.mcVersions().then(setVersions).catch(() => setVersions([]));
  }, []);

  if (mode === 'debug') {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-9 shrink-0 items-center px-3" style={{ borderBottom: '1px solid var(--wc-border)' }}>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
            Run & Debug
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2.5">
          <div className="mb-3 text-[11px]" style={{ color: 'var(--wc-muted)' }}>
            Launch configurations are detected from the project (Gradle / Maven / npm). Debug runs execute the build in
            debug mode and stream logs to the Debug console; use <b>Fix with AI</b> on errors.
          </div>
          {buildTasks.map((t) => (
            <button key={t.label} className="wc-btn mb-1.5 w-full justify-start text-[11.5px]" onClick={() => void runBuild(t)}>
              <Rocket size={12} color="var(--wc-neon)" /> {t.label}
            </button>
          ))}
          {buildTasks.length === 0 && (
            <div className="rounded-lg border border-dashed p-3 text-[11px]" style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-muted)' }}>
              No runnable tasks detected. Open a Gradle, Maven or npm project.
            </div>
          )}
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
            Last run
          </div>
          <div className="mt-1 rounded-lg border p-2.5 text-[11px]" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)' }}>
            {lastBuild ? (
              <>
                <div style={{ color: lastBuild.ok ? '#22C55E' : '#EF4444' }}>
                  {lastBuild.ok ? '✓ Succeeded' : '✗ Failed'} — exit {lastBuild.exitCode} ({lastBuild.durationMs} ms)
                </div>
                <div className="mt-1 truncate font-mono text-[10px]" style={{ color: 'var(--wc-muted)' }}>
                  {lastBuild.command}
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--wc-muted)' }}>Nothing has been run yet.</span>
            )}
          </div>
          {problems.length > 0 && (
            <>
              <div className="mt-4 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
                Problems ({problems.length})
              </div>
              {problems.slice(0, 12).map((p, i) => (
                <div key={i} className="mt-1 rounded border p-2 text-[10.5px]" style={{ borderColor: 'var(--wc-border)', color: p.severity === 'error' ? '#EF4444' : 'var(--wc-muted)' }}>
                  {p.file.split(/[\\/]/).pop()}:{p.line} — {p.message}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1.5 px-3" style={{ borderBottom: '1px solid var(--wc-border)' }}>
        <Pickaxe size={13} color="var(--wc-neon)" />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Minecraft Dev Center
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2.5">
        <button className="wc-btn wc-btn-primary mb-2 w-full justify-center text-[12px]" onClick={() => setOverlay('wizard', true)}>
          <Sparkles size={13} /> New Minecraft Project
        </button>
        <button className="wc-btn mb-3 w-full justify-center text-[11.5px]" onClick={() => setOverlay('guiBuilder', true)}>
          <Gamepad2 size={12} color="var(--wc-neon)" /> AI GUI Builder (ClickGUI / HUD)
        </button>

        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Project detection
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {projectKinds.length === 0 ? (
            <span className="text-[11px]" style={{ color: 'var(--wc-muted)' }}>Open a project to inspect it.</span>
          ) : (
            projectKinds.map((k) => (
              <span key={k} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'var(--wc-active)', color: 'var(--wc-neon)' }}>
                {k}
              </span>
            ))
          )}
        </div>

        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Quick actions
        </div>
        {buildTasks
          .filter((t) => /runClient|remapJar|build|shadowJar/.test(t.label))
          .slice(0, 6)
          .map((t) => (
            <button key={t.label} className="wc-btn mb-1 w-full justify-start text-[11px]" onClick={() => void runBuild(t)}>
              <Hammer size={11} /> {t.label}
            </button>
          ))}

        <div className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Version compatibility matrix
        </div>
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--wc-border)' }}>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: 'var(--wc-editor)', color: 'var(--wc-muted)' }}>
                <th className="px-2 py-1 text-left">MC</th>
                <th className="px-2 py-1 text-left">Java</th>
                <th className="px-2 py-1 text-left">Fabric</th>
                <th className="px-2 py-1 text-left">Forge</th>
                <th className="px-2 py-1 text-left">NeoForge</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.minecraft} className="border-t" style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-text)' }}>
                  <td className="px-2 py-1 font-mono">{v.minecraft}</td>
                  <td className="px-2 py-1">{v.java}</td>
                  <td className="px-2 py-1 font-mono text-[9px]">{v.fabricLoader}</td>
                  <td className="px-2 py-1 font-mono text-[9px]">{v.forge}</td>
                  <td className="px-2 py-1 font-mono text-[9px]">{v.neoforge}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-[10.5px]" style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-muted)' }}>
          <ShieldAlert size={14} className="mt-0.5 shrink-0" color="#F59E0B" />
          <span>
            Use cheat/PvP modules only for local testing and on servers where you have permission. Respect the Minecraft
            EULA and server rules.
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--wc-muted)' }}>
          <Terminal size={11} />
          <span>
            Tip: ask the AI — <i>«Create a Visual Client for Fabric 1.21.4 with ClickGUI and HUD»</i>
          </span>
          <ExternalLink size={10} />
          <Layers size={11} className="ml-auto" />
        </div>
      </div>
    </div>
  );
}
