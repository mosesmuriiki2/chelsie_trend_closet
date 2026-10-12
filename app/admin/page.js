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
    if (!b.ok) return false;
    setProducts(await a.json()); setSales(await b.json()); return true;
  };
  const login = async e => { e.preventDefault(); (await load()) ? setAuthed(true) : setMsg('Wrong password'); };
  const call = async (url, opts) => {
    const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
    const d = await r.json(); setMsg(r.ok ? 'Saved ✓' : d.error); if (r.ok) await load(); return r.ok;
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

  if (!authed) return (<form className="form" onSubmit={login}>
    <h1>Admin login</h1>
    <input type="password" placeholder="Admin password" value={pw} onChange={e => setPw(e.target.value)} required />
    <button className="btn">Login</button><small>{msg}</small></form>);

  return (<>
    <header><h1>Admin – Chelsie Trend Closet</h1><a href="/">View shop</a></header>
    <div className="wrap">
      <div className="tabs">
        {[['dash', 'Dashboard'], ['inv', 'Inventory'], ['sale', 'Record sale'], ['add', 'Add product']].map(([k, l]) =>
          <button key={k} className={'btn ' + (tab === k ? '' : 'alt')} onClick={() => { setTab(k); setMsg(''); }}>{l}</button>)}
      </div>
      {msg && <p><b>{msg}</b></p>}

      {tab === 'dash' && <>
        <div className="kpis">
          <div className="kpi"><small>Revenue</small><b>{KES(st.revenue)}</b></div>
          <div className="kpi"><small>Cost of goods sold</small><b>{KES(st.cost)}</b></div>
          <div className="kpi"><small>Profit</small><b className={st.profit >= 0 ? 'pos' : 'neg'}>{KES(st.profit)}</b></div>
          <div className="kpi"><small>Profit margin</small><b>{st.margin.toFixed(1)}%</b></div>
          <div className="kpi"><small>Items sold</small><b>{st.items}</b></div>
          <div className="kpi"><small>Stock value (cost)</small><b>{KES(st.stockCost)}</b></div>
          <div className="kpi"><small>Stock value (retail)</small><b>{KES(st.stockRetail)}</b></div>
          <div className="kpi"><small>Low / out of stock</small><b className={st.low.length ? 'low' : ''}>{st.low.length}</b></div>
        </div>
        <div className="box"><b>Last 14 days</b> <small>(light = revenue, dark = profit)</small>
          <div className="chart">{st.days.map(d => (
            <div className="col" key={d.k} title={`${d.k}: revenue ${KES(d.rev)}, profit ${KES(d.profit)}`}>
              <div className="bar" style={{ height: d.rev / st.max * 100 + '%' }}>
                <div className="pbar" style={{ height: d.rev ? Math.max(d.profit, 0) / d.rev * 100 + '%' : 0 }} /></div>
              <small>{d.k.slice(8)}</small></div>))}</div></div>
        <div className="box"><b>Top products by profit</b>
          <table><tbody>{st.top.map(t => <tr key={t.n}><td>{t.n}</td><td>{t.qty} sold</td><td className="pos">{KES(t.profit)}</td></tr>)}
            {!st.top.length && <tr><td>No sales recorded yet</td></tr>}</tbody></table></div>
        {!!st.low.length && <div className="box"><b className="low">Restock soon</b>
          <table><tbody>{st.low.map(p => <tr key={p.id}><td>{p.name}</td><td className="low">{p.stock || 0} left</td></tr>)}</tbody></table></div>}
      </>}

      {tab === 'inv' && <div className="box" style={{ overflowX: 'auto' }}><table>
        <thead><tr><th>Product</th><th>Stock</th><th>Buy</th><th>Sell</th><th>Margin</th><th></th></tr></thead>
        <tbody>{products.map(p => (<tr key={p.id}>
          <td>{p.name}</td><td className={(p.stock || 0) <= 3 ? 'low' : ''}>{p.stock || 0}</td>
          <td>{KES(p.buying_price)}</td><td>{KES(p.price)}</td>
          <td>{p.price ? ((p.price - p.buying_price) / p.price * 100).toFixed(0) : 0}%</td>
          <td style={{ whiteSpace: 'nowrap' }}>
            <button className="btn alt" onClick={() => restock(p)}>+ Stock</button>{' '}
            <button className="btn alt" onClick={() => editPrice(p)}>Price</button>{' '}
            <button className="btn alt" onClick={() => del(p)}>Delete</button></td></tr>))}</tbody></table></div>}

      {tab === 'sale' && <><form className="form" onSubmit={recordSale}>
        <select required value={sale.product_id} onChange={e => { const p = products.find(x => x.id === e.target.value); setSale({ ...sale, product_id: e.target.value, selling_price: p ? p.price : '' }); }}>
          <option value="">Select product</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock || 0} in stock)</option>)}</select>
        <input type="number" min="1" placeholder="Quantity sold" value={sale.qty} onChange={e => setSale({ ...sale, qty: e.target.value })} required />
        <input type="number" placeholder="Selling price per item (KES)" value={sale.selling_price} onChange={e => setSale({ ...sale, selling_price: e.target.value })} required />
        <button className="btn">Record sale &amp; deduct stock</button></form>
        <div className="box"><b>Recent sales</b><table><tbody>{sales.slice(0, 15).map(s => (<tr key={s.id}>
          <td>{new Date(s.created_at).toLocaleDateString()}</td><td>{s.product_name} x{s.qty}</td>
          <td>{KES(s.qty * s.selling_price)}</td><td className="pos">+{KES(s.qty * (s.selling_price - s.buying_price))}</td></tr>))}</tbody></table></div></>}

      {tab === 'add' && <form className="form" onSubmit={addProduct}>
        <input name="name" placeholder="Product name" required />
        <input name="buying_price" type="number" placeholder="Buying price (KES)" required />
        <input name="price" type="number" placeholder="Selling price (KES)" required />
        <input name="stock" type="number" placeholder="Opening stock quantity" required />
        <input name="sizes" placeholder="Sizes, comma separated (S,M,L,XL)" />
        <textarea name="description" placeholder="Description" />
        <input name="image" type="file" accept="image/*" />
        <button className="btn">Add product</button></form>}
    </div>
  </>);
}
