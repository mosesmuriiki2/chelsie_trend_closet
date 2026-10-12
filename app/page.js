'use client';

import { useEffect, useMemo, useState } from 'react';

const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
const money = value => `KES ${Number(value || 0).toLocaleString()}`;
const categoryIcons = { All: '✦', Dresses: '◌', Tops: '⌁', Bottoms: '◒', Sets: '◇', Accessories: '✳' };

const slides = [
  { eyebrow: 'THE NEW SEASON', title: 'A little more\nmain character.', copy: 'Fresh finds for wherever the day takes you.', tone: 'rose', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=85' },
  { eyebrow: 'YOUR EVERYDAY EDIT', title: 'Wear what\nfeels like you.', copy: 'Easy pieces. Standout details. All yours.', tone: 'sand', image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1600&q=85' },
  { eyebrow: 'GOOD THINGS, JUST IN', title: 'New looks,\nnew energy.', copy: 'Meet the pieces you will reach for on repeat.', tone: 'lilac', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=85' },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState(['All']);
  const [cart, setCart] = useState([]);
  const [size, setSize] = useState({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/products?categories=1').then(response => response.json().then(data => {
        if (!response.ok) throw new Error(data.error || 'Could not load categories.');
        return data;
      })),
      fetch('/api/products?featured=1&sort=popular').then(response => response.json().then(data => {
        if (!response.ok) throw new Error(data.error || 'Could not load popular products.');
        return data;
      })),
    ]).then(([categoryData, featuredData]) => {
      if (!cancelled) {
        setCategoryOptions(['All', ...categoryData]);
        setFeatured(featuredData);
      }
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem('cart') || '[]')); } catch { setCart([]); }
  }, []);
  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    const timer = window.setInterval(() => setSlide(current => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sort });
        if (activeCategory !== 'All') params.set('category', activeCategory);
        if (query.trim()) params.set('q', query.trim());
        const response = await fetch(`/api/products?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'We could not load the collection.');
        setProducts(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'We could not load the collection.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeCategory, query, sort, refresh]);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const add = product => {
    const selectedSize = size[product.id] || product.sizes?.split(',')[0]?.trim() || '';
    setCart(current => {
      const match = current.find(item => item.id === product.id && item.size === selectedSize);
      return match
        ? current.map(item => item === match ? { ...item, qty: item.qty + 1 } : item)
        : [...current, { id: product.id, name: product.name, price: product.price, size: selectedSize, qty: 1 }];
    });
    setOpen(true);
  };
  const change = (index, amount) => setCart(current =>
    current.map((item, itemIndex) => itemIndex === index ? { ...item, qty: item.qty + amount } : item)
      .filter(item => item.qty > 0));
  const order = () => {
    if (!cart.length) return;
    if (!name.trim() || !address.trim()) return alert('Please enter your name and delivery location');
    if (!WA) return alert('WhatsApp ordering is temporarily unavailable. Please contact the shop directly.');
    const lines = cart.map(item => `• ${item.name}${item.size ? ` (${item.size})` : ''} x${item.qty} = ${money(item.price * item.qty)}`).join('\n');
    const message = `Hello Chelsie Trend Closet, I'd like to order:\n\n${lines}\n\nTotal: ${money(total)}\nName: ${name.trim()}\nDelivery: ${address.trim()}`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setCart([]);
    setOpen(false);
  };

  const productCard = product => (
    <article className="product-card" key={product.id}>
      <div className="product-image-wrap">
        {product.image_url
          ? <img className="product-image" src={product.image_url} alt={product.name} loading="lazy" />
          : <div className="product-image-placeholder"><span>CTC</span></div>}
        {product.is_featured && <span className="product-badge">Popular</span>}
        {product.stock <= 0 && <span className="product-badge sold-badge">Sold out</span>}
        {product.stock > 0 && product.stock <= 3 && <span className="stock-note">Only {product.stock} left</span>}
      </div>
      <div className="product-details">
        <div className="product-category">{product.category || 'The collection'}</div>
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <div className="product-buy-row">
          <strong>{money(product.price)}</strong>
          {product.stock > 0
            ? <button className="add-button" onClick={() => add(product)} aria-label={`Add ${product.name} to your bag`}>＋</button>
            : <span className="unavailable">Unavailable</span>}
        </div>
        {product.sizes && product.stock > 0 && (
          <label className="size-select-label">Size
            <select aria-label={`Size for ${product.name}`} value={size[product.id] || product.sizes.split(',')[0].trim()}
              onChange={event => setSize(current => ({ ...current, [product.id]: event.target.value }))}>
              {product.sizes.split(',').map(value => <option key={value.trim()}>{value.trim()}</option>)}
            </select>
          </label>
        )}
      </div>
    </article>
  );

  return (
    <main className="shop">
      <div className="announcement"><span>GOOD STYLE, DELIVERED</span><span>ORDER YOUR FAVOURITES ON WHATSAPP&nbsp; ↗</span></div>
      <header className="shop-header">
        <a className="brand" href="/" aria-label="Chelsie Trend Closet home">
          <span className="brand-mark">C</span>
          <span className="brand-name">chelsie <b>trend closet</b><small>YOUR STYLE, YOUR STORY</small></span>
        </a>
        <nav className="shop-nav" aria-label="Main navigation">
          <a href="#collection">Shop all</a><a href="#popular">Popular</a><a href="#collection">Collections</a>
        </nav>
        <button className="bag-button" onClick={() => setOpen(true)} aria-label={`Open shopping bag with ${cartCount} items`}>
          <span>My bag</span><span className="bag-count">{cartCount}</span>
        </button>
      </header>

      <section className={`hero hero-${slides[slide].tone}`} aria-label="Featured collection">
        <img className="hero-image" src={slides[slide].image} alt="" />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="eyebrow">{slides[slide].eyebrow}</span>
          <h1>{slides[slide].title.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1>
          <p>{slides[slide].copy}</p>
          <a className="hero-link" href="#collection">Find your next favourite <span>↗</span></a>
        </div>
        <div className="hero-controls" aria-label="Carousel controls">
          <button onClick={() => setSlide(current => (current + slides.length - 1) % slides.length)} aria-label="Previous slide">←</button>
          <span>0{slide + 1}<i />0{slides.length}</span>
          <button onClick={() => setSlide(current => (current + 1) % slides.length)} aria-label="Next slide">→</button>
        </div>
        <span className="hero-side-note">NAIROBI · KENYA</span>
      </section>

      <div className="promise-strip">
        <span>✳&nbsp; Curated with love</span><span>✦&nbsp; Easy WhatsApp ordering</span><span>◌&nbsp; New finds, often</span>
      </div>

      {featured.length > 0 && <section className="featured-section" id="popular">
        <div className="section-heading">
          <div><span className="eyebrow">THE CROWD FAVOURITES</span><h2>Popular right now<span className="heading-dot">.</span></h2></div>
          <a href="#collection">Shop the edit <span>↗</span></a>
        </div>
        <div className="featured-track">{featured.map(productCard)}</div>
      </section>}

      <section className="collection-section" id="collection">
        <div className="section-heading collection-heading">
          <div><span className="eyebrow">A GOOD PLACE TO START</span><h2>Find your thing<span className="heading-dot">.</span></h2></div>
          <span className="results-count">{products.length} {products.length === 1 ? 'piece' : 'pieces'}</span>
        </div>
        <div className="category-row" aria-label="Filter by category">
          {categoryOptions.map(category => <button key={category} className={`category-chip${activeCategory === category ? ' active' : ''}`}
            onClick={() => setActiveCategory(category)}><span>{categoryIcons[category] || '✧'}</span>{category}</button>)}
        </div>
        <div className="catalog-tools">
          <label className="search-field"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search the collection..." value={query} onChange={event => setQuery(event.target.value)} aria-label="Search products" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label>
          <label className="sort-field">Sort by
            <select value={sort} onChange={event => setSort(event.target.value)}>
              <option value="newest">Just in</option><option value="popular">Popular</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option>
            </select>
          </label>
        </div>
        {error && <div className="shop-message" role="alert">{error} <button onClick={() => setRefresh(current => current + 1)}>Try again</button></div>}
        {loading
          ? <div className="product-grid">{[1, 2, 3, 4].map(item => <div className="product-skeleton" key={item} />)}</div>
          : products.length
            ? <div className="product-grid">{products.map(productCard)}</div>
            : <div className="empty-collection"><span>✳</span><h3>{error ? 'The rack is taking a breather.' : 'Nothing on this rack just yet.'}</h3><p>{error ? 'Please try again in a moment.' : 'Try another category or clear your search to see all the good stuff.'}</p>
              <button className="text-button" onClick={() => { setQuery(''); setActiveCategory('All'); setRefresh(current => current + 1); }}>Show me everything ↗</button></div>}
      </section>

      <footer className="shop-footer"><a className="brand footer-brand" href="#"><span className="brand-mark">C</span><span className="brand-name">chelsie <b>trend closet</b><small>YOUR STYLE, YOUR STORY</small></span></a>
        <span>Made for your next favourite outfit. <b>♡</b></span><a href="/admin">Staff sign in ↗</a></footer>

      {open && <div className="cart-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <aside className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <div className="cart-heading"><div><span className="eyebrow">YOUR GOOD FINDS</span><h2 id="cart-title">Your bag <span>({cartCount})</span></h2></div>
            <button className="cart-close" onClick={() => setOpen(false)} aria-label="Close shopping bag">×</button></div>
          {!cart.length ? <div className="cart-empty"><span>♡</span><h3>Your bag is waiting.</h3><p>When something catches your eye, it will be right here.</p><button className="text-button" onClick={() => setOpen(false)}>Keep browsing ↗</button></div>
            : <>
              <div className="cart-items">{cart.map((item, index) => <div className="cart-item" key={`${item.id}-${item.size}`}>
                <div className="cart-item-art"><span>CTC</span></div><div className="cart-item-info"><h3>{item.name}</h3><p>{item.size ? `Size ${item.size} · ` : ''}{money(item.price)}</p>
                  <div className="quantity-control"><button onClick={() => change(index, -1)} aria-label={`Remove one ${item.name}`}>−</button><span>{item.qty}</span><button onClick={() => change(index, 1)} aria-label={`Add one ${item.name}`}>＋</button></div></div><strong>{money(item.price * item.qty)}</strong>
              </div>)}</div>
              <div className="cart-checkout"><div className="cart-total"><span>Subtotal</span><strong>{money(total)}</strong></div><small>Delivery details are confirmed with you on WhatsApp.</small>
                <input placeholder="Your name" value={name} onChange={event => setName(event.target.value)} aria-label="Your name" />
                <input placeholder="Delivery location" value={address} onChange={event => setAddress(event.target.value)} aria-label="Delivery location" />
                <button className="checkout-button" onClick={order}>Checkout on WhatsApp <span>↗</span></button></div>
            </>}
        </aside>
      </div>}
    </main>
  );
}
