// Browser-only search history. Stored in localStorage so it survives reloads
// without any server-side persistence. Most-recent first, capped at MAX entries.

const KEY = 'lingsou_history';
const MAX = 10;

export interface HistoryHandlers {
  onSelect: (q: string) => void;
}

export function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string').slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushHistory(q: string): void {
  if (!q.trim()) return;
  const list = readHistory().filter((x) => x !== q);
  list.unshift(q);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* localStorage quota exceeded or unavailable — silently ignore */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function HistoryPanel(handlers: HistoryHandlers): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'w-full text-sm text-gray-600';
  render();
  return wrap;

  function render(): void {
    const list = readHistory();
    if (list.length === 0) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-gray-500">最近搜索</span>
        <button id="hp-clear" class="text-xs text-gray-400 hover:text-red-500">清除</button>
      </div>
      <div class="flex flex-wrap gap-2">
        ${list
          .map(
            (q, i) =>
              `<button data-q="${escapeHtml(q)}" data-idx="${i}" class="hp-item px-3 py-1 bg-white border rounded-full hover:bg-blue-50">${escapeHtml(q)}</button>`
          )
          .join('')}
      </div>
    `;
    wrap.querySelectorAll<HTMLButtonElement>('button.hp-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        if (q) handlers.onSelect(q);
      });
    });
    wrap.querySelector<HTMLButtonElement>('#hp-clear')?.addEventListener('click', () => {
      clearHistory();
      render();
    });
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
