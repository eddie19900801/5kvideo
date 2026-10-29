(() => {
  const ROOT = document.getElementById('root');
  if (!ROOT || document.getElementById('unified-admin-bar')) return;
  ROOT.classList.add('unified-managed');
  const bar = document.createElement('header');
  bar.id = 'unified-admin-bar';
  bar.innerHTML = `<div class="unified-brand">5K ç»ä¸ç®¡çåå°</div><button type="button" class="unified-tab" data-module="ads">å¹¿åç®¡ç</button><button type="button" class="unified-tab" data-module="navigation">å¯¼èªç®¡ç</button><button type="button" class="unified-tab" data-module="daily">æ¯æ¥äº§åæ°æ®</button><div class="unified-note">å¹¿åä¸­å¿ç»ä¸ç®¡çå¯¼èªç´ æ</div>`;
  document.body.prepend(bar);

  let frame = null, dailyPanel = null, previewRows = [], previewSummary = null;
  const buttons = [...bar.querySelectorAll('[data-module]')];
  const token = () => localStorage.getItem('ad_admin_token') || '';
  async function api(path, options = {}) {
    const response = await fetch(`/ads/api/v1${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) } });
    const refreshedToken = response.headers.get('X-Ad-Admin-Token');
    if (refreshedToken) localStorage.setItem('ad_admin_token', refreshedToken);
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || `è¯·æ±å¤±è´¥ ${response.status}`);
    return payload.data;
  }
  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dates = () => Array.from({ length: 10 }, (_, offset) => { const date = new Date(); date.setDate(date.getDate() - offset); return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); });
  const metricNumber = value => value === '' ? null : Number(value);
  function csvRows(text) {
    const rows = []; let row = [], value = '', quoted = false; text = text.replace(/^\ufeff/, '');
    for (let index = 0; index <= text.length; index += 1) { const char = text[index] ?? '\n'; if (quoted && char === '"' && text[index + 1] === '"') { value += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (!quoted && char === ',') { row.push(value); value = ''; } else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(value); value = ''; if (row.some(cell => cell.trim())) rows.push(row); row = []; } else value += char; }
    return rows;
  }
  function parseMetricCsv(text) {
    const rows = csvRows(text); if (rows.length < 2) throw new Error('è¡¨æ ¼æ²¡æå¯å¯¼å¥çæ°æ®');
    const headers = rows[0].map(value => value.trim()), column = name => headers.indexOf(name);
    for (const required of ['æ¥æ', 'äº§åID', 'äº§ååç§°']) if (column(required) < 0) throw new Error(`ç¼ºå°â${required}âå`);
    const number = (row, name) => { const value = row[column(name)]?.trim(); return value === '' || value == null ? null : Number(value); };
    return rows.slice(1).map(row => ({ date: row[column('æ¥æ')]?.trim() || '', productId: row[column('äº§åID')]?.trim() || '', productName: row[column('äº§ååç§°')]?.trim() || '', cooperationMode: row[column('åä½æ¨¡å¼')]?.trim() || undefined, installs: number(row, 'å®è£æ°'), registrations: number(row, 'æ³¨åæ°'), payers: number(row, 'åå¼äººæ°'), rechargeOrders: number(row, 'åå¼ç¬æ°'), rechargeAmount: number(row, 'åå¼éé¢'), notes: row[column('å¤æ³¨')]?.trim() || null })).filter(row => row.installs != null || row.registrations != null || row.payers != null || row.rechargeOrders != null || row.rechargeAmount != null || row.notes);
  }
  function input(field, row, type = 'number') { const key = field === 'rechargeOrders' ? 'recharge_orders' : field === 'rechargeAmount' ? 'recharge_amount' : field; return `<input data-field="${field}" type="${type}" ${type === 'number' ? `min="0" step="${field === 'rechargeAmount' ? '0.01' : '1'}"` : ''} value="${html(row?.[key] ?? '')}" ${type === 'text' ? 'placeholder="éå¡«"' : ''}>`; }
  function editorRow(date, row) { return `<tr data-date="${date}" data-existing="${row ? '1' : '0'}"><td class="daily-day"><b>${date}</b>${date === dates()[0] ? '<span>ä»å¤©</span>' : ''}</td><td>${input('installs', row)}</td><td>${input('registrations', row)}</td><td>${input('payers', row)}</td><td>${input('rechargeOrders', row)}</td><td>${input('rechargeAmount', row)}</td><td>${input('notes', row, 'text')}</td></tr>`; }
  function collectRows(scope, dirtyOnly = false) {
    return [...scope.querySelectorAll('tr[data-date]')].filter(tr => !dirtyOnly || tr.dataset.dirty === '1').map(tr => { const product = tr.closest('[data-product-id]'), value = field => tr.querySelector(`[data-field="${field}"]`).value.trim(); return { date: tr.dataset.date, productId: product.dataset.productId, productName: product.dataset.productName, cooperationMode: product.dataset.cooperationMode || undefined, installs: metricNumber(value('installs')), registrations: metricNumber(value('registrations')), payers: metricNumber(value('payers')), rechargeOrders: metricNumber(value('rechargeOrders')), rechargeAmount: metricNumber(value('rechargeAmount')), notes: value('notes') || null }; }).filter(row => row.installs != null || row.registrations != null || row.payers != null || row.rechargeOrders != null || row.rechargeAmount != null || row.notes);
  }
  async function saveRows(rows) {
    if (!rows.length) throw new Error('è¯·åå¡«åæä¿®æ¹æ°æ®');
    const check = await api('/admin/product-daily-metrics/preview', { method: 'POST', body: JSON.stringify({ rows }) });
    if (check.invalid) throw new Error(check.errors?.[0]?.message || 'å¡«åçæ°æ®æ ¼å¼ä¸æ­£ç¡®');
    if (check.updates && !confirm(`å¶ä¸­ ${check.updates} è¡å·²ææ°æ®ï¼ç¡®è®¤è¦çæ´æ°åï¼`)) return null;
    return api('/admin/product-daily-metrics/import', { method: 'POST', body: JSON.stringify({ rows, confirmOverwrite: check.updates > 0 }) });
  }
  function filterDailyEditor() {
    const query = dailyPanel.querySelector('[data-editor-search]')?.value.trim().toLowerCase() || ''; let visible = 0;
    for (const product of dailyPanel.querySelectorAll('[data-product-id]')) { const matches = !query || `${product.dataset.productName} ${product.dataset.productId}`.toLowerCase().includes(query); product.style.display = matches ? '' : 'none'; if (matches) visible += 1; }
    dailyPanel.querySelector('[data-search-result]').textContent = query ? `æ¾å° ${visible} æ¬¾äº§å` : '';
  }
  async function loadDailyEditor() {
    const body = dailyPanel.querySelector('[data-products]'), range = dates(); body.innerHTML = '<div class="daily-loading">æ­£å¨å è½½æè¿10å¤©äº§åæ°æ®...</div>';
    try {
      const [bootstrap, metrics] = await Promise.all([api('/admin/bootstrap'), api(`/admin/product-daily-metrics?from=${range[9]}&to=${range[0]}`)]);
      const existing = new Map(metrics.rows.map(row => [`${row.product_id}|${row.date}`, row]));
      body.innerHTML = bootstrap.products.map((product, index) => { const count = range.filter(date => existing.has(`${product.id}|${date}`)).length; return `<details class="daily-product" data-product-id="${product.id}" data-product-name="${html(product.name)}" data-cooperation-mode="${html(product.cooperation_mode || '')}" ${index === 0 ? 'open' : ''}><summary><span class="daily-chevron">âº</span><b>${html(product.name)}</b><span>${html(product.cooperation_mode || 'æªè®¾ç½®æ¨¡å¼')}</span><em>æè¿10å¤©å·²æ ${count} å¤©æ°æ®</em></summary><div class="daily-product-body"><div class="daily-table-wrap"><table><thead><tr><th>æ¥æ</th><th>å®è£</th><th>æ³¨å</th><th>åå¼äººæ°</th><th>åå¼ç¬æ°</th><th>åå¼éé¢</th><th>å¤æ³¨</th></tr></thead><tbody>${range.map(date => editorRow(date, existing.get(`${product.id}|${date}`))).join('')}</tbody></table></div><div class="daily-product-actions"><button data-save-product>ä¿å­è¯¥äº§åä¿®æ¹</button></div></div></details>`; }).join('') || '<div class="daily-loading">ææ äº§åï¼è¯·åå¨äº§åç®¡çä¸­æ·»å ã</div>';
      dailyPanel.querySelector('[data-editor-status]').textContent = `å± ${bootstrap.products.length} æ¬¾äº§åï¼æ¾ç¤ºä»å¤©åä¹å9å¤©ãç¹å»äº§ååç§°å±å¼å¡«åã`;
      filterDailyEditor();
    } catch (error) { body.innerHTML = `<div class="daily-loading daily-error">${html(error.message)}</div>`; }
  }
  function downloadCsv(products) {
    const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`, lines = [['æ¥æ','äº§åID','äº§ååç§°','åä½æ¨¡å¼','å®è£æ°','æ³¨åæ°','åå¼äººæ°','åå¼ç¬æ°','åå¼éé¢','å¤æ³¨']];
    for (const product of products) for (const date of dates()) lines.push([date, product.id, product.name, product.cooperation_mode || '', '', '', '', '', '', '']);
    const blob = new Blob([`\ufeff${lines.map(line => line.map(escape).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'æè¿10å¤©æ¯æ¥äº§åæ°æ®æ¨¡æ¿.csv'; link.click(); URL.revokeObjectURL(link.href);
  }
  function ensureDailyPanel() {
    if (dailyPanel) return dailyPanel;
    dailyPanel = document.createElement('main'); dailyPanel.id = 'unified-daily-panel';
    dailyPanel.innerHTML = `<section><header><div><h1>æ¯æ¥äº§åæ°æ®</h1><p>æäº§åå±å¼æè¿10å¤©ï¼ç´æ¥è¡¥å½æä¿®æ¹æ¯å¤©çæ°æ®ã</p></div><div class="daily-actions"><button data-save-all>ä¿å­å¨é¨ä¿®æ¹</button></div></header><div data-editor-status class="daily-preview"></div><div class="daily-editor-tools"><input data-editor-search type="search" placeholder="æ¨¡ç³æç´¢äº§ååç§°æäº§åID"><span data-search-result></span></div><div data-products class="daily-products"></div><details class="daily-csv-tools"><summary>CSVæ¹éå¯¼å¥ï¼å¯éï¼</summary><div class="daily-actions"><button data-export>å¯¼åºæè¿10å¤©CSVæ¨¡æ¿</button><label>éæ©å¡«å¥½çCSV<input data-file type="file" accept=".csv,text/csv" hidden></label></div><div data-preview class="daily-preview">CSVæ¨¡æ¿èªå¸¦æ¥æï¼å¯ä¸æ¬¡å¡«åå¤ä¸ªäº§ååæ¥æã</div><div class="daily-import-actions"><button data-import disabled>ç¡®è®¤å¯¼å¥CSV</button></div></details></section>`;
    document.body.appendChild(dailyPanel);
    const notice = dailyPanel.querySelector('[data-preview]'), importButton = dailyPanel.querySelector('[data-import]');
    dailyPanel.addEventListener('input', event => { const row = event.target.closest?.('tr[data-date]'); if (row) { row.dataset.dirty = '1'; row.closest('details').classList.add('dirty'); } });
    dailyPanel.addEventListener('click', async event => { const button = event.target.closest?.('[data-save-product]'); if (!button) return; const product = button.closest('[data-product-id]'), status = dailyPanel.querySelector('[data-editor-status]'); try { button.disabled = true; const result = await saveRows(collectRows(product, true)); if (result) { status.textContent = `ä¿å­æåï¼å±ä¿å­ ${result.saved} è¡ã`; await loadDailyEditor(); } } catch (error) { status.textContent = error.message; } finally { button.disabled = false; } });
    dailyPanel.querySelector('[data-save-all]').addEventListener('click', async event => { const button = event.currentTarget, status = dailyPanel.querySelector('[data-editor-status]'); try { button.disabled = true; const result = await saveRows(collectRows(dailyPanel, true)); if (result) { status.textContent = `ä¿å­æåï¼å±ä¿å­ ${result.saved} è¡ã`; await loadDailyEditor(); } } catch (error) { status.textContent = error.message; } finally { button.disabled = false; } });
    dailyPanel.querySelector('[data-editor-search]').addEventListener('input', filterDailyEditor);
    dailyPanel.querySelector('[data-export]').addEventListener('click', async () => { try { downloadCsv((await api('/admin/bootstrap')).products); } catch (error) { notice.textContent = error.message; } });
    dailyPanel.querySelector('[data-file]').addEventListener('change', async event => { try { previewRows = parseMetricCsv(await event.target.files[0].text()); const result = await api('/admin/product-daily-metrics/preview', { method: 'POST', body: JSON.stringify({ rows: previewRows }) }); previewSummary = result; notice.innerHTML = `ææ ${result.valid} è¡ï¼æ°å¢ ${result.inserts} è¡ï¼æ´æ° ${result.updates} è¡ï¼éè¯¯ ${result.invalid} è¡${result.errors.length ? `<ul>${result.errors.slice(0, 20).map(error => `<li>ç¬¬${error.row}è¡ï¼${html(error.message)}</li>`).join('')}</ul>` : ''}`; importButton.disabled = result.invalid > 0 || result.valid === 0; } catch (error) { previewRows = []; previewSummary = null; importButton.disabled = true; notice.textContent = error.message; } });
    importButton.addEventListener('click', async () => { try { const overwrite = (previewSummary?.updates || 0) > 0; if (overwrite && !confirm(`å·²æ ${previewSummary.updates} è¡æ°æ®ï¼ç¡®è®¤è¦çæ´æ°åï¼`)) return; importButton.disabled = true; const result = await api('/admin/product-daily-metrics/import', { method: 'POST', body: JSON.stringify({ rows: previewRows, confirmOverwrite: overwrite }) }); notice.textContent = `å¯¼å¥æåï¼å±ä¿å­ ${result.saved} è¡ã`; previewRows = []; previewSummary = null; await loadDailyEditor(); } catch (error) { notice.textContent = error.message; importButton.disabled = false; } });
    loadDailyEditor(); return dailyPanel;
  }
  function show(module, updateUrl = true) {
    const navigation = module === 'navigation', daily = module === 'daily';
    buttons.forEach(button => button.classList.toggle('active', button.dataset.module === module)); ROOT.style.display = navigation || daily ? 'none' : '';
    if (daily) ensureDailyPanel().style.display = 'block'; else if (dailyPanel) dailyPanel.style.display = 'none';
    if (navigation) { if (!frame) { frame = document.createElement('iframe'); frame.id = 'unified-navigation-frame'; frame.title = 'å¯¼èªç®¡ç'; frame.src = '/dhang/admin?embedded=1&v=20261015-contact-config'; frame.addEventListener('load', () => { const hidden = new Set(['å¯¼èªåå®¹','Bannerç®¡ç','é¦å±å¼¹çª','åºé¨é£çª']), hide = () => { const doc = frame.contentDocument; if (!doc) return; for (const button of doc.querySelectorAll('button')) if (hidden.has(button.textContent.trim())) button.style.display = 'none'; }; hide(); const doc = frame.contentDocument; if (doc?.body) new MutationObserver(hide).observe(doc.body, { childList: true, subtree: true }); }); document.body.appendChild(frame); } frame.style.display = 'block'; } else if (frame) frame.style.display = 'none';
    if (updateUrl) { const url = new URL(location.href); if (navigation || daily) url.searchParams.set('module', module); else url.searchParams.delete('module'); history.replaceState({ module }, '', url); }
  }
  buttons.forEach(button => button.addEventListener('click', () => show(button.dataset.module)));
  addEventListener('popstate', () => { const module = new URL(location.href).searchParams.get('module'); show(['navigation','daily'].includes(module) ? module : 'ads', false); });
  { const module = new URL(location.href).searchParams.get('module'); show(['navigation','daily'].includes(module) ? module : 'ads', false); }
})();

