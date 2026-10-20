"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export interface Command {
  id: string;
  group: string;
  label: string;
  icon: React.ElementType;
  hint?: string;
  keywords?: string;
  run: () => void;
}

/** ⌘K palette: fuzzy-ish filter over commands, arrow keys + enter. */
export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const words = q.split(/\s+/);
    return commands
      .map((c) => {
        const hay = `${c.label} ${c.group} ${c.keywords || ''}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        return { c, score: c.label.toLowerCase().startsWith(q) ? 0 : hay.indexOf(words[0]) };
      })
      .filter((x): x is { c: Command; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c);
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const close = () => {
    setQuery('');
    setActive(0);
    onClose();
  };
  const run = (c: Command | undefined) => {
    if (!c) return;
    close();
    c.run();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };

  return (
    <div className="cmdk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command menu" onKeyDown={onKey}>
        <div className="cmdk-input">
          <Search size={16} color="var(--text-3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search projects, pages and actions…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {results.length === 0 && <p className="cmdk-empty">Nothing matches “{query}”.</p>}
          {results.map((c, i) => {
            const header = i === 0 || results[i - 1].group !== c.group ? <p className="cmdk-group">{c.group}</p> : null;
            const Icon = c.icon;
            return (
              <React.Fragment key={c.id}>
                {header}
                <button
                  type="button" id={`cmd-${c.id}`} role="option" aria-selected={i === active} className="cmdk-item"
                  onMouseMove={() => setActive(i)} onClick={() => run(c)}
                >
                  <Icon /> <span className="truncate">{c.label}</span>
                  {c.hint && <span className="hint">{c.hint}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ to move</span><span><CornerDownLeft size={10} /> to run</span><span>? for shortcuts</span>
        </div>
      </div>
    </div>
  );
}
