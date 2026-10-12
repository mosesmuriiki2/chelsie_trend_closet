'use client';
import { useState, useMemo } from 'react';
const KES = n => 'KES ' + Math.round(n || 0).toLocaleString();

export default function Admin() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState('dash');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [msg, setMsg] = useState('');
  const [sale, setSale] = useState({ product_id: '', qty: 1, selling_price: '' });
  const H = { 'x-admin-password': pw };

  const load = async () => {
    const [a, b] = await Promise.all([fetch('/api/products', { headers: H }), fetch('/api/sales', { headers: H })]);
    const productsData = await a.json();
    const salesData = await b.json();
    if (!a.ok || !b.ok) {
      setMsg(productsData.error || salesData.error || 'Could not load dashboard data.');
      return false;
    }
    setProducts(productsData); setSales(salesData); return true;
  };
  const login = async e => {
    e.preventDefault();
    try { if (await load()) setAuthed(true); }
    catch { setMsg('Unable to reach the server. Please try again.'); }
  };
  const call = async (url, opts) => {
    try {
      const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
      const d = await r.json();
      setMsg(r.ok ? 'Saved ✓' : d.error || 'Could not save changes.');
      if (r.ok) await load();
      return r.ok;
    } catch {
      setMsg('Unable to reach the server. Please try again.');
      return false;
    }
  };

  const addProduct = async e => {
    e.preventDefault(); const f = e.target;
    if (await call('/api/products', { method: 'POST', body: new FormData(f) })) f.reset();
  };
  const recordSale = async e => {
    e.preventDefault();
    if (await call('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sale) }))
      setSale({ product_id: '', qty: 1, selling_price: '' });
  };
  const restock = p => {
    const n = prompt(`Add how many units to "${p.name}"?`); if (!n) return;
    const bp = prompt('New buying price per unit (leave blank to keep ' + p.buying_price + ')');
    call('/api/products/' + p.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addStock: n, ...(bp ? { buying_price: bp } : {}) }) });
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
  const del = p => confirm('Delete ' + p.name + '?') && call('/api/products/' + p.id, { method: 'DELETE' });

  const st = useMemo(() => {
    const revenue = sales.reduce((s, x) => s + x.qty * x.selling_price, 0);
    const cost = sales.reduce((s, x) => s + x.qty * x.buying_price, 0);
    const profit = revenue - cost;
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return { k: d.toISOString().slice(0, 10), rev: 0, profit: 0 }; });
    const top = {};
    sales.forEach(x => {
      const k = x.created_at.slice(0, 10), d = days.find(d => d.k === k);
      const r = x.qty * x.selling_price, pr = r - x.qty * x.buying_price;
      if (d) { d.rev += r; d.profit += pr; }
      top[x.product_name] = top[x.product_name] || { n: x.product_name, qty: 0, profit: 0 };
      top[x.product_name].qty += x.qty; top[x.product_name].profit += pr;
    });
    return {
      revenue, cost, profit, margin: revenue ? profit / revenue * 100 : 0,
      items: sales.reduce((s, x) => s + x.qty, 0),
      stockCost: products.reduce((s, p) => s + (p.stock || 0) * (p.buying_price || 0), 0),
      stockRetail: products.reduce((s, p) => s + (p.stock || 0) * p.price, 0),
      low: products.filter(p => (p.stock || 0) <= 3), days,
      top: Object.values(top).sort((a, b) => b.profit - a.profit).slice(0, 5),
      max: Math.max(1, ...days.map(d => d.rev)),
    };
  }, [sales, products]);

  if (!authed) return (<main className="admin-login-shell"><a className="brand" href="/"><span className="brand-mark">C</span>
    <span className="brand-name">chelsie <b>trend closet</b><small>YOUR STYLE, YOUR STORY</small></span></a>
    <form className="form login-form" onSubmit={login}><span className="eyebrow">THE BACK OFFICE</span>
      <h1>Welcome back.</h1><p>Sign in to manage your shop and keep things running smoothly.</p>
      <label htmlFor="admin-password">Admin password</label>
      <input id="admin-password" type="password" placeholder="Enter your password" value={pw} onChange={e => setPw(e.target.value)} required />
      <button className="btn">Sign in to dashboard <span>↗</span></button><small role="status">{msg}</small></form>
    <a className="login-back" href="/">← Back to the shop</a></main>);

  return (<>
    <header className="admin-header"><a className="brand" href="/"><span className="brand-mark">C</span>
      <span className="brand-name">chelsie <b>trend closet</b><small>STUDIO · ADMIN</small></span></a>
      <div className="admin-user"><span className="admin-avatar">C</span><span>Shop manager<small>Store admin</small></span></div>
      <a className="admin-shop-link" href="/">View storefront <span>↗</span></a></header>
    <main className="wrap admin-wrap">
      <div className="admin-welcome"><div><span className="eyebrow">YOUR SHOP, AT A GLANCE</span><h1>Good to see you.</h1>
        <p>Here’s how things are looking at Chelsie Trend Closet.</p></div><span className="today-label">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
      <div className="tabs admin-tabs">
        {[['dash', 'Dashboard'], ['inv', 'Inventory'], ['sale', 'Record sale'], ['add', 'Add product']].map(([k, l]) =>
          <button key={k} className={'admin-tab ' + (tab === k ? 'selected' : '')} onClick={() => { setTab(k); setMsg(''); }}>{l}</button>)}
      </div>
      {msg && <p className={`admin-message${msg.startsWith('Saved') ? ' success' : ''}`} role="status">{msg}</p>}

      {tab === 'dash' && <>
        <div className="kpis">
          <div className="kpi"><small>Sales revenue</small><b>{KES(st.revenue)}</b><span>All recorded sales</span></div>
          <div className="kpi"><small>Cost of goods sold</small><b>{KES(st.cost)}</b><span>Sales at buying price</span></div>
          <div className="kpi"><small>Net profit</small><b className={st.profit >= 0 ? 'pos' : 'neg'}>{KES(st.profit)}</b><span>Revenue less product cost</span></div>
          <div className="kpi"><small>Profit margin</small><b>{st.margin.toFixed(1)}%</b><span>Across recorded sales</span></div>
          <div className="kpi"><small>Items sold</small><b>{st.items}</b><span>Units checked out</span></div>
          <div className="kpi"><small>Stock at cost</small><b>{KES(st.stockCost)}</b><span>Current inventory value</span></div>
          <div className="kpi"><small>Stock at retail</small><b>{KES(st.stockRetail)}</b><span>Potential sales value</span></div>
          <div className="kpi"><small>Needs attention</small><b className={st.low.length ? 'low' : ''}>{st.low.length}</b><span>Low or out of stock</span></div>
        </div>
        <div className="box"><div className="box-heading"><div><span className="eyebrow">SALES OVER TIME</span><h2>Last 14 days</h2></div>
          <small><span className="legend-revenue" /> Revenue <span className="legend-profit" /> Profit</small></div>
          <div className="chart">{st.days.map(d => (
            <div className="col" key={d.k} title={`${d.k}: revenue ${KES(d.rev)}, profit ${KES(d.profit)}`}>
              <div className="bar" style={{ height: d.rev / st.max * 100 + '%' }}>
                <div className="pbar" style={{ height: d.rev ? Math.max(d.profit, 0) / d.rev * 100 + '%' : 0 }} /></div>
              <small>{d.k.slice(8)}</small></div>))}</div></div>
        <div className="box"><div className="box-heading"><div><span className="eyebrow">BEST PERFORMERS</span><h2>Top products by profit</h2></div></div>
          <table><tbody>{st.top.map(t => <tr key={t.n}><td>{t.n}</td><td>{t.qty} sold</td><td className="pos">{KES(t.profit)}</td></tr>)}
            {!st.top.length && <tr><td>No sales recorded yet</td></tr>}</tbody></table></div>
        {!!st.low.length && <div className="box"><div className="box-heading"><div><span className="eyebrow">STOCK ALERT</span><h2 className="low">Restock soon</h2></div></div>
          <table><tbody>{st.low.map(p => <tr key={p.id}><td>{p.name}</td><td className="low">{p.stock || 0} left</td></tr>)}</tbody></table></div>}
      </>}

      {tab === 'inv' && <div className="box table-box" style={{ overflowX: 'auto' }}><div className="box-heading"><div><span className="eyebrow">YOUR CATALOGUE</span><h2>Inventory</h2></div><span className="results-count">{products.length} products</span></div><table>
        <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Buy</th><th>Sell</th><th>Margin</th><th>Popular</th><th></th></tr></thead>
        <tbody>{products.map(p => (<tr key={p.id}>
          <td><div className="inventory-product">{p.image_url ? <img src={p.image_url} alt="" /> : <span className="inventory-placeholder">C</span>}<b>{p.name}</b></div></td>
          <td>{p.category || 'Uncategorized'}</td><td className={(p.stock || 0) <= 3 ? 'low' : ''}>{p.stock || 0}</td>
          <td>{KES(p.buying_price)}</td><td>{KES(p.price)}</td>
          <td>{p.price ? ((p.price - p.buying_price) / p.price * 100).toFixed(0) : 0}%</td>
          <td><button className={`feature-toggle${p.is_featured ? ' featured' : ''}`} onClick={() => toggleFeatured(p)} aria-label={`${p.is_featured ? 'Remove' : 'Mark'} ${p.name} ${p.is_featured ? 'from' : 'as'} popular`}>{p.is_featured ? '★ Popular' : '☆ Feature'}</button></td>
          <td style={{ whiteSpace: 'nowrap' }}>
            <button className="btn alt" onClick={() => restock(p)}>+ Stock</button>{' '}
            <button className="btn alt" onClick={() => editCategory(p)}>Category</button>{' '}
            <button className="btn alt" onClick={() => editPrice(p)}>Price</button>{' '}
            <button className="btn alt" onClick={() => del(p)}>Delete</button></td></tr>))}</tbody></table></div>}

      {tab === 'sale' && <><form className="form admin-form" onSubmit={recordSale}><span className="eyebrow">CHECKOUT</span><h2>Record a sale</h2>
        <select required value={sale.product_id} onChange={e => { const p = products.find(x => x.id === e.target.value); setSale({ ...sale, product_id: e.target.value, selling_price: p ? p.price : '' }); }}>
          <option value="">Select product</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock || 0} in stock)</option>)}</select>
        <input type="number" min="1" placeholder="Quantity sold" value={sale.qty} onChange={e => setSale({ ...sale, qty: e.target.value })} required />
        <input type="number" placeholder="Selling price per item (KES)" value={sale.selling_price} onChange={e => setSale({ ...sale, selling_price: e.target.value })} required />
        <button className="btn">Record sale &amp; deduct stock</button></form>
        <div className="box"><b>Recent sales</b><table><tbody>{sales.slice(0, 15).map(s => (<tr key={s.id}>
          <td>{new Date(s.created_at).toLocaleDateString()}</td><td>{s.product_name} x{s.qty}</td>
          <td>{KES(s.qty * s.selling_price)}</td><td className="pos">+{KES(s.qty * (s.selling_price - s.buying_price))}</td></tr>))}</tbody></table></div></>}

      {tab === 'add' && <form className="form admin-form" onSubmit={addProduct}>
        <span className="eyebrow">GROW YOUR COLLECTION</span><h2>Add a product</h2>
        <label>Product name<input name="name" placeholder="e.g. Sunday linen set" required maxLength="120" /></label>
        <div className="form-row"><label>Buying price<input name="buying_price" type="number" min="0" step="1" placeholder="KES" required /></label>
          <label>Selling price<input name="price" type="number" min="0" step="1" placeholder="KES" required /></label></div>
        <div className="form-row"><label>Opening stock<input name="stock" type="number" min="0" step="1" placeholder="Units" required /></label>
          <label>Category<input name="category" list="product-categories" placeholder="Choose or type a category" defaultValue="Dresses" required />
            <datalist id="product-categories"><option value="Dresses" /><option value="Tops" /><option value="Bottoms" /><option value="Sets" /><option value="Accessories" /><option value="Shoes" /><option value="Bags" /></datalist></label></div>
        <label>Available sizes<input name="sizes" placeholder="Comma separated, e.g. S, M, L, XL" /></label>
        <label>Description<textarea name="description" placeholder="A little about this piece..." rows="3" /></label>
        <label>Product photo<input name="image" type="file" accept="image/*" /></label>
        <label className="checkbox-label"><input name="is_featured" type="checkbox" /> Feature this in Popular right now</label>
        <button className="btn">Add to inventory <span>↗</span></button></form>}
    </main>
  </>);
}
