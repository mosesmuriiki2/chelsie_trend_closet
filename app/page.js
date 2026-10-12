'use client';
import { useEffect, useState } from 'react';
const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

export default function Home() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [size, setSize] = useState({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => Array.isArray(d) && setProducts(d));
    try { setCart(JSON.parse(localStorage.getItem('cart') || '[]')); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);

  const add = (p) => {
    const sz = size[p.id] || (p.sizes ? p.sizes.split(',')[0].trim() : '');
    setCart(c => {
      const hit = c.find(i => i.id === p.id && i.size === sz);
      return hit ? c.map(i => i === hit ? { ...i, qty: i.qty + 1 } : i)
                 : [...c, { id: p.id, name: p.name, price: p.price, size: sz, qty: 1 }];
    });
    setOpen(true);
  };
  const change = (i, d) => setCart(c => c.map((x, n) => n === i ? { ...x, qty: x.qty + d } : x).filter(x => x.qty > 0));
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const order = () => {
    if (!name || !address) return alert('Please enter your name and delivery location');
    const lines = cart.map(i => `• ${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty} = KES ${i.price * i.qty}`).join('\n');
    const msg = `Hello Chelsie Trend Closet, I'd like to order:\n\n${lines}\n\nTotal: KES ${total}\nName: ${name}\nDelivery: ${address}`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, '_blank');
    setCart([]); setOpen(false);
  };

  return (<>
    <header><h1>Chelsie Trend Closet</h1>
      <button className="btn" onClick={() => setOpen(true)}>Cart ({cart.reduce((s, i) => s + i.qty, 0)})</button></header>
    <div className="grid">
      {products.map(p => (
        <div className="card" key={p.id}>
          {p.image_url && <img src={p.image_url} alt={p.name} />}
          <div><b>{p.name}</b><span>{p.description}</span><span className="price">KES {p.price}</span>
            {p.sizes && <select onChange={e => setSize({ ...size, [p.id]: e.target.value })}>
              {p.sizes.split(',').map(s => <option key={s}>{s.trim()}</option>)}</select>}
            {p.stock > 0 ? <button className="btn" onClick={() => add(p)}>Add to cart</button> : <span className="out">Sold out</span>}</div>
        </div>))}
      {!products.length && <p>No products yet. Check back soon!</p>}
    </div>
    {open && <div className="panel">
      <button className="btn alt" onClick={() => setOpen(false)}>Close</button>
      <h2>Your cart</h2>
      {!cart.length && <p>Your cart is empty.</p>}
      {cart.map((i, n) => (<div className="row" key={n}>
        <span>{i.name} {i.size && `(${i.size})`}<br />KES {i.price * i.qty}</span>
        <span><button className="btn alt" onClick={() => change(n, -1)}>-</button> {i.qty} <button className="btn alt" onClick={() => change(n, 1)}>+</button></span></div>))}
      {!!cart.length && <>
        <b>Total: KES {total}</b>
        <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Delivery location" value={address} onChange={e => setAddress(e.target.value)} />
        <button className="btn wa" onClick={order}>Place order on WhatsApp</button></>}
    </div>}
  </>);
}
