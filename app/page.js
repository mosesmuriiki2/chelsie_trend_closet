'use client';

import { useEffect, useMemo, useState } from 'react';
import { translate } from '@/lib/i18n';

const money = (value, currency = 'KES') => `${currency} ${Number(value || 0).toLocaleString()}`;
const categoryIcons = { All: '✦', Dresses: '◌', Tops: '⌁', Bottoms: '◒', Sets: '◇', Accessories: '✳' };

const slides = [
  { eyebrow: 'THE NEW SEASON', title: 'A little more\nmain character.', copy: 'Fresh finds for wherever the day takes you.', tone: 'rose', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=85' },
  { eyebrow: 'YOUR EVERYDAY EDIT', title: 'Wear what\nfeels like you.', copy: 'Easy pieces. Standout details. All yours.', tone: 'sand', image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1600&q=85' },
  { eyebrow: 'GOOD THINGS, JUST IN', title: 'New looks,\nnew energy.', copy: 'Meet the pieces you will reach for on repeat.', tone: 'lilac', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=85' },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [featured, setFeatured] = useState([]);
  const [saleProducts, setSaleProducts] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState(['All']);
  const [categoryTiles, setCategoryTiles] = useState([]);
  const [settings, setSettings] = useState({});
  const [cart, setCart] = useState([]);
  const [size, setSize] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [detailSize, setDetailSize] = useState('');
  const [detailColour, setDetailColour] = useState('');
  const [detailQty, setDetailQty] = useState(1);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [street, setStreet] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('delivery');
  const [paymentMethod, setPaymentMethod] = useState('mpesa_on_delivery');
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [sizeFilter, setSizeFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [language, setLanguage] = useState('en');
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [cartReady, setCartReady] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  const t = key => translate(language, key);
  const currency = settings.currency || 'KES';
  const waNumber = settings.whatsapp_number || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const activeSlides = useMemo(() => {
    const configured = Array.isArray(settings.banners) ? settings.banners.filter(banner => banner.image_url || banner.image) : [];
    return configured.length
      ? configured.map(banner => ({
        eyebrow: banner.eyebrow || settings.store_name || 'CHELSIE TREND CLOSET',
        title: banner.headline || banner.title || '',
        copy: banner.subtext || banner.copy || '',
        image: banner.image_url || banner.image,
        link: banner.button_link || banner.link || '#collection',
        button: banner.button_text || t('shopCollection'),
      }))
      : slides.map(banner => ({ ...banner, link: '#collection', button: t('shopCollection') }));
  }, [settings.banners, settings.store_name, language]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/products?categories=1').then(response => response.json().then(data => {
        if (!response.ok) throw new Error(data.error || 'Could not load categories.');
        return data;
      })),
      fetch('/api/products?featured=1&sort=popular&limit=8').then(response => response.json().then(data => {
        if (!response.ok) throw new Error(data.error || 'Could not load popular products.');
        return data;
      })),
      fetch('/api/products?sale=1&limit=8').then(response => response.json().then(data => {
        if (!response.ok) throw new Error(data.error || 'Could not load sale products.');
        return data;
      })),
    ]).then(([categoryData, featuredData, saleData]) => {
      if (!cancelled) {
        const normalizedCategories = categoryData.map(category => typeof category === 'string'
          ? { name: category, image_url: null }
          : category);
        setCategoryOptions(['All', ...normalizedCategories.map(category => category.name)]);
        setCategoryTiles(normalizedCategories);
        setFeatured(featuredData.products || []);
        setSaleProducts((saleData.products || []).filter(product => Number(product.compare_at_price) > Number(product.price)));
      }
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem('cart') || '[]'));
      const savedLanguage = localStorage.getItem('language');
      if (savedLanguage === 'en' || savedLanguage === 'sw') {
        setLanguage(savedLanguage);
        setLanguageReady(true);
      }
    } catch { setCart([]); }
    setCartReady(true);
  }, []);
  useEffect(() => { if (cartReady) localStorage.setItem('cart', JSON.stringify(cart)); }, [cart, cartReady]);
  useEffect(() => { if (languageReady) localStorage.setItem('language', language); }, [language, languageReady]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings').then(response => response.json().then(data => {
      if (!response.ok) throw new Error(data.error || 'Could not load store settings.');
      return data;
    })).then(data => {
      if (!cancelled) {
        setSettings(data);
        if (localStorage.getItem('language') == null && ['en', 'sw'].includes(data.default_language)) setLanguage(data.default_language);
        setLanguageReady(true);
      }
    }).catch(err => { if (!cancelled) { setError(err.message); setLanguageReady(true); } });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setSlide(current => (current + 1) % activeSlides.length), 6000);
    return () => window.clearInterval(timer);
  }, [activeSlides.length]);
  useEffect(() => { setPage(1); }, [activeCategory, query, sort, sizeFilter, minPrice, maxPrice]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sort, limit: '24', page: String(page) });
        if (activeCategory !== 'All') params.set('category', activeCategory);
        if (query.trim()) params.set('q', query.trim());
        if (sizeFilter) params.set('size', sizeFilter);
        if (minPrice && Number.isFinite(Number(minPrice))) params.set('minPrice', minPrice);
        if (maxPrice && Number.isFinite(Number(maxPrice))) params.set('maxPrice', maxPrice);
        const response = await fetch(`/api/products?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'We could not load the collection.');
        const nextProducts = Array.isArray(data.products) ? data.products : [];
        setProducts(current => page === 1 ? nextProducts : [...current, ...nextProducts]);
        setTotalProducts(Number(data.total || 0));
        setError('');
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'We could not load the collection.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeCategory, query, sort, sizeFilter, minPrice, maxPrice, refresh, page]);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryFee = deliveryMethod === 'pickup' ||
    (settings.free_delivery_threshold != null && subtotal >= Number(settings.free_delivery_threshold))
    ? 0 : Number(settings.delivery_fee || 0);
  const total = subtotal + deliveryFee;

  const add = (product, quantity = 1, chosenSize, chosenColour) => {
    const selectedSize = chosenSize || size[product.id] || product.sizes?.split(',')[0]?.trim() || '';
    const selectedColour = chosenColour || '';
    setCart(current => {
      const match = current.find(item => item.id === product.id && item.size === selectedSize && item.colour === selectedColour);
      return match
        ? current.map(item => item === match ? { ...item, qty: item.qty + quantity } : item)
        : [...current, {
          id: product.id, name: product.name, price: Number(product.price), size: selectedSize,
          colour: selectedColour, image_url: product.images?.[0] || product.image_url || '', qty: quantity,
        }];
    });
    setOpen(true);
    setSelectedProduct(null);
    setToast(`${product.name} added to your bag`);
    window.setTimeout(() => setToast(''), 2500);
  };
  const change = (index, amount) => setCart(current =>
    current.map((item, itemIndex) => itemIndex === index ? { ...item, qty: item.qty + amount } : item)
      .filter(item => item.qty > 0));
  const order = async event => {
    event?.preventDefault();
    if (!cart.length) return;
    if (!name.trim() || !phone.trim() || !address.trim() || (deliveryMethod === 'delivery' && !street.trim())) {
      setToast(t('checkoutError'));
      window.setTimeout(() => setToast(''), 3500);
      return;
    }
    if (!waNumber) {
      setToast('WhatsApp ordering is temporarily unavailable. Please contact the shop directly.');
      return;
    }
    const whatsappWindow = window.open('about:blank', '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    let order;
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            customer_name: name, phone, delivery_area: address, street, delivery_method: deliveryMethod,
            payment_method: paymentMethod, notes,
          },
          items: cart.map(item => ({ product_id: item.id, quantity: item.qty, size: item.size, colour: item.colour })),
          subtotal,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Order save failed.');
      order = data;
    } catch (err) {
      if (err.message.includes('no longer available') || err.message.includes('check your')) {
        whatsappWindow?.close();
        setToast(err.message);
        return;
      }
      setToast(t('orderNotSaved'));
    }
    const orderSubtotal = Number(order?.order_subtotal ?? subtotal);
    const orderDeliveryFee = Number(order?.order_total != null ? order.order_total - orderSubtotal : deliveryFee);
    const orderTotal = Number(order?.order_total ?? total);
    const lines = (order?.items?.length ? order.items.map(item =>
      `• ${item.product_name}${item.size ? ` | Size: ${item.size}` : ''}${item.colour ? ` | Colour: ${item.colour}` : ''} x${item.quantity} @ ${money(item.unit_price, currency)} = ${money(item.line_total, currency)}${item.image_url ? `\n  Photo: ${item.image_url}` : ''}`
    ) : cart.map(item =>
      `• ${item.name}${item.size ? ` | Size: ${item.size}` : ''}${item.colour ? ` | Colour: ${item.colour}` : ''} x${item.qty} @ ${money(item.price, currency)} = ${money(item.price * item.qty, currency)}${item.image_url ? `\n  Photo: ${item.image_url}` : ''}`
    )).join('\n');
    const paymentLabels = {
      mpesa_on_delivery: t('mpesaDelivery'),
      mpesa_before_delivery: t('mpesaBefore'),
      cash: t('cash'),
    };
    const defaultMessage = `*${settings.store_name || 'Chelsie Trend Closet'}*${order?.order_number ? ` · ${order.order_number}` : ''}\n\n${lines}\n\nSubtotal: ${money(orderSubtotal, currency)}\nDelivery: ${money(orderDeliveryFee, currency)}\nTotal: ${money(orderTotal, currency)}\n\nName: ${name.trim()}\nPhone: ${phone.trim()}\nArea: ${address.trim()}\n${deliveryMethod === 'delivery' ? `Street / landmark: ${street.trim()}\n` : ''}Delivery: ${deliveryMethod === 'pickup' ? t('pickup') : t('delivery')}\nPayment: ${paymentLabels[paymentMethod]}\n${notes.trim() ? `Notes: ${notes.trim()}` : ''}`;
    const placeholders = {
      '{{order_number}}': order?.order_number || 'Pending',
      '{{customer_name}}': name.trim(),
      '{{phone}}': phone.trim(),
      '{{items}}': lines,
      '{{subtotal}}': money(orderSubtotal, currency),
      '{{delivery_fee}}': money(orderDeliveryFee, currency),
      '{{total}}': money(orderTotal, currency),
      '{{delivery_area}}': address.trim(),
      '{{notes}}': notes.trim(),
    };
    const message = Object.entries(placeholders).reduce((text, [placeholder, value]) =>
      text.replaceAll(placeholder, value), settings.whatsapp_template || defaultMessage);
    const whatsappUrl = `https://wa.me/${waNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`;
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    else window.location.href = whatsappUrl;
    setToast(order ? t('orderSaved') : t('orderNotSaved'));
    window.setTimeout(() => setToast(''), 4500);
    setCart([]);
    setOpen(false);
  };

  const productCard = product => {
    const images = product.images?.length ? product.images : [product.image_url].filter(Boolean);
    const productName = language === 'sw' && product.name_sw ? product.name_sw : product.name;
    const productDescription = language === 'sw' && product.description_sw ? product.description_sw : product.description;
    const discount = product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : 0;
    return (
      <article className="product-card" key={product.id}>
        <div className="product-image-wrap">
          <button className="product-image-button" onClick={() => {
            setSelectedProduct(product);
            setGalleryIndex(0);
            setDetailSize(product.sizes?.split(',')[0]?.trim() || '');
            setDetailColour(product.colours?.[0] || '');
            setDetailQty(1);
          }} aria-label={`View ${productName}`}>
            {images.length
              ? <img className="product-image" src={images[0]} alt={productName} loading="lazy" decoding="async" />
              : <span className="product-image-placeholder"><span>CTC</span></span>}
          </button>
          {product.is_featured && <span className="product-badge">Popular</span>}
          {discount > 0 && <span className="product-badge discount-badge">-{discount}% {t('sale')}</span>}
          {product.stock <= 0 && <span className="product-badge sold-badge">{t('soldOut')}</span>}
          {product.stock > 0 && product.stock <= Number(settings.low_stock_threshold || 3) && <span className="stock-note">{t('only')} {product.stock} {t('left')}</span>}
          <button className="quick-view-button" onClick={() => {
            setSelectedProduct(product);
            setGalleryIndex(0);
            setDetailSize(product.sizes?.split(',')[0]?.trim() || '');
            setDetailColour(product.colours?.[0] || '');
            setDetailQty(1);
          }}>Quick view</button>
        </div>
        <div className="product-details">
          <div className="product-category">{product.category || 'The collection'}</div>
          <h3>{productName}</h3>
          {productDescription && <p>{productDescription}</p>}
          <div className="product-buy-row">
            <strong>{money(product.price, currency)} {discount > 0 && <del>{money(product.compare_at_price, currency)}</del>}</strong>
            {product.stock > 0
              ? <button className="add-button" onClick={() => add(product)} aria-label={`Add ${productName} to your bag`}>＋</button>
              : <span className="unavailable">{t('unavailable')}</span>}
          </div>
          {product.sizes && product.stock > 0 && (
            <label className="size-select-label">Size
              <select aria-label={`Size for ${productName}`} value={size[product.id] || product.sizes.split(',')[0].trim()}
                onChange={event => setSize(current => ({ ...current, [product.id]: event.target.value }))}>
                {product.sizes.split(',').map(value => <option key={value.trim()}>{value.trim()}</option>)}
              </select>
            </label>
          )}
        </div>
      </article>
    );
  };

  const banner = activeSlides[slide % activeSlides.length];
  const categoryImages = [
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=700&q=80',
  ];
  const localizedProductName = product => language === 'sw' && product.name_sw ? product.name_sw : product.name;
  const activeDetailImages = selectedProduct?.images?.length ? selectedProduct.images : [selectedProduct?.image_url].filter(Boolean);
  const similarProducts = selectedProduct ? products.filter(product =>
    product.id !== selectedProduct.id && product.category === selectedProduct.category).slice(0, 4) : [];

  return (
    <main className="shop" style={{
      '--shop-primary': settings.theme_primary || '#E91E8C',
      '--shop-accent': settings.theme_accent || '#B0166B',
      '--shop-background': settings.theme_background || '#FFF0F6',
    }}>
      {!!settings.announcement && <div className="announcement"><span>{settings.announcement}</span></div>}
      <header className="shop-header">
        <a className="brand" href="/" aria-label={`${settings.store_name || 'Chelsie Trend Closet'} home`}>
          <img className="store-logo" src={settings.logo_url || '/chelsie-logo.jpeg'} alt="" />
          <span className="brand-name">{settings.store_name || 'chelsie'}<b>{settings.store_name ? settings.tagline : 'trend closet'}</b>
            <small>{settings.tagline || 'YOUR STYLE, YOUR STORY'}</small></span>
        </a>
        <nav className="shop-nav" aria-label="Main navigation">
          <a href="#collection">{t('shopAll')}</a><a href="#popular">{t('popular')}</a><a href="#categories">{t('collections')}</a>
        </nav>
        <div className="header-actions">
          <form className="header-search" onSubmit={event => { event.preventDefault(); document.querySelector('#collection')?.scrollIntoView({ behavior: 'smooth' }); }}>
            <span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')} />
          </form>
          <button className="language-switch" onClick={() => setLanguage(language === 'en' ? 'sw' : 'en')} aria-label={language === 'en' ? 'Badili lugha iwe Kiswahili' : 'Switch language to English'}>{language === 'en' ? 'SW' : 'EN'}</button>
          <button className="bag-button" onClick={() => setOpen(true)} aria-label={`${t('bag')} (${cartCount})`}>
            <span className="bag-icon" aria-hidden="true">♡</span><span className="bag-label">{t('bag')}</span><span className="bag-count">{cartCount}</span>
          </button>
        </div>
      </header>

      <section className="hero" aria-label="Featured collection">
        <img className="hero-image" src={banner.image} alt="" fetchPriority="high" decoding="async" />
        <div className="hero-shade" />
        <div className="hero-content" key={slide}>
          <span className="eyebrow">{banner.eyebrow || t('newSeason')}</span>
          <h1>{(banner.title || t('heroTitle')).split('\n').map((line, index) => <span key={`${slide}-${index}`}>{index > 0 && <br />}{line}</span>)}</h1>
          <p>{banner.copy || t('heroCopy')}</p>
          <a className="hero-link" href={banner.link || '#collection'}>{banner.button || t('shopCollection')} <span>↗</span></a>
        </div>
        <div className="hero-controls" aria-label="Carousel controls">
          <button onClick={() => setSlide(current => (current + activeSlides.length - 1) % activeSlides.length)} aria-label="Previous slide">←</button>
          <span>0{slide % activeSlides.length + 1}<i />0{activeSlides.length}</span>
          <button onClick={() => setSlide(current => (current + 1) % activeSlides.length)} aria-label="Next slide">→</button>
        </div>
        <span className="hero-side-note">NAIROBI · KENYA</span>
      </section>

      <div className="promise-strip"><span>✳&nbsp; {t('curated')}</span><span>✦&nbsp; {t('whatsappOrdering')}</span><span>◌&nbsp; {t('newFinds')}</span></div>

      {!!categoryTiles.length && <section className="category-feature-section" id="categories">
        <div className="section-heading"><div><span className="eyebrow">A LITTLE SOMETHING FOR EVERY DAY</span><h2>{t('collections')}<span className="heading-dot">.</span></h2></div></div>
        <div className="category-feature-grid">{categoryTiles.slice(0, 4).map((category, index) => <button className="category-feature" key={category.id || category.name}
          onClick={() => { setActiveCategory(category.name); document.querySelector('#collection')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <img src={category.image_url || categoryImages[index % categoryImages.length]} alt="" loading="lazy" decoding="async" />
          <span>{category.name}<b>Explore ↗</b></span>
        </button>)}</div>
      </section>}

      {products.length > 0 && <section className="featured-section new-arrivals-section">
        <div className="section-heading"><div><span className="eyebrow">JUST LANDED</span><h2>New arrivals<span className="heading-dot">.</span></h2></div>
          <a href="#collection">{t('shopAll')} <span>↗</span></a></div>
        <div className="featured-track">{products.slice(0, 4).map(productCard)}</div>
      </section>}

      {featured.length > 0 && <section className="featured-section" id="popular">
        <div className="section-heading">
          <div><span className="eyebrow">{t('favourites')}</span><h2>{t('popularNow')}<span className="heading-dot">.</span></h2></div>
          <a href="#collection">{t('shopEdit')} <span>↗</span></a>
        </div>
        <div className="featured-track">{featured.map(productCard)}</div>
      </section>}

      {!!saleProducts.length && <section className="featured-section sale-products">
        <div className="section-heading"><div><span className="eyebrow">A LITTLE SOMETHING SPECIAL</span><h2>Good finds, even better prices.</h2></div>
          <a href="#collection">{t('sale')} <span>↗</span></a></div>
        <div className="featured-track">{saleProducts.map(productCard)}</div>
      </section>}

      <section className="collection-section" id="collection">
        <div className="section-heading collection-heading">
          <div><span className="eyebrow">{t('collectionIntro')}</span><h2>{t('findYourThing')}<span className="heading-dot">.</span></h2></div>
          <span className="results-count">{products.length} of {totalProducts} {totalProducts === 1 ? t('piece') : t('pieces')}</span>
        </div>
        <div className="category-row" aria-label={t('collections')}>
          {categoryOptions.map(category => <button key={category} className={`category-chip${activeCategory === category ? ' active' : ''}`}
            onClick={() => setActiveCategory(category)}><span>{categoryIcons[category] || '✧'}</span>{category === 'All' ? t('all') : category}</button>)}
        </div>
        <div className="catalog-tools">
          <label className="search-field"><span aria-hidden="true">⌕</span><input type="search" placeholder={t('search')} value={query} onChange={event => setQuery(event.target.value)} aria-label={t('search')} />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label>
          <div className="catalog-filters">
            <label className="sort-field">Size
              <select aria-label="Filter by size" value={sizeFilter} onChange={event => setSizeFilter(event.target.value)}>
                <option value="">All sizes</option>{['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size'].map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="sort-field">Min <input type="number" min="0" value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder="KES" /></label>
            <label className="sort-field">Max <input type="number" min="0" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="KES" /></label>
            <label className="sort-field">{t('sortBy')}
              <select value={sort} onChange={event => setSort(event.target.value)}>
                <option value="newest">{t('newest')}</option><option value="popular">{t('popular')}</option><option value="price-asc">{t('priceLow')}</option><option value="price-desc">{t('priceHigh')}</option><option value="name">{t('name')}</option>
              </select>
            </label>
          </div>
        </div>
        {error && <div className="shop-message" role="alert">{error} <button onClick={() => setRefresh(current => current + 1)}>Try again</button></div>}
        {loading && page === 1
          ? <div className="product-grid">{[1, 2, 3, 4].map(item => <div className="product-skeleton" key={item} />)}</div>
          : products.length
            ? <div className="product-grid">{products.map(productCard)}</div>
            : <div className="empty-collection"><span>✳</span><h3>{error ? 'The rack is taking a breather.' : t('emptyCollection')}</h3><p>{error ? 'Please try again in a moment.' : t('emptyCollectionCopy')}</p>
              <button className="text-button" onClick={() => { setQuery(''); setActiveCategory('All'); setRefresh(current => current + 1); }}>{t('showEverything')} ↗</button></div>}
        {loading && page > 1 && <p className="load-more-status" role="status">Loading more pieces…</p>}
        {!loading && products.length < totalProducts && <button className="btn load-more-button" onClick={() => setPage(current => current + 1)}>Load more pieces <span>↓</span></button>}
      </section>

      <section className="trust-strip"><div><b>♡</b><span>Thoughtful picks<small>Curated for your everyday</small></span></div>
        <div><b>↗</b><span>Easy ordering<small>Checkout straight on WhatsApp</small></span></div>
        <div><b>✳</b><span>Here to help<small>Real people, personal service</small></span></div></section>

      <footer className="shop-footer">
        <a className="brand footer-brand" href="#"><img className="store-logo" src={settings.logo_url || '/chelsie-logo.jpeg'} alt="" loading="lazy" decoding="async" />
          <span className="brand-name">{settings.store_name || 'chelsie'}<b>{settings.store_name ? settings.tagline : 'trend closet'}</b><small>YOUR STYLE, YOUR STORY</small></span></a>
        <span>{settings.footer_text || t('footer')} <b>♡</b></span>
        <div className="footer-links">{Object.entries(settings.social_links || {}).filter(([, url]) => typeof url === 'string' && url.startsWith('https://')).map(([label, url]) =>
          <a href={url} key={label} target="_blank" rel="noreferrer">{label}</a>)}
          {settings.contact_text && <span>{settings.contact_text}</span>}<a href="/admin">{t('staffSignIn')} ↗</a></div>
      </footer>

      {toast && <div className="shop-toast" role="status">{toast}</div>}

      {selectedProduct && <div className="product-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedProduct(null); }}>
        <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <button className="modal-close" onClick={() => setSelectedProduct(null)} aria-label="Close product details">×</button>
          <div className="detail-main-image">
            {activeDetailImages[galleryIndex] ? <img src={activeDetailImages[galleryIndex]} alt={localizedProductName(selectedProduct)} decoding="async" /> : <div className="product-image-placeholder"><span>CTC</span></div>}
            {activeDetailImages.length > 1 && <div className="detail-gallery-controls">
              <button onClick={() => setGalleryIndex(index => (index + activeDetailImages.length - 1) % activeDetailImages.length)} aria-label="Previous product photo">←</button>
              <button onClick={() => setGalleryIndex(index => (index + 1) % activeDetailImages.length)} aria-label="Next product photo">→</button>
            </div>}
            {activeDetailImages.length > 1 && <div className="detail-thumbnails">{activeDetailImages.map((image, index) =>
              <button className={galleryIndex === index ? 'selected' : ''} key={image} onClick={() => setGalleryIndex(index)} aria-label={`Show product photo ${index + 1}`}>
                <img src={image} alt="" loading="lazy" decoding="async" /></button>)}</div>}
          </div>
          <div className="detail-copy">
            <span className="eyebrow">{selectedProduct.category || 'THE COLLECTION'}</span>
            <h2 id="detail-title">{localizedProductName(selectedProduct)}</h2>
            <strong className="detail-price">{money(selectedProduct.price, currency)} {selectedProduct.compare_at_price > selectedProduct.price && <del>{money(selectedProduct.compare_at_price, currency)}</del>}</strong>
            <p>{language === 'sw' ? selectedProduct.description_sw || selectedProduct.description : selectedProduct.description}</p>
            {selectedProduct.sizes && <label className="detail-option">Size<select value={detailSize} onChange={event => setDetailSize(event.target.value)}>
              {selectedProduct.sizes.split(',').map(value => <option key={value.trim()}>{value.trim()}</option>)}</select></label>}
            {!!selectedProduct.colours?.length && <label className="detail-option">Colour<select value={detailColour} onChange={event => setDetailColour(event.target.value)}>
              {selectedProduct.colours.map(value => <option key={value}>{value}</option>)}</select></label>}
            <div className="detail-quantity"><span>Quantity</span><div className="quantity-control"><button onClick={() => setDetailQty(value => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
              <span>{detailQty}</span><button onClick={() => setDetailQty(value => Math.min(Number(selectedProduct.stock), value + 1))} aria-label="Increase quantity">＋</button></div></div>
            <button className="checkout-button" disabled={selectedProduct.stock < 1} onClick={() => add(selectedProduct, detailQty, detailSize, detailColour)}>
              {selectedProduct.stock > 0 ? 'Add to bag' : t('soldOut')} <span>{money(selectedProduct.price * detailQty, currency)}</span></button>
          </div>
          {!!similarProducts.length && <div className="detail-similar"><span className="eyebrow">YOU MAY ALSO LIKE</span><div>{similarProducts.map(product => <button key={product.id} onClick={() => {
            setSelectedProduct(product); setGalleryIndex(0); setDetailSize(product.sizes?.split(',')[0]?.trim() || ''); setDetailColour(product.colours?.[0] || '');
          }}><img src={product.images?.[0] || product.image_url || '/chelsie-logo.jpeg'} alt="" loading="lazy" decoding="async" /><span>{localizedProductName(product)}</span></button>)}</div></div>}
        </section>
      </div>}

      {open && <div className="cart-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <aside className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <div className="cart-heading"><div><span className="eyebrow">{t('yourFinds')}</span><h2 id="cart-title">{t('yourBag')} <span>({cartCount})</span></h2></div>
            <button className="cart-close" onClick={() => setOpen(false)} aria-label="Close shopping bag">×</button></div>
          {!cart.length ? <div className="cart-empty"><span>♡</span><h3>{t('emptyBag')}</h3><p>{t('emptyBagCopy')}</p><button className="text-button" onClick={() => setOpen(false)}>{t('browse')} ↗</button></div>
            : <>
              <div className="cart-items">{cart.map((item, index) => <div className="cart-item" key={`${item.id}-${item.size}-${item.colour}`}>
                <div className="cart-item-art">{item.image_url && <img src={item.image_url} alt="" loading="lazy" decoding="async" />}</div>
                <div className="cart-item-info"><h3>{item.name}</h3><p>{[item.size && `Size ${item.size}`, item.colour && item.colour, money(item.price, currency)].filter(Boolean).join(' · ')}</p>
                  <div className="quantity-control"><button onClick={() => change(index, -1)} aria-label={`Remove one ${item.name}`}>−</button><span>{item.qty}</span>
                    <button onClick={() => change(index, 1)} aria-label={`Add one ${item.name}`}>＋</button></div></div>
                <strong>{money(item.price * item.qty, currency)}</strong>
              </div>)}</div>
              <form className="cart-checkout" onSubmit={order}>
                <div className="cart-total"><span>{t('subtotal')}</span><strong>{money(subtotal, currency)}</strong></div>
                <div className="cart-total"><span>Delivery</span><strong>{deliveryFee ? money(deliveryFee, currency) : 'Free'}</strong></div>
                {settings.free_delivery_threshold && subtotal < Number(settings.free_delivery_threshold) && <small>Free delivery over {money(settings.free_delivery_threshold, currency)}.</small>}
                <label>{t('fullName')}<input required autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label>
                <label>{t('phone')}<input required type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label>
                <label>{t('deliveryMethod')}<select value={deliveryMethod} onChange={event => setDeliveryMethod(event.target.value)}>
                  <option value="delivery">{t('delivery')}</option><option value="pickup">{t('pickup')}</option></select></label>
                {deliveryMethod === 'delivery' && <>
                  <label>{t('deliveryArea')}<input required autoComplete="address-level2" value={address} onChange={event => setAddress(event.target.value)} /></label>
                  <label>{t('street')}<input required autoComplete="street-address" value={street} onChange={event => setStreet(event.target.value)} /></label>
                </>}
                <label>{t('paymentMethod')}<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>
                  <option value="mpesa_on_delivery">{t('mpesaDelivery')}</option><option value="mpesa_before_delivery">{t('mpesaBefore')}</option><option value="cash">{t('cash')}</option></select></label>
                <label>{t('notes')}<textarea value={notes} onChange={event => setNotes(event.target.value)} rows="2" maxLength="1000" /></label>
                <div className="cart-total grand-total"><span>Total</span><strong>{money(total, currency)}</strong></div>
                <small>{t('deliveryNote')}</small>
                <button className="checkout-button" type="submit">{t('checkout')} <span>↗</span></button>
              </form>
            </>}
        </aside>
      </div>}
    </main>
  );
}
