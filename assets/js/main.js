/* RSPKL website core — nav, countdown, cart, toasts.
   Backend wiring points are marked RSPKL-API. */
(function () {
  'use strict';

  // ---- site config (RSPKL-API: replace with live endpoints when ready) ----
  var CFG = {
    playersOnline: 1284,            // RSPKL-API: GET /api/players
    seasonStart: '2026-09-18T18:00:00Z', // Season 1 opening
    checkoutLive: false,            // flip true once Stripe checkout exists
    currency: 'USD'
  };
  window.RSPKL = CFG;

  // ---- helpers ----
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  var toastTimer = null;
  window.rspklToast = function (msg) {
    var t = $('#toast');
    if (!t) { return; }
    t.innerHTML = '<i class="bi bi-patch-check-fill"></i><span>' + msg + '</span>';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3400);
  };

  // ---- mobile nav ----
  var burger = $('#burger'), mnav = $('#mobile-nav');
  if (burger && mnav) {
    burger.addEventListener('click', function () { mnav.classList.toggle('open'); });
    $$('a', mnav).forEach(function (a) {
      a.addEventListener('click', function () { mnav.classList.remove('open'); });
    });
  }

  // ---- notification bar: countdown + players online ----
  var cd = $('#notif-countdown');
  if (cd) {
    var target = new Date(CFG.seasonStart).getTime();
    function tick() {
      var d = target - Date.now();
      if (d <= 0) { cd.textContent = 'LIVE NOW'; return; }
      var h = Math.floor(d / 3600000);
      var m = Math.floor((d % 3600000) / 60000);
      var s = Math.floor((d % 60000) / 1000);
      cd.textContent = (h > 23
        ? Math.floor(h / 24) + 'D ' + (h % 24) + 'H ' + m + 'M'
        : h + 'H ' + m + 'M ' + s + 'S');
    }
    tick(); setInterval(tick, 1000);
  }
  $$('.js-players').forEach(function (el) {
    el.textContent = CFG.playersOnline.toLocaleString('en-US');
  });

  // ---- "launching soon" links (forum, wiki, discord, downloads) ----
  document.addEventListener('click', function (e) {
    var a = e.target.closest('.js-soon');
    if (!a) { return; }
    e.preventDefault();
    var what = a.getAttribute('data-soon') || 'This service';
    rspklToast(what + ' launches with RSPKL Season 1.');
  });

  // ---- variant selects sync price ----
  $$('.variant-select').forEach(function (sel) {
    var card = sel.closest('.product-card');
    if (!card) { return; }
    var priceEl = $('.product-price .p', card);
    var valEl = $('.product-value b', card);
    function sync() {
      var opt = sel.options[sel.selectedIndex];
      if (priceEl && opt.getAttribute('data-price')) {
        priceEl.textContent = '$' + opt.getAttribute('data-price');
      }
      if (valEl && opt.getAttribute('data-value')) {
        valEl.textContent = opt.getAttribute('data-value');
      }
    }
    sel.addEventListener('change', sync);
    sync();
  });

  // ---- cart ----
  var CART_KEY = 'rspkl_cart_v1';
  function cartGet() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (err) { return []; }
  }
  function cartSet(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (err) {}
    cartRender();
  }
  function cartAdd(item) {
    var items = cartGet();
    items.push(item);
    cartSet(items);
    rspklToast(item.name + ' added to cart.');
  }
  function cartRender() {
    var items = cartGet();
    var n = $('#cart-count'), list = $('#cart-items'), total = $('#cart-total'), empty = $('#cart-empty');
    if (!list) { return; }
    if (n) { n.textContent = items.length; }
    var totalCents = 0;
    list.innerHTML = '';
    items.forEach(function (it, i) {
      totalCents += it.price;
      var div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML =
        '<div class="t"><b></b><span>' + it.tag + '</span></div>' +
        '<div class="p">$' + (it.price / 100).toFixed(2) + '</div>' +
        '<button class="x" aria-label="Remove"><i class="bi bi-x"></i></button>';
      $('.t b', div).textContent = it.name;
      $('.x', div).addEventListener('click', function () {
        var cur = cartGet(); cur.splice(i, 1); cartSet(cur);
      });
      list.appendChild(div);
    });
    if (empty) { empty.style.display = items.length ? 'none' : 'block'; }
    if (total) { total.textContent = '$' + (totalCents / 100).toFixed(2) + ' ' + CFG.currency; }
  }
  // buy buttons
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.js-buy');
    if (!b) { return; }
    var card = b.closest('.product-card');
    var sel = card ? $('.variant-select', card) : null;
    var opt = sel ? sel.options[sel.selectedIndex] : null;
    var cents = Math.round(parseFloat(
      (opt && opt.getAttribute('data-price')) ||
      b.getAttribute('data-price') || '0') * 100);
    var base = b.getAttribute('data-product') || 'Item';
    var variant = (opt && opt.textContent) || '';
    cartAdd({
      name: variant && opt && opt.getAttribute('data-price') ? base + ' — ' + variant.replace(/\s*\[\$.*\]/, '') : base,
      tag: 'RSPKL SHOP',
      price: cents
    });
  });
  // drawer
  var fab = $('#cart-fab'), drawer = $('#cart-drawer'), overlay = $('#overlay');
  function cartOpen(v) {
    if (!drawer) { return; }
    drawer.classList.toggle('open', v);
    if (overlay) { overlay.classList.toggle('open', v); }
  }
  if (fab) { fab.addEventListener('click', function () { cartOpen(!drawer.classList.contains('open')); }); }
  if (overlay) { overlay.addEventListener('click', function () { cartOpen(false); }); }
  var cx = $('#cart-close');
  if (cx) { cx.addEventListener('click', function () { cartOpen(false); }); }
  var co = $('#cart-checkout');
  if (co) {
    co.addEventListener('click', function () {
      if (!CFG.checkoutLive) {
        rspklToast('Secure checkout goes live with Season 1 — cart is saved on this device.');
        return;
      }
      window.location.href = '/checkout/';
    });
  }
  cartRender();

  // ---- reveal on scroll ----
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.08 });
    $$('.rv').forEach(function (el) { io.observe(el); });
  } else {
    $$('.rv').forEach(function (el) { el.classList.add('in'); });
  }

  // ---- footer year ----
  $$('.js-year').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---- language selector (cosmetic until i18n backend) ----
  $$('.lang select').forEach(function (sel) {
    sel.addEventListener('change', function () {
      if (sel.value !== 'en') {
        rspklToast('Español arrives with Season 1 — English for now.');
        sel.value = 'en';
      }
    });
  });
})();
