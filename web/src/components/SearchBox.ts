import { suggestApi, type SuggestResponse } from '../api/client.js';

export interface SearchBoxHandlers {
  onSearch: (q: string) => void;
}

export function SearchBox(handlers: SearchBoxHandlers): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'relative w-full';
  wrap.innerHTML = `
    <form class="flex gap-2" id="sb-form">
      <input type="search" id="sb-input"
        class="flex-1 px-5 py-3 text-lg rounded-full border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        placeholder="搜索中文网页..." autocomplete="off" />
      <button type="submit"
        class="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition">搜索</button>
    </form>
    <ul id="sb-suggest" class="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden z-10 max-h-80 overflow-auto"></ul>
  `;

  const input = wrap.querySelector<HTMLInputElement>('#sb-input')!;
  const suggest = wrap.querySelector<HTMLUListElement>('#sb-suggest')!;
  const form = wrap.querySelector<HTMLFormElement>('#sb-form')!;

  let debounceTimer: number | null = null;
  let selectedIdx = -1;
  let lastSuggestions: SuggestResponse['suggestions'] = [];

  const renderSuggestions = (items: SuggestResponse['suggestions']): void => {
    lastSuggestions = items;
    selectedIdx = -1;
    if (items.length === 0) {
      suggest.classList.add('hidden');
      return;
    }
    suggest.innerHTML = items
      .map(
        (s, i) =>
          `<li class="px-4 py-2 cursor-pointer hover:bg-blue-50" data-idx="${i}">${escapeHtml(s.title)}</li>`
      )
      .join('');
    suggest.classList.remove('hidden');
  };

  const hideSuggestions = (): void => suggest.classList.add('hidden');

  input.addEventListener('input', () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) {
      hideSuggestions();
      return;
    }
    debounceTimer = window.setTimeout(async () => {
      try {
        const res = await suggestApi(q, 5);
        renderSuggestions(res.suggestions);
      } catch {
        hideSuggestions();
      }
    }, 250);
  });

  input.addEventListener('keydown', (e) => {
    if (suggest.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, lastSuggestions.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, -1);
      updateSelection();
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      const s = lastSuggestions[selectedIdx];
      if (s) {
        input.value = s.title;
        hideSuggestions();
        handlers.onSearch(s.title);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  const updateSelection = (): void => {
    Array.from(suggest.querySelectorAll<HTMLLIElement>('li')).forEach((el, i) => {
      el.classList.toggle('bg-blue-100', i === selectedIdx);
    });
  };

  suggest.addEventListener('mousedown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('li[data-idx]');
    if (!li) return;
    e.preventDefault();
    const idx = Number(li.dataset.idx);
    const s = lastSuggestions[idx];
    if (s) {
      input.value = s.title;
      hideSuggestions();
      handlers.onSearch(s.title);
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target as Node)) hideSuggestions();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) {
      hideSuggestions();
      handlers.onSearch(q);
    }
  });

  return wrap;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
