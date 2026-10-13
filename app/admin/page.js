'use client';
import { useState, useMemo, useEffect } from 'react';
import { compressProductImages } from '@/lib/compress-image';
const KES = n => 'KES ' + Math.round(n || 0).toLocaleString();
const TABS = [
  ['dash', 'Overview'], ['inv', 'Products'], ['categories', 'Categories'], ['orders', 'Orders'],
  ['stock', 'Stock'], ['sale', 'Record sale'], ['expenses', 'Expenses'], ['customers', 'Customers'],
  ['reports', 'Reports'], ['insights', 'Insights'], ['settings', 'Store settings'],
];

export default function Admin() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState('dash');
  const [products, setProducts] = useState([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [sales, setSales] = useState([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);
  const [orders, setOrders] = useState([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderStatus, setOrderStatus] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [settings, setSettings] = useState({});
  const [summary, setSummary] = useState({});
  const [summaryVersion, setSummaryVersion] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [insights, setInsights] = useState({ products: [], trending: [] });
  const [report, setReport] = useState([]);
  const [peakTimes, setPeakTimes] = useState([]);
  const [reportGroup, setReportGroup] = useState('day');
  const [dateRange, setDateRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [sale, setSale] = useState({ product_id: '', qty: 1, selling_price: '' });
  const [expense, setExpense] = useState({ category: 'Transport', description: '', amount: '' });
  const [trend, setTrend] = useState({ keyword: '', link_url: '' });
  const [customerDataLoaded, setCustomerDataLoaded] = useState(false);
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const KES = value => `${settings.currency || 'KES'} ${Math.round(Number(value) || 0).toLocaleString()}`;

  useEffect(() => {
    fetch('/api/admin/session').then(response => response.json()).then(async data => {
      if (data.authenticated && await load()) setAuthed(true);
    }).catch(() => setMsg('Unable to reach the server. Please try again.'))
      .finally(() => setCheckingSession(false));
  }, []);
  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams({ range: dateRange });
    if (dateRange === 'custom') {
      if (customFrom) params.set('from', customFrom);
      if (customTo) params.set('to', customTo);
    }
    fetch(`/api/admin/summary?${params}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load dashboard summary.');
      setSummary(data);
    }).catch(error => setMsg(error.message));
  }, [authed, dateRange, customFrom, customTo, summaryVersion]);

  const load = async () => {
    try {
      const endpoints = [
        `/api/products?visible=all&limit=48&page=${productPage}`, `/api/sales?page=${salesPage}&limit=15`,
        `/api/orders?page=${orderPage}${orderStatus ? `&status=${encodeURIComponent(orderStatus)}` : ''}${orderSearch ? `&q=${encodeURIComponent(orderSearch)}` : ''}`,
        '/api/categories', '/api/settings', `/api/expenses?page=${expensePage}`, `/api/stock-movements?page=${movementPage}`,
      ];
      const responses = await Promise.all(endpoints.map(url => fetch(url)));
      const payloads = await Promise.all(responses.map(response => response.json()));
      if (responses.some(response => !response.ok)) {
        const index = responses.findIndex(response => !response.ok);
        setMsg(payloads[index].error || 'Could not load dashboard data.');
        return false;
      }
      setProducts(payloads[0].products || []);
      setProductTotal(payloads[0].total || 0);
      setSales(payloads[1].sales || []);
      setSalesTotal(payloads[1].total || 0);
      setOrders(payloads[2].orders || []);
      setOrderTotal(payloads[2].total || 0);
      setCategories(payloads[3]);
      setSettings(payloads[4]);
      setExpenses(payloads[5].expenses || []);
      setExpenseTotal(payloads[5].total || 0);
      setMovements(payloads[6].movements || []);
      setMovementTotal(payloads[6].total || 0);
      return true;
    } catch {
      setMsg('Unable to reach the server. Please try again.');
      return false;
    }
  };
  useEffect(() => { if (authed) load(); }, [productPage, salesPage, orderPage, expensePage, movementPage]);
  const login = async e => {
    e.preventDefault();
    setMsg('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await response.json();
      if (!response.ok) { setMsg(data.error || 'Could not sign in.'); return; }
      if (await load()) setAuthed(true);
    } catch { setMsg('Unable to reach the server. Please try again.'); }
  };
  const call = async (url, opts) => {
    try {
      const r = await fetch(url, opts);
      const d = await r.json();
      setMsg(r.ok ? 'Saved ✓' : d.error || 'Could not save changes.');
      if (r.ok) {
        await load();
        setSummaryVersion(version => version + 1);
      }
      return r.ok;
    } catch {
      setMsg('Unable to reach the server. Please try again.');
      return false;
    }
  };

  const addProduct = async e => {
    e.preventDefault();
    const form = e.target;
    setBusy(true);
    try {
      const data = new FormData(form);
      const files = [...form.elements.images.files];
      data.delete('images');
      for (const image of await compressProductImages(files)) data.append('images', image);
      if (await call('/api/products', { method: 'POST', body: data })) form.reset();
    } catch (error) { setMsg(error.message); }
    finally { setBusy(false); }
  };
  const recordSale = async e => {
    e.preventDefault();
    if (await call('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sale) }))
      setSale({ product_id: '', qty: 1, selling_price: '' });
  };
  const restock = p => {
    const n = prompt(`Add how many units to "${p.name}"?`); if (!n) return;
    const bp = prompt('New buying price per unit (leave blank to keep ' + p.buying_price + ')');
    const note = prompt('Supplier or restock note (optional)', '');
    call('/api/products/' + p.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addStock: n, supplier_note: note || '', ...(bp ? { buying_price: bp } : {}) }) });
  };
  const editPrice = p => {
    const v = prompt('New selling price for ' + p.name, p.price); if (!v) return;
    call('/api/products/' + p.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price: v }) });
  };
  const editCategory = p => {
    const value = prompt('Category for ' + p.name, p.category || 'Uncategorized');
    if (value == null || !value.trim()) return;
    call('/api/products/' + p.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: value.trim() }) });
  };
  const toggleFeatured = p => call('/api/products/' + p.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_featured: !p.is_featured }),
  });
  const toggleVisible = p => call('/api/products/' + p.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_visible: !p.is_visible }),
  });
  const editProduct = p => {
    const name = prompt('Product name', p.name);
    if (name == null || !name.trim()) return;
    const description = prompt('Description', p.description || '');
    if (description == null) return;
    const values = { name: name.trim(), description };
    const nameSw = prompt('Swahili name (optional)', p.name_sw || '');
    if (nameSw != null) values.name_sw = nameSw;
    const descriptionSw = prompt('Swahili description (optional)', p.description_sw || '');
    if (descriptionSw != null) values.description_sw = descriptionSw;
    const sku = prompt('SKU', p.sku || '');
    if (sku != null) values.sku = sku;
    const sizes = prompt('Sizes, comma separated', p.sizes || '');
    if (sizes != null) values.sizes = sizes;
    const colours = prompt('Colours, comma separated', (p.colours || []).join(', '));
    if (colours != null) values.colours = colours.split(',').map(value => value.trim()).filter(Boolean);
    const compareAt = prompt('Compare-at price (blank to remove)', p.compare_at_price || '');
    if (compareAt != null) values.compare_at_price = compareAt || null;
    const currentImages = p.images?.length ? p.images : [p.image_url].filter(Boolean);
    const imageList = prompt('Product image URLs in display order (first image is the cover; remove a line to delete it)', currentImages.join('\n'));
    if (imageList != null) values.images = imageList.split('\n').map(value => value.trim()).filter(Boolean).slice(0, 6);
    call('/api/products/' + p.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  };
  const del = p => confirm('Delete ' + p.name + '?') && call('/api/products/' + p.id, { method: 'DELETE' });
  const updateOrder = (order, status) => call(`/api/orders/${order.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
  });
  const editCategoryName = category => {
    const name = prompt('Category name', category.name);
    if (name == null || !name.trim()) return;
    call(`/api/categories/${category.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
  };
  const toggleCategory = category => call(`/api/categories/${category.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_visible: !category.is_visible }),
  });
  const deleteCategory = category => {
    if (confirm(`Delete category "${category.name}"? Products will remain in your inventory.`)) {
      call(`/api/categories/${category.id}`, { method: 'DELETE' });
    }
  };
  const createCategory = async event => {
    event.preventDefault();
    const form = new FormData(event.target);
    if (await call('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) })) event.target.reset();
  };
  const createExpense = async event => {
    event.preventDefault();
    if (await call('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expense) })) {
      setExpense({ category: 'Transport', description: '', amount: '' });
      event.target.reset();
    }
  };
  const saveSettings = async event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const values = Object.fromEntries(form);
    try {
      values.banners = values.banners ? JSON.parse(values.banners) : [];
      values.social_links = values.social_links ? JSON.parse(values.social_links) : {};
    } catch { setMsg('Banners and social links must be valid JSON.'); return; }
    for (const field of ['delivery_fee', 'free_delivery_threshold', 'low_stock_threshold']) {
      if (values[field] === '') values[field] = null;
      else values[field] = Number(values[field]);
    }
    await call('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
  };
  const bulkAction = async action => {
    if (!selectedProducts.length) return;
    const body = { action, ids: selectedProducts };
    if (action === 'category') {
      body.category = prompt('Set category for selected products');
      if (!body.category) return;
    }
    if (action === 'restock') {
      body.quantity = prompt('Units to add to each selected product');
      if (!body.quantity) return;
      body.note = prompt('Supplier note (optional)', '') || '';
    }
    if (await call('/api/products/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })) setSelectedProducts([]);
  };
  const loadCustomers = async () => {
    const response = await fetch('/api/customers');
    const data = await response.json();
    if (!response.ok) { setMsg(data.error || 'Could not load customers.'); return; }
    setCustomers(data);
    setCustomerDataLoaded(true);
  };
  const loadInsights = async () => {
    const response = await fetch('/api/insights');
    const data = await response.json();
    if (!response.ok) { setMsg(data.error || 'Could not load product insights.'); return; }
    setInsights(data);
    setInsightsLoaded(true);
  };
  const loadReport = async () => {
    const variant = ['size', 'colour'].includes(reportGroup);
    const [response, peaksResponse] = await Promise.all([
      fetch(variant ? `/api/reports?type=variants&variant=${reportGroup}` : `/api/reports?group=${reportGroup}`),
      fetch('/api/reports?type=peak-times'),
    ]);
    const data = await response.json();
    if (!response.ok) { setMsg(data.error || 'Could not load the report.'); return; }
    setReport(data);
    const peaks = await peaksResponse.json();
    if (!peaksResponse.ok) { setMsg(peaks.error || 'Could not load peak order times.'); return; }
    setPeakTimes(peaks);
  };
  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
    setPw('');
  };

  const st = useMemo(() => {
    const revenue = Number(summary.revenue ?? sales.reduce((s, x) => s + x.qty * x.selling_price, 0));
    const cost = Number(summary.cogs ?? sales.reduce((s, x) => s + x.qty * x.buying_price, 0));
    const expensesTotal = Number(summary.expenses ?? expenses.reduce((s, x) => s + Number(x.amount), 0));
    const profit = Number(summary.profit ?? revenue - cost - expensesTotal);
    const days = (summary.trend || []).map(row => ({ k: row.label, rev: row.revenue, profit: row.profit }));
    const top = (summary.top_products || []).map(row => ({ n: row.name, qty: row.units, profit: row.profit }));
    return {
      revenue, cost, expenses: expensesTotal, profit, margin: Number(summary.margin ?? (revenue ? profit / revenue * 100 : 0)),
      items: Number(summary.units ?? sales.reduce((s, x) => s + x.qty, 0)),
      orderCount: Number(summary.orders ?? orders.length),
      averageOrderValue: Number(summary.average_order_value ?? 0),
      funnel: summary.order_funnel || {},
      stockCost: Number(summary.stock_cost ?? products.reduce((s, p) => s + (p.stock || 0) * (p.buying_price || 0), 0)),
      stockRetail: Number(summary.stock_retail ?? products.reduce((s, p) => s + (p.stock || 0) * p.price, 0)),
      low: summary.low_stock_products || products.filter(p => (p.stock || 0) <= Number(settings.low_stock_threshold ?? 3)), days,
      top,
      max: Math.max(1, ...days.map(d => d.rev)),
    };
  }, [sales, products, orders, expenses, summary, dateRange, settings]);

  if (checkingSession) return <main className="admin-login-shell" aria-busy="true"><span className="admin-loading">Checking your session…</span></main>;

  if (!authed) return (<main className="admin-login-shell"><a className="brand" href="/"><img className="store-logo" src="/chelsie-logo.jpeg" alt="" />
    <span className="brand-name">Chelsie Trend Closet<small>YOUR STYLE, YOUR STORY</small></span></a>
    <form className="form login-form" onSubmit={login}><span className="eyebrow">THE BACK OFFICE</span>
      <h1>Welcome back.</h1><p>Sign in to manage your shop and keep things running smoothly.</p>
      <label htmlFor="admin-password">Admin password</label>
      <input id="admin-password" type="password" placeholder="Enter your password" value={pw} onChange={e => setPw(e.target.value)} required />
      <button className="btn">Sign in to dashboard <span>↗</span></button><small role="status">{msg}</small></form>
    <a className="login-back" href="/">← Back to the shop</a></main>);

  return (<>
    <header className="admin-header"><a className="brand" href="/"><img className="store-logo" src={settings.logo_url || '/chelsie-logo.jpeg'} alt="" />
      <span className="brand-name">{settings.store_name || 'Chelsie Trend Closet'}<small>STUDIO · ADMIN</small></span></a>
      <div className="admin-user"><span className="admin-avatar">C</span><span>Shop manager<small>Store admin</small></span></div>
      <div className="admin-header-actions"><a className="admin-shop-link" href="/">View storefront <span>↗</span></a>
        <button className="admin-shop-link" onClick={logout}>Sign out</button></div></header>
    <main className="wrap admin-wrap">
      <div className="admin-welcome"><div><span className="eyebrow">YOUR SHOP, AT A GLANCE</span><h1>Good to see you.</h1>
        <p>Here’s how things are looking at Chelsie Trend Closet.</p></div><span className="today-label">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
      <div className="admin-layout">
      <nav className="tabs admin-tabs" aria-label="Admin sections">
        {TABS.map(([key, label]) =>
          <button key={key} className={'admin-tab ' + (tab === key ? 'selected' : '')} onClick={() => {
            setTab(key); setMsg('');
            if (key === 'customers' && !customerDataLoaded) loadCustomers();
            if (key === 'insights' && !insightsLoaded) loadInsights();
            if (key === 'reports') loadReport();
          }}>{label}</button>)}
      </nav>
      <div className="admin-content">
      {msg && <p className={`admin-message${msg.startsWith('Saved') ? ' success' : ''}`} role="status">{msg}</p>}

      {tab === 'dash' && <>
        <div className="date-range-tools"><label>Reporting period<select value={dateRange} onChange={event => setDateRange(event.target.value)}>
          <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option><option value="custom">Custom dates</option></select></label>
          {dateRange === 'custom' && <><label>From<input type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} /></label>
            <label>To<input type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} /></label></>}</div>
        <div className="kpis">
          <div className="kpi"><small>Sales revenue</small><b>{KES(st.revenue)}</b><span>All recorded sales</span></div>
          <div className="kpi"><small>Cost of goods sold</small><b>{KES(st.cost)}</b><span>Sales at buying price</span></div>
          <div className="kpi"><small>Net profit</small><b className={st.profit >= 0 ? 'pos' : 'neg'}>{KES(st.profit)}</b><span>Revenue less product cost and expenses</span></div>
          <div className="kpi"><small>Profit margin</small><b>{st.margin.toFixed(1)}%</b><span>Across recorded sales</span></div>
          <div className="kpi"><small>Orders</small><b>{st.orderCount}</b><span>Not including cancellations</span></div>
          <div className="kpi"><small>Average order value</small><b>{KES(st.averageOrderValue)}</b><span>Typical order total</span></div>
          <div className="kpi"><small>Units sold</small><b>{st.items}</b><span>Confirmed and walk-in sales</span></div>
          <div className="kpi"><small>Expenses</small><b>{KES(st.expenses)}</b><span>Deducted from net profit</span></div>
          <div className="kpi"><small>Stock at cost</small><b>{KES(st.stockCost)}</b><span>Current inventory value</span></div>
          <div className="kpi"><small>Stock at retail</small><b>{KES(st.stockRetail)}</b><span>Potential sales value</span></div>
          <div className="kpi"><small>Needs attention</small><b className={st.low.length ? 'low' : ''}>{st.low.length}</b><span>Low or out of stock</span></div>
        </div>
        <div className="box"><div className="box-heading"><div><span className="eyebrow">SALES OVER TIME</span><h2>Revenue and net profit</h2></div>
          <small><span className="legend-revenue" /> Revenue <span className="legend-profit" /> Profit</small></div>
          <div className="chart">{st.days.map(d => (
            <div className="col" key={d.k} title={`${d.k}: revenue ${KES(d.rev)}, net profit ${KES(d.profit)}`}>
              <div className="bar" style={{ height: d.rev / st.max * 100 + '%' }}>
                <div className="pbar" style={{ height: d.rev ? Math.max(d.profit, 0) / d.rev * 100 + '%' : 0 }} /></div>
              <small>{d.k.slice(8)}</small></div>))}</div></div>
        <div className="box"><div className="box-heading"><div><span className="eyebrow">BEST PERFORMERS</span><h2>Top products by profit</h2></div></div>
          <table><tbody>{st.top.map(t => <tr key={t.n}><td>{t.n}</td><td>{t.qty} sold</td><td className="pos">{KES(t.profit)}</td></tr>)}
            {!st.top.length && <tr><td>No sales recorded in this period</td></tr>}</tbody></table></div>
        {!!st.low.length && <div className="box"><div className="box-heading"><div><span className="eyebrow">STOCK ALERT</span><h2 className="low">Restock soon</h2></div></div>
          <table><tbody>{st.low.map(p => <tr key={p.id}><td>{p.name}</td><td className="low">{p.stock || 0} left</td></tr>)}</tbody></table></div>}
        <div className="box"><div className="box-heading"><div><span className="eyebrow">ORDER FUNNEL</span><h2>Orders by status</h2></div></div>
          <div className="status-summary">{Object.entries(st.funnel).map(([status, count]) =>
            <div key={status}><b>{count}</b><span>{status}</span></div>)}</div></div>
      </>}

      {tab === 'inv' && <div className="box table-box" style={{ overflowX: 'auto' }}><div className="box-heading"><div><span className="eyebrow">YOUR CATALOGUE</span><h2>Products</h2></div><span className="results-count">{productTotal} products · page {productPage}</span></div>
        <div className="bulk-actions"><span>{selectedProducts.length} selected</span><button className="btn alt" disabled={busy || !selectedProducts.length} onClick={() => bulkAction('hide')}>Hide selected</button>
          <button className="btn alt" disabled={busy || !selectedProducts.length} onClick={() => bulkAction('category')}>Change category</button>
          <button className="btn alt" disabled={busy || !selectedProducts.length} onClick={() => bulkAction('restock')}>Bulk restock</button>
          <button className="btn" onClick={() => setTab('add')}>＋ Add product</button></div><table>
        <thead><tr><th><input type="checkbox" aria-label="Select all products" checked={products.length > 0 && selectedProducts.length === products.length}
          onChange={event => setSelectedProducts(event.target.checked ? products.map(product => product.id) : [])} /></th><th>Product</th><th>Category</th><th>Stock</th><th>Buy</th><th>Sell</th><th>Margin</th><th>Popular</th><th>Visibility</th><th>Actions</th></tr></thead>
        <tbody>{products.map(p => (<tr key={p.id}>
          <td><input type="checkbox" aria-label={`Select ${p.name}`} checked={selectedProducts.includes(p.id)}
            onChange={event => setSelectedProducts(current => event.target.checked ? [...current, p.id] : current.filter(id => id !== p.id))} /></td>
          <td><div className="inventory-product">{(p.images?.[0] || p.image_url) ? <img src={p.images?.[0] || p.image_url} alt="" loading="lazy" decoding="async" /> : <span className="inventory-placeholder">C</span>}<b>{p.name}</b></div></td>
          <td>{p.category || 'Uncategorized'}</td><td className={(p.stock || 0) <= Number(settings.low_stock_threshold ?? 3) ? 'low' : ''}>{p.stock || 0}</td>
          <td>{KES(p.buying_price)}</td><td>{KES(p.price)}</td>
          <td>{p.price ? ((p.price - p.buying_price) / p.price * 100).toFixed(0) : 0}%</td>
          <td><button className={`feature-toggle${p.is_featured ? ' featured' : ''}`} onClick={() => toggleFeatured(p)} aria-label={`${p.is_featured ? 'Remove' : 'Mark'} ${p.name} ${p.is_featured ? 'from' : 'as'} popular`}>{p.is_featured ? '★ Popular' : '☆ Feature'}</button></td>
          <td><button className={`feature-toggle${p.is_visible ? ' featured' : ''}`} onClick={() => toggleVisible(p)}>{p.is_visible ? 'Visible' : 'Hidden'}</button></td>
          <td style={{ whiteSpace: 'nowrap' }}>
            <button className="btn alt" onClick={() => restock(p)}>+ Stock</button>{' '}
            <button className="btn alt" onClick={() => editProduct(p)}>Edit</button>{' '}
            <button className="btn alt" onClick={() => editCategory(p)}>Category</button>{' '}
            <button className="btn alt" onClick={() => editPrice(p)}>Price</button>{' '}
            <button className="btn alt" onClick={() => del(p)}>Delete</button></td></tr>))}</tbody></table>
        <div className="pagination-controls"><button className="btn alt" disabled={productPage <= 1} onClick={() => setProductPage(page => page - 1)}>Previous products</button>
            <span>{products.length} shown on this page</span><button className="btn alt" disabled={productPage * 48 >= productTotal} onClick={() => setProductPage(page => page + 1)}>Next products</button></div></div>}

      {tab === 'categories' && <div className="admin-columns">
        <form className="form admin-form" onSubmit={createCategory}><span className="eyebrow">ORGANISE YOUR SHOP</span><h2>Add a category</h2>
          <label>Category name<input name="name" placeholder="e.g. New season dresses" required maxLength="60" /></label>
          <label>Category image URL<input name="image_url" type="url" placeholder="https://..." /></label>
          <label>Display order<input name="sort_order" type="number" defaultValue="0" /></label>
          <button className="btn">Create category <span>↗</span></button></form>
        <div className="box table-box"><div className="box-heading"><div><span className="eyebrow">SHOP COLLECTIONS</span><h2>Categories</h2></div></div>
          <table><thead><tr><th>Name</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {categories.map(category => <tr key={category.id}><td>{category.name}</td><td>{category.sort_order}</td>
              <td>{category.is_visible ? 'Visible' : 'Hidden'}</td><td className="table-actions">
                <button className="btn alt" onClick={() => editCategoryName(category)}>Edit</button>
                <button className="btn alt" onClick={() => toggleCategory(category)}>{category.is_visible ? 'Hide' : 'Show'}</button>
                <button className="btn alt" onClick={() => deleteCategory(category)}>Delete</button>
              </td></tr>)}
            {!categories.length && <tr><td colSpan="4">No categories yet. Add your first collection above.</td></tr>}
          </tbody></table></div>
      </div>}

      {tab === 'orders' && <section className="box table-box">
        <div className="box-heading"><div><span className="eyebrow">CUSTOMER CHECKOUTS</span><h2>Orders</h2></div>
          <span className="results-count">{orderTotal} matching orders</span></div>
        <div className="order-filters"><label>Search orders<input value={orderSearch} onChange={event => setOrderSearch(event.target.value)} placeholder="Name, phone or order number" /></label>
          <label>Status<select value={orderStatus} onChange={event => setOrderStatus(event.target.value)}>
            <option value="">All statuses</option>{['new', 'confirmed', 'paid', 'delivered', 'cancelled'].map(status => <option key={status}>{status}</option>)}
          </select></label><button className="btn alt" onClick={() => orderPage === 1 ? load() : setOrderPage(1)}>Apply filters</button></div>
        <div className="order-list">{orders.map(order => <article className="order-card" key={order.id}>
          <div className="order-card-heading"><div><b>{order.order_number}</b><span>{new Date(order.created_at).toLocaleString()}</span></div>
            <span className={`order-status status-${order.status}`}>{order.status}</span></div>
          <div className="order-customer"><b>{order.customer_name}</b><a href={`https://wa.me/${String(order.phone).replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer">{order.phone} ↗</a>
            <span>{order.delivery_method === 'pickup' ? 'Pickup' : `${order.delivery_area}${order.street ? ` · ${order.street}` : ''}`}</span></div>
          <ul>{(order.order_items || []).map(item => <li key={item.id}>{item.product_name}{item.size && ` · ${item.size}`}{item.colour && ` · ${item.colour}`} × {item.quantity}<b>{KES(item.line_total)}</b></li>)}</ul>
          <div className="order-card-footer"><span>{order.payment_method.replaceAll('_', ' ')} · <b>{KES(order.total)}</b></span>
            <div className="order-actions">
              {order.status === 'new' && <button className="btn" onClick={() => updateOrder(order, 'confirmed')}>Confirm &amp; deduct stock</button>}
              {order.status === 'confirmed' && <button className="btn" onClick={() => updateOrder(order, 'paid')}>Mark paid</button>}
              {order.status === 'paid' && <button className="btn" onClick={() => updateOrder(order, 'delivered')}>Mark delivered</button>}
              {!['delivered', 'cancelled'].includes(order.status) && <button className="btn alt" onClick={() => updateOrder(order, 'cancelled')}>Cancel</button>}
            </div>
          </div>
        </article>)}
          {!orders.length && <div className="empty-admin">No matching orders. New WhatsApp checkout requests will show here.</div>}
        </div><div className="pagination-controls"><button className="btn alt" disabled={orderPage <= 1} onClick={() => setOrderPage(page => page - 1)}>Previous orders</button>
          <span>{orderTotal} matching orders · page {orderPage}</span><button className="btn alt" disabled={orderPage * 30 >= orderTotal} onClick={() => setOrderPage(page => page + 1)}>Next orders</button></div>
      </section>}

      {tab === 'stock' && <section className="box table-box">
        <div className="box-heading"><div><span className="eyebrow">INVENTORY MOVEMENTS</span><h2>Stock history</h2></div><span className="results-count">{movementTotal} movements</span></div>
        <div className="stock-alerts">{products.filter(product => Number(product.stock || 0) <= Number(settings.low_stock_threshold ?? 3))
          .map(product => <button key={product.id} onClick={() => restock(product)}><b>{product.name}</b><span>{product.stock || 0} left · Restock ↗</span></button>)}
          {!products.some(product => Number(product.stock || 0) <= Number(settings.low_stock_threshold ?? 3)) && <span>All products are above the restock threshold.</span>}
        </div>
        <div className="table-scroll"><table><thead><tr><th>When</th><th>Product</th><th>Movement</th><th>Quantity</th><th>Unit cost</th><th>Note</th></tr></thead>
          <tbody>{movements.map(movement => <tr key={movement.id}><td>{new Date(movement.created_at).toLocaleString()}</td>
            <td>{movement.products?.name || 'Removed product'}</td><td>{movement.movement_type}</td><td className={movement.quantity < 0 ? 'neg' : 'pos'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</td>
            <td>{KES(movement.unit_cost)}</td><td>{movement.note}</td></tr>)}
            {!movements.length && <tr><td colSpan="6">Stock changes will be recorded here.</td></tr>}</tbody></table></div>
        <div className="pagination-controls"><button className="btn alt" disabled={movementPage <= 1} onClick={() => setMovementPage(page => page - 1)}>Previous</button>
          <span>Page {movementPage}</span><button className="btn alt" disabled={movementPage * 50 >= movementTotal} onClick={() => setMovementPage(page => page + 1)}>Next</button></div>
      </section>}

      {tab === 'sale' && <><form className="form admin-form" onSubmit={recordSale}><span className="eyebrow">CHECKOUT</span><h2>Record a sale</h2>
        <select required value={sale.product_id} onChange={e => { const p = products.find(x => x.id === e.target.value); setSale({ ...sale, product_id: e.target.value, selling_price: p ? p.price : '' }); }}>
          <option value="">Select product</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock || 0} in stock)</option>)}</select>
        <input type="number" min="1" placeholder="Quantity sold" value={sale.qty} onChange={e => setSale({ ...sale, qty: e.target.value })} required />
        <input type="number" placeholder="Selling price per item (KES)" value={sale.selling_price} onChange={e => setSale({ ...sale, selling_price: e.target.value })} required />
        <button className="btn">Record sale &amp; deduct stock</button></form>
        <div className="box"><b>Recent sales · {salesTotal} total</b><table><tbody>{sales.map(s => (<tr key={s.id}>
          <td>{new Date(s.created_at).toLocaleDateString()}</td><td>{s.product_name} x{s.qty}</td>
          <td>{KES(s.qty * s.selling_price)}</td><td className="pos">+{KES(s.qty * (s.selling_price - s.buying_price))}</td></tr>))}</tbody></table>
          <div className="pagination-controls"><button className="btn alt" disabled={salesPage <= 1} onClick={() => setSalesPage(page => page - 1)}>Previous</button>
            <span>Page {salesPage}</span><button className="btn alt" disabled={salesPage * 15 >= salesTotal} onClick={() => setSalesPage(page => page + 1)}>Next</button></div></div></>}

      {tab === 'expenses' && <div className="admin-columns">
        <form className="form admin-form" onSubmit={createExpense}><span className="eyebrow">RUNNING THE SHOP</span><h2>Record an expense</h2>
          <label>Expense type<select value={expense.category} onChange={event => setExpense({ ...expense, category: event.target.value })}>
            {['Rent', 'Transport', 'Packaging', 'Ads', 'Utilities', 'Supplier', 'Other'].map(category => <option key={category}>{category}</option>)}
          </select></label>
          <label>What was it for?<input value={expense.description} onChange={event => setExpense({ ...expense, description: event.target.value })} maxLength="300" /></label>
          <label>Amount (KES)<input type="number" min="1" step="0.01" required value={expense.amount} onChange={event => setExpense({ ...expense, amount: event.target.value })} /></label>
          <button className="btn">Save expense</button></form>
        <div className="box table-box"><div className="box-heading"><div><span className="eyebrow">RECENT COSTS</span><h2>Expenses</h2></div>
          <b>{expenseTotal} entries</b></div>
          <table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead><tbody>
            {expenses.map(item => <tr key={item.id}><td>{new Date(item.created_at).toLocaleDateString()}</td><td>{item.category}</td><td>{item.description}</td><td>{KES(item.amount)}</td></tr>)}
            {!expenses.length && <tr><td colSpan="4">Record rent, transport, packaging or marketing costs here.</td></tr>}
          </tbody></table><div className="pagination-controls"><button className="btn alt" disabled={expensePage <= 1} onClick={() => setExpensePage(page => page - 1)}>Previous</button>
            <span>Page {expensePage}</span><button className="btn alt" disabled={expensePage * 50 >= expenseTotal} onClick={() => setExpensePage(page => page + 1)}>Next</button></div></div>
      </div>}

      {tab === 'customers' && <section className="box table-box"><div className="box-heading"><div><span className="eyebrow">PEOPLE WHO LOVE YOUR SHOP</span><h2>Customers</h2></div>
        <span className="results-count">{customers.length} customers</span></div>
        <label className="customer-search">Search customers<input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Name or phone number" /></label>
        <table><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total spent</th><th>Last order</th><th></th></tr></thead><tbody>
          {customers.filter(customer => `${customer.name} ${customer.phone}`.toLowerCase().includes(customerSearch.toLowerCase())).map(customer =>
            <tr key={customer.phone}><td>{customer.name}{customer.order_count > 1 && <span className="repeat-badge">Repeat</span>}</td>
              <td>{customer.phone}</td><td>{customer.order_count}</td><td>{KES(customer.total_spent)}</td>
              <td>{new Date(customer.last_order_at).toLocaleDateString()}</td>
              <td><a className="btn alt" href={`https://wa.me/${customer.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer">Message ↗</a></td></tr>)}
          {!customers.length && <tr><td colSpan="6">Customers appear here after they place an order.</td></tr>}
        </tbody></table></section>}

      {tab === 'reports' && <section className="box"><div className="box-heading"><div><span className="eyebrow">MAKE BETTER-INFORMED MOVES</span><h2>Reports</h2></div></div>
        <div className="report-tools"><label>Break down sales by<select value={reportGroup} onChange={event => setReportGroup(event.target.value)}>
          <option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="product">Product</option><option value="category">Category</option><option value="size">Size</option><option value="colour">Colour</option>
        </select></label><button className="btn alt" onClick={loadReport}>Refresh report</button>
          <a className="btn" href={['size', 'colour'].includes(reportGroup)
            ? `/api/reports?type=variants&variant=${reportGroup}&format=csv`
            : `/api/reports?group=${reportGroup}&format=csv`} download>Export CSV ↓</a>
          <a className="btn alt" href="/api/reports?type=variants&variant=size&format=csv" download>Sizes CSV ↓</a>
          <a className="btn alt" href="/api/reports?type=variants&variant=colour&format=csv" download>Colours CSV ↓</a>
          <a className="btn alt" href="/api/reports?type=inventory&format=csv" download>Inventory CSV ↓</a>
          <a className="btn alt" href="/api/reports?type=orders&format=csv" download>Orders CSV ↓</a>
          <a className="btn alt" href="/api/reports?type=expenses&format=csv" download>Expenses CSV ↓</a>
          <a className="btn alt" href="/api/reports?type=customers&format=csv" download>Customers CSV ↓</a>
          <a className="btn alt" href="/api/reports?type=peak-times&format=csv" download>Peak times CSV ↓</a></div>
        <div className="table-scroll"><table><thead><tr><th>{reportGroup}</th><th>Revenue</th>
          {['size', 'colour'].includes(reportGroup) ? <th>Units sold</th> : <><th>COGS</th><th>Profit</th><th>Margin</th><th>Units sold</th><th>Orders</th></>}</tr></thead>
          <tbody>{report.map(row => <tr key={row.label}><td>{row.label}</td><td>{KES(row.revenue)}</td>
            {['size', 'colour'].includes(reportGroup) ? <td>{row.units}</td> : <><td>{KES(row.cogs)}</td><td className="pos">{KES(row.profit)}</td>
              <td>{Number(row.margin).toFixed(1)}%</td><td>{row.units}</td><td>{row.orders}</td></>}</tr>)}
            {!report.length && <tr><td colSpan={['size', 'colour'].includes(reportGroup) ? 3 : 7}>Select a breakdown to view the report.</td></tr>}</tbody></table></div>
        <div className="peak-report"><div className="box-heading"><div><span className="eyebrow">WHEN CUSTOMERS ORDER</span><h3>Peak times · Africa/Nairobi</h3></div></div>
          <div className="table-scroll"><table className="peak-heatmap"><thead><tr><th>Day / hour</th>{Array.from({ length: 24 }, (_, hour) => <th key={hour}>{String(hour).padStart(2, '0')}</th>)}</tr></thead>
            <tbody>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => <tr key={day}><th>{day}</th>
              {Array.from({ length: 24 }, (_, hour) => {
                const value = peakTimes.find(row => row.weekday === day && row.hour === hour)?.orders || 0;
                const max = Math.max(1, ...peakTimes.map(row => row.orders));
                return <td key={hour} aria-label={`${day} at ${String(hour).padStart(2, '0')}:00: ${value} orders`}
                  title={`${day} ${String(hour).padStart(2, '0')}:00 · ${value} orders`}
                  style={{ backgroundColor: value ? `rgba(233,30,140,${0.08 + value / max * 0.72})` : '#fbf9f9' }}>{value || '·'}</td>;
              })}</tr>)}</tbody></table></div></div>
      </section>}

      {tab === 'insights' && <><div className="box"><div className="box-heading"><div><span className="eyebrow">PLANNING, NOT GUESSWORK</span><h2>Demand outlook</h2></div>
        <button className="btn alt" onClick={loadInsights}>Refresh forecast</button></div>
        <p className="insight-explanation">{insights.explanation || 'Estimates blend recent average sales, a smoothed trend, and observed sales pace. Use them as a guide, not a guarantee.'}</p>
        <div className="table-scroll"><table><thead><tr><th>Product</th><th>In stock</th><th>Actual / forecast</th><th>Next 7 days</th><th>Next 14 days</th><th>30-day estimate</th><th>Stock cover</th><th>Weekday pattern</th><th>Price hint</th><th>Suggested reorder</th><th>Confidence</th></tr></thead>
          <tbody>{insights.products.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.stock}</td>
            <td><div className="forecast-bars" role="img" aria-label={`${item.name}: recent daily units followed by forecast daily units`}>
              {[...(item.actual_last_7 || []), ...Array(7).fill(item.daily_demand)].map((value, index, values) => {
                const scale = Math.max(1, ...values);
                return <span key={index} className={index < 7 ? 'forecast-bar actual' : 'forecast-bar projected'}
                  style={{ height: `${Math.max(2, Number(value) / scale * 28)}px` }}
                  title={`${index < 7 ? `Actual day ${index + 1}` : `Forecast day ${index - 6}`}: ${value} units`} />;
              })}
            </div><small>7 actual · 7 projected</small></td><td>{item.forecast_7_days}</td><td>{item.forecast_14_days}</td>
            <td>{item.forecast_30_days}</td><td>{item.days_of_stock == null ? 'No recent demand' : `${item.days_of_stock} days`}</td>
            <td>{item.weekday_hint || 'No clear pattern yet'}</td><td>{item.price_hint}</td>
            <td className={item.suggested_reorder ? 'low' : ''}>{item.suggested_reorder}</td><td>{item.confidence}</td></tr>)}
            {!insights.products.length && <tr><td colSpan="11">Refresh the forecast to see estimates for your catalogue.</td></tr>}</tbody></table></div>
        <div className="box-heading dead-stock-heading"><div><span className="eyebrow">SLOW-MOVING INVENTORY</span><h3>Items with no sales in 30 days</h3></div>
          <b>{KES((insights.dead_stock || []).reduce((total, item) => total + Number(item.value_at_cost), 0))} at cost</b></div>
        <div className="table-scroll"><table><thead><tr><th>Product</th><th>Units in stock</th><th>Stock value at cost</th></tr></thead><tbody>
          {(insights.dead_stock || []).map(item => <tr key={item.id}><td>{item.name}</td><td>{item.stock}</td><td>{KES(item.value_at_cost)}</td></tr>)}
          {!(insights.dead_stock || []).length && <tr><td colSpan="3">No stock without recent sales.</td></tr>}
        </tbody></table></div>
      </div>
      <form className="form admin-form" onSubmit={createTrend}><span className="eyebrow">MANUAL TREND WATCH</span><h2>Trending keywords</h2>
        <p>Add styles you are watching. We will match them against product names and categories.</p>
        <label>Keyword<input required maxLength="80" value={trend.keyword} onChange={event => setTrend({ ...trend, keyword: event.target.value })} placeholder="e.g. linen, butter yellow" /></label>
        <label>Reference link<input type="url" value={trend.link_url} onChange={event => setTrend({ ...trend, link_url: event.target.value })} placeholder="https://..." /></label>
        <button className="btn">Add to trend watch</button>
        <div className="trending-list">{insights.trending.map(item => <div key={item.id}><b>{item.keyword}</b>
          <span>{item.matches.length} matching products</span>{item.link_url && <a href={item.link_url} target="_blank" rel="noreferrer">Reference ↗</a>}
          <button type="button" className="text-button" onClick={async () => {
            await fetch(`/api/trending-keywords?id=${item.id}`, { method: 'DELETE' }); setInsightsLoaded(false); loadInsights();
          }}>Remove</button></div>)}</div>
      </form></>}

      {tab === 'settings' && <form className="form admin-form settings-form" onSubmit={saveSettings}>
        <span className="eyebrow">MAKE IT YOURS</span><h2>Store settings</h2>
        <label>Store name<input name="store_name" defaultValue={settings.store_name || ''} required /></label>
        <label>Logo image URL<input name="logo_url" type="url" defaultValue={settings.logo_url || ''} placeholder="/chelsie-logo.jpeg or a public image URL" /></label>
        <label>Tagline<input name="tagline" defaultValue={settings.tagline || ''} /></label>
        <div className="form-row"><label>Primary pink<input name="theme_primary" type="color" defaultValue={settings.theme_primary || '#E91E8C'} /></label>
          <label>Deep rose accent<input name="theme_accent" type="color" defaultValue={settings.theme_accent || '#B0166B'} /></label>
          <label>Soft background<input name="theme_background" type="color" defaultValue={settings.theme_background || '#FFF0F6'} /></label></div>
        <label>Announcement bar<input name="announcement" defaultValue={settings.announcement || ''} maxLength="200" /></label>
        <div className="form-row"><label>WhatsApp number<input name="whatsapp_number" defaultValue={settings.whatsapp_number || ''} placeholder="2547..." /></label>
          <label>Currency code<input name="currency" defaultValue={settings.currency || 'KES'} maxLength="4" /></label></div>
        <div className="form-row"><label>Delivery fee<input name="delivery_fee" type="number" min="0" step="1" defaultValue={settings.delivery_fee || 0} /></label>
          <label>Free delivery above<input name="free_delivery_threshold" type="number" min="0" step="1" defaultValue={settings.free_delivery_threshold || ''} /></label>
          <label>Low-stock alert at<input name="low_stock_threshold" type="number" min="0" defaultValue={settings.low_stock_threshold ?? 3} /></label></div>
        <div className="form-row"><label>Default language<select name="default_language" defaultValue={settings.default_language || 'en'}><option value="en">English</option><option value="sw">Kiswahili</option></select></label>
          <label>Contact / delivery info<input name="contact_text" defaultValue={settings.contact_text || ''} /></label></div>
        <label>About the shop<textarea name="about_text" rows="2" defaultValue={settings.about_text || ''} /></label>
        <label>Footer information<textarea name="footer_text" rows="2" defaultValue={settings.footer_text || ''} /></label>
        <label>Social links (JSON)<textarea name="social_links" rows="3" defaultValue={JSON.stringify(settings.social_links || {}, null, 2)} /></label>
        <label>Hero banners (JSON)<textarea name="banners" rows="6" defaultValue={JSON.stringify(settings.banners || [], null, 2)} />
          <small>Each banner uses image_url, headline, subtext, button_text, and button_link.</small></label>
        <label>WhatsApp message template<textarea name="whatsapp_template" rows="5" defaultValue={settings.whatsapp_template || ''} />
          <small>Use {'{{order_number}}'}, {'{{customer_name}}'}, {'{{phone}}'}, {'{{items}}'}, {'{{subtotal}}'}, {'{{delivery_fee}}'}, {'{{total}}'}, {'{{delivery_area}}'}, {'{{notes}}'}.</small></label>
        <button className="btn">Save store settings <span>↗</span></button>
      </form>}

      {tab === 'add' && <form className="form admin-form" onSubmit={addProduct}>
        <span className="eyebrow">GROW YOUR COLLECTION</span><h2>Add a product</h2>
        <label>Product name<input name="name" placeholder="e.g. Sunday linen set" required maxLength="120" /></label>
        <label>Swahili name<input name="name_sw" placeholder="Jina la bidhaa kwa Kiswahili (optional)" maxLength="120" /></label>
        <div className="form-row"><label>Buying price<input name="buying_price" type="number" min="0" step="1" placeholder="KES" required /></label>
          <label>Selling price<input name="price" type="number" min="0" step="1" placeholder="KES" required /></label>
          <label>Compare-at price<input name="compare_at_price" type="number" min="0" step="1" placeholder="Optional sale price" /></label></div>
        <div className="form-row"><label>Opening stock<input name="stock" type="number" min="0" step="1" placeholder="Units" required /></label>
          <label>Category<select name="category" defaultValue={categories[0]?.name || 'Dresses'} required>
            {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
            {!categories.length && ['Dresses', 'Tops', 'Bottoms', 'Sets', 'Accessories'].map(category => <option key={category}>{category}</option>)}</select></label></div>
        <label>SKU<input name="sku" placeholder="Stock code (optional)" maxLength="60" /></label>
        <label>Available sizes<input name="sizes" placeholder="Comma separated, e.g. S, M, L, XL" /></label>
        <label>Available colours<input name="colours" placeholder="Comma separated, e.g. Black, Cream" /></label>
        <label>Description<textarea name="description" placeholder="A little about this piece..." rows="3" /></label>
        <label>Swahili description<textarea name="description_sw" placeholder="Maelezo ya bidhaa kwa Kiswahili" rows="3" /></label>
        <label>Product photos (up to 6)<input name="images" type="file" accept="image/*" multiple />
          <small>Photos are converted to WebP and compressed in your browser (1000px max, under 200 KB each) before upload.</small></label>
        <label className="checkbox-label"><input name="is_featured" type="checkbox" /> Feature this in Popular right now</label>
        <label className="checkbox-label"><input name="is_visible" type="checkbox" defaultChecked /> Show this product on the storefront</label>
        <button className="btn" disabled={busy}>{busy ? 'Compressing photos…' : 'Add to inventory'} <span>↗</span></button></form>}
      </div></div>
    </main>
  </>);
}
