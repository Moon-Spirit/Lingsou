import { SearchBox } from './components/SearchBox.js';
import { ResultList } from './components/ResultList.js';
import { HistoryPanel, pushHistory } from './components/HistoryPanel.js';
import { searchApi, type SearchResponse } from './api/client.js';

export function App(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'min-h-screen flex flex-col items-center pt-24 bg-gray-50 pb-12';
  root.innerHTML = `
    <h1 class="text-4xl font-bold text-gray-800 mb-2">灵搜</h1>
    <p class="text-gray-500 mb-8">Lingsou — 通用网页搜索引擎</p>
    <div id="search-root" class="w-full max-w-2xl px-4"></div>
    <div id="history-root" class="w-full max-w-2xl px-4 mt-4"></div>
    <div id="results-root" class="w-full max-w-3xl px-4 mt-6"></div>
  `;

  const searchRoot = root.querySelector<HTMLElement>('#search-root')!;
  const resultsRoot = root.querySelector<HTMLElement>('#results-root')!;
  const historyRoot = root.querySelector<HTMLElement>('#history-root')!;

  const mountHistory = (): void => {
    historyRoot.innerHTML = '';
    historyRoot.appendChild(
      HistoryPanel({
        onSelect: (q) => {
          doSearch(q);
        },
      })
    );
  };

  // Re-render a result page for a given query. Closured so we can pass it as
  // the onPageChange callback without resorting to `arguments.callee` (which
  // is banned in TypeScript strict mode / ES modules).
  const renderPage = async (q: string, offset: number): Promise<void> => {
    resultsRoot.innerHTML = `<p class="text-gray-500 text-center py-8">加载...</p>`;
    try {
      const res: SearchResponse = await searchApi(q, { limit: 10, offset });
      resultsRoot.innerHTML = '';
      resultsRoot.appendChild(
        ResultList(res, {
          onPageChange: (nextOffset) => {
            void renderPage(q, nextOffset);
          },
        })
      );
    } catch (e) {
      resultsRoot.innerHTML = `<p class="text-red-500 text-center py-8">加载失败: ${escapeHtml((e as Error).message)}</p>`;
    }
  };

  async function doSearch(q: string): Promise<void> {
    if (!q.trim()) return;
    pushHistory(q);
    mountHistory();
    resultsRoot.innerHTML = `<p class="text-gray-500 text-center py-8">搜索中: ${escapeHtml(q)} ...</p>`;
    try {
      const res: SearchResponse = await searchApi(q, { limit: 10, offset: 0 });
      resultsRoot.innerHTML = '';
      resultsRoot.appendChild(
        ResultList(res, {
          onPageChange: (nextOffset) => {
            void renderPage(q, nextOffset);
          },
        })
      );
    } catch (e) {
      resultsRoot.innerHTML = `<p class="text-red-500 text-center py-8">搜索失败: ${escapeHtml((e as Error).message)}</p>`;
    }
  }

  mountHistory();
  searchRoot.appendChild(
    SearchBox({
      onSearch: (q) => {
        void doSearch(q);
      },
    })
  );

  return root;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
