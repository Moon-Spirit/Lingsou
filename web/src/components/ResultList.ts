import type { SearchResponse } from '../api/client.js';

export interface ResultListHandlers {
  onPageChange: (offset: number) => void;
}

export function ResultList(res: SearchResponse, handlers: ResultListHandlers): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'w-full';

  if (res.hits.length === 0) {
    wrap.innerHTML = `<p class="text-gray-500 text-center py-8">未找到与 "${escapeHtml(res.query)}" 相关的网页</p>`;
    return wrap;
  }

  const list = res.hits
    .map((hit) => {
      // _formatted fields come from Meilisearch with <mark>...</mark> highlights
      // and are considered safe to inject (server-controlled, no user input).
      const titleHtml = hit._formatted?.title ?? escapeHtml(hit.title);
      const contentHtml = hit._formatted?.content ?? escapeHtml(hit.content.slice(0, 200));
      return `
      <article class="mb-6 pb-4 border-b border-gray-100 last:border-b-0">
        <h2 class="text-lg">
          <a href="${escapeHtml(hit.url)}" target="_blank" rel="noopener" class="text-blue-700 hover:underline">${titleHtml}</a>
        </h2>
        <p class="text-green-700 text-sm">${escapeHtml(hit.url)}</p>
        <p class="text-gray-700 text-sm mt-1 leading-relaxed">${contentHtml}</p>
      </article>
    `;
    })
    .join('');

  const total = res.total;
  const page = Math.floor(res.offset / res.limit) + 1;
  const hasNext = res.offset + res.hits.length < total;
  const hasPrev = res.offset > 0;

  wrap.innerHTML = `
    <p class="text-sm text-gray-500 mb-4">找到约 ${total} 条结果 (用时 ${res.processingTimeMs}ms)</p>
    <div class="result-list">${list}</div>
    <div class="flex justify-center gap-2 mt-6">
      <button id="rl-prev" class="px-4 py-1 border rounded ${hasPrev ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}" ${hasPrev ? '' : 'disabled'}>上一页</button>
      <span class="px-3 py-1 text-gray-600">第 ${page} 页</span>
      <button id="rl-next" class="px-4 py-1 border rounded ${hasNext ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}" ${hasNext ? '' : 'disabled'}>下一页</button>
    </div>
  `;

  wrap.querySelector<HTMLButtonElement>('#rl-prev')?.addEventListener('click', () => {
    handlers.onPageChange(Math.max(0, res.offset - res.limit));
  });
  wrap.querySelector<HTMLButtonElement>('#rl-next')?.addEventListener('click', () => {
    handlers.onPageChange(res.offset + res.limit);
  });

  return wrap;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
