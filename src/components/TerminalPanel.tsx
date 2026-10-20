import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useApp } from '../state/store';

const globalListeners = new Map<string, (data: string) => void>();

// Wire main-process PTX data to sessions once per app
let wired = false;
function wireTermEvents() {
  if (wired) return;
  wired = true;
  window.wincode.onTermData(({ id, data }) => {
    globalListeners.get(id)?.(data);
  });
  window.wincode.onTermExit(({ id, exitCode }) => {
    globalListeners.get(id)?.(`\r\n\x1b[33m[process exited with code ${exitCode}]\x1b[0m\r\n`);
  });
}

export default function TerminalView({ termId }: { termId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const settings = useApp((s) => s.settings);

  useEffect(() => {
    wireTermEvents();
    if (!ref.current) return;

    const term = new Terminal({
      fontSize: settings?.terminal.fontSize ?? 13,
      fontFamily: '"Cascadia Code", Consolas, monospace',
      cursorBlink: true,
      allowTransparency: true,
      scrollback: settings?.terminal.scrollback ?? 8000,
      theme: {
        background: '#0D0D14',
        foreground: '#E5E7EB',
        cursor: '#A855F7',
        selectionBackground: '#9333EA55',
        black: '#0D0D14',
        magenta: '#A855F7',
        brightMagenta: '#C084FC',
        blue: '#60A5FA',
        cyan: '#67E8F9',
        green: '#86EFAC',
        yellow: '#FCD34D',
        red: '#F87171',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(ref.current);
    setTimeout(() => fit.fit(), 30);

    term.onData((data) => {
      void window.wincode.termWrite(termId, data);
    });

    globalListeners.set(termId, (data) => term.write(data));
    termRef.current = term;

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
        void window.wincode.termResize(termId, term.cols, term.rows);
      } catch {
        /* noop */
      }
    });
    observer.observe(ref.current);

    return () => {
      globalListeners.delete(termId);
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  return <div ref={ref} className="h-full w-full px-1 py-1" />;
}
