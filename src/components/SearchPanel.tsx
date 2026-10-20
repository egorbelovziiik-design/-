import { useState } from 'react';
import { Search, Loader2, FileText } from 'lucide-react';
import { useApp } from '../state/store';

export default function SearchPanel() {
  const searchQuery = useApp((s) => s.searchQuery);
  const searchResults = useApp((s) => s.searchResults);
  const searchRunning = useApp((s) => s.searchRunning);
  const runSearch = useApp((s) => s.runSearch);
  const openFile = useApp((s) => s.openFile);
  const [local, setLocal] = useState(searchQuery);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center px-3" style={{ borderBottom: '1px solid var(--wc-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
          Search
        </span>
      </div>
      <div className="p-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(local);
          }}
        >
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5" style={{ color: 'var(--wc-muted)' }} />
            <input
              className="wc-input w-full pl-8"
              placeholder="Search in project…"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch(local);
              }}
            />
          </div>
        </form>
        <div className="mt-2 text-[11px]" style={{ color: 'var(--wc-muted)' }}>
          {searchRunning ? (
            <span className="flex items-center gap-1.5"><Loader2 size={11} className="spin" /> Searching…</span>
          ) : (
            `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-2">
        {groupResults(searchResults).map(([file, hits]) => (
          <div key={file} className="mb-1">
            <div className="flex items-center gap-1.5 px-3 py-1 text-[11.5px] font-medium" style={{ color: 'var(--wc-text)' }}>
              <FileText size={12} color="var(--wc-neon)" />
              <span className="truncate">{file.split(/[\\/]/).pop()}</span>
              <span className="ml-1 text-[10px]" style={{ color: 'var(--wc-muted)' }}>
                {hits.length}
              </span>
            </div>
            {hits.map((h, i) => (
              <button
                key={i}
                className="block w-full truncate px-3 pl-7 py-[3px] text-left text-[11.5px] hover:bg-[var(--wc-hover)]"
                style={{ color: 'var(--wc-muted)' }}
                onClick={() => void openFile(h.file)}
                title={file}
              >
                <span className="mr-1.5 opacity-60">:{h.line}</span>
                {h.preview.trim()}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function groupResults(results: { file: string; line: number; column: number; text: string; preview: string }[]): [string, typeof results][] {
  const map = new Map<string, typeof results>();
  for (const r of results) {
    const list = map.get(r.file) ?? [];
    list.push(r);
    map.set(r.file, list);
  }
  return [...map.entries()].slice(0, 60);
}
