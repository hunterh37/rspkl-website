#!/usr/bin/env python3
"""RSPKL website generator.

Writes the static site (HTML/robots/sitemap) into website/. Pages are plain
static output committed to the repo, so hosting needs no build step.

Run:  python3 website/tools/build_pages.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DOMAIN = "https://rspkl.com"  # update when the production domain is bound (see RENDER.md)

FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900'
    '&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;600'
    '&display=swap" rel="stylesheet">\n'
    '  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons'
    '@1.13.1/font/bootstrap-icons.min.css">\n'
    '  <link rel="stylesheet" href="/assets/css/main.css">'
)

SKULL = '/assets/img/skull-gold.png'
SKULL_COIN = '/assets/img/skull-coin.png'
SKULL_RISK = '/assets/img/skull-risk.png'

NAV_LINKS = [
    ("/", "HOME", "home"),
    # TEMP: PLAY disabled/unused
    ("/hiscore/", "HISCORES", "hiscore"),
    ("/battles/", "BATTLES", "battles"),
    ("/killcams/", "Top Killcams", "killcams"),
    ("/killfeed/", "Kill Feed", "killfeed"),
]


def nav_html(active: str) -> str:
    links = "".join(
        f'<a class="nav-link{" active" if key == active else ""}" href="{href}">{label}</a>'
        for href, label, key in NAV_LINKS
    )
    mobile = "".join(
        f'<a href="{href}">{label}</a>' for href, label, _ in NAV_LINKS
    )
    return f"""
    <header class="site-header">
      <div class="nav-inner">
        <a class="brand" href="/" aria-label="PK League home">
          <img src="{SKULL}" alt="PK League golden skull">
          <span class="brand-mark">
            <span class="main">PK <span>League</span></span>
          </span>
        </a>
        <nav class="nav" aria-label="Primary">
          {links}
          <div class="nav-cta">
            <a class="btn btn-gold btn-sm" href="/download/">ENTER LEAGUE</a>
          </div>
        </nav>
        <button class="burger" id="burger" aria-label="Menu"><i class="bi bi-list"></i></button>
      </div>
    </header>
    <div class="mobile-nav" id="mobile-nav">
      {mobile}
      <a class="btn btn-gold btn-block" href="/download/">ENTER LEAGUE</a>
    </div>"""


def footer_html(include_cart: bool = False) -> str:
    cols = {
        "Compete": [
            ("/download/", "Enter the League"),
            ("/hiscore/", "Hiscores"),
            ("/battles/", "Battle Finder"),
        ],
        "Resources": [
            ("/itemlist/", "Item List"),
            ("/droptable/", "Drop Table"),
            ("/rules/", "Rules"),
            ("/provablyfair/", "Provably Fair"),
        ],
        "Support": [
            ("/support/", "Contact Us"),
            ("mailto:support@rspkl.com", "Email Support"),
            ("/staff/", "Staff List"),
        ],
    }
    grid = ""
    for head, items in cols.items():
        lis = "".join(
            f'<a class="footer-link js-soon" data-soon="{href[5:]}" href="#">{label}'
            '<i class="bi bi-chevron-right"></i></a>'
            if href.startswith("soon:") else
            f'<a class="footer-link" href="{href}">{label}<i class="bi bi-chevron-right"></i></a>'
            for href, label in items
        )
        grid += f'<div><div class="footer-head">{head}</div>{lis}</div>'

    cart = f"""
    <div class="overlay" id="overlay"></div>
    <aside class="cart-drawer" id="cart-drawer" aria-label="Cart">
      <div class="cart-head">
        <h3><i class="bi bi-trophy"></i> Your Cart</h3>
        <button class="cart-close" id="cart-close" aria-label="Close cart"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="cart-items"><div id="cart-items"></div><p class="cart-empty" id="cart-empty">Your cart is empty.</p></div>
      <div class="cart-foot">
        <div class="cart-total">TOTAL <b id="cart-total">$0.00 USD</b></div>
        <button class="btn btn-gold btn-block" id="cart-checkout">SECURE CHECKOUT</button>
      </div>
    </aside>
    <button class="cart-fab" id="cart-fab"><i class="bi bi-trophy"></i> CART <span class="n" id="cart-count">0</span></button>""" if include_cart else ""

    return f"""
    <footer class="site-footer">
      <div class="container">
        <div class="footer-cta">
          <div class="t">PK League <span>· Competitive Old School PvP</span></div>
        </div>
        <div class="footer-grid">{grid}</div>
        <div class="footer-bottom">
          <div>&copy; <span class="js-year">2026</span> PK LEAGUE — All Rights Reserved.</div>
          <div class="legal">
            <a href="/rules/#terms">Terms of Service</a>
            <a href="/rules/#privacy">Privacy Policy</a>
            <a href="/rules/#refund">Refund Policy</a>
          </div>
        </div>
      </div>
    </footer>
    {cart}
    <div class="toast" id="toast" role="status"></div>
    <script src="/assets/js/main.js"></script>"""


def killcam_version() -> str:
    """The version of the exported kill cam assets, if they are present.

    Every asset under /assets/killcam is named by its own id and served with a
    year-long immutable cache, so a re-export that changes what an id means
    would otherwise be invisible to anyone who had already loaded it. The page
    carries the version and the loader asks for ``?v=<version>``: a new export
    is a new URL, an unchanged one is the same URL and the same cache hit.
    """
    path = os.path.join(ROOT, "assets", "killcam", "manifest.json")
    try:
        with open(path) as fh:
            return str(json.load(fh).get("version", ""))
    except (IOError, ValueError):
        return ""


def item_icon_version() -> str:
    """The version of the exported item icon sheets, if they are present.

    Same contract as :func:`killcam_version`: the sheets are served immutable
    and named by their shard, so the export's own digest is what makes a
    re-render a different URL. Written by
    ``./gradlew -p client dumpItemIcons``.
    """
    path = os.path.join(ROOT, "assets", "items", "manifest.json")
    try:
        with open(path) as fh:
            return str(json.load(fh).get("version", ""))
    except (IOError, ValueError):
        return ""


def scripts(extra_js: str, module_js: str) -> str:
    """Page scripts, in load order.

    ``extra_js`` may name several files separated by spaces: the kill cam page
    loads decoders that the replay, the board and the node tests all share, and
    they have to be on the page before the module that uses them. ``module_js``
    is loaded as an ES module, which is how three.js has to be imported; it is
    deferred by definition, so it runs after the plain scripts regardless.
    """
    out = []
    for src in extra_js.split():
        out.append('<script src="%s"></script>' % (src if src.startswith("/") else "/" + src))
    if module_js:
        src = module_js if module_js.startswith("/") else "/" + module_js
        out.append('<script type="module" src="%s"></script>' % src)
    return "\n  ".join(out)


# TEMP: pages disabled/unused, not built. Re-enable by removing from this set.
DISABLED_PAGES = {"play/index.html", "vote/index.html"}


def page(path: str, title: str, desc: str, active: str, content: str,
          extra_js: str = "", module_js: str = "") -> None:
    if path in DISABLED_PAGES:
        print("skipped (disabled)", path)
        return
    full = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="{DOMAIN}/assets/img/app-icon.png">
  <meta name="theme-color" content="#c98f14">
  <link rel="icon" type="image/png" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" href="/assets/img/app-icon.png">
  {FONTS}
</head>
<body>
  {nav_html(active)}
  <main>
  {content}
  </main>
  {footer_html(include_cart=active == "donate")}
  {scripts(extra_js, module_js)}
</body>
</html>
"""
    out = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        f.write(full)
    print("wrote", path)


def section_head(kicker: str, h2: str, sub: str = "") -> str:
    s = f'<p class="sub">{sub}</p>' if sub else ""
    return f"""<div class="section-head">
      <div class="kicker">{kicker}</div>
      <h2>{h2}</h2>{s}
      <div class="diamond"><i></i></div>
    </div>"""


def page_hero(kicker: str, title: str, sub: str, wm: str = SKULL) -> str:
    return f"""<div class="page-hero">
      <img class="wm" src="{wm}" alt="">
      <div class="kicker">{kicker}</div>
      <h1>{title}</h1>
      <p class="sub">{sub}</p>
    </div>"""


# ---------- ranked ladder (Bronze -> Dragon) ----------
TIERS = [
    ("bronze", "Bronze", "0 &ndash; 1199", "Entry"),
    ("steel", "Steel", "1200 &ndash; 1499", "Top 66%"),
    ("mith", "Mithril", "1500 &ndash; 1799", "Top 39%"),
    ("rune", "Rune", "1800 &ndash; 2099", "Top 18%"),
    ("drag", "Dragon", "2100+", "Top 5%"),
]

ELO_CARDS = [
    ("01", "Ten placement fights",
     "Ten placement fights seed the rating. A 10-0 run places above Bronze."),
    ("02", "Every fight is rated",
     "Rated duels and Wilderness kills both move Elo. Higher-rated wins pay more."),
    ("03", "Promotion &amp; grace",
     "Crossing a tier ceiling promotes immediately. Demotion allows three recovery fights."),
]


def ladder_section() -> str:
    tiers = "".join(
        f"""<div class="tier t-{key}">
            <span class="crest" aria-hidden="true"><i></i></span>
            <b class="tier-name">{name}</b>
            <span class="tier-elo">{elo}</span>
            <span class="tier-pop">{pop}</span>
          </div>"""
        for key, name, elo, pop in TIERS
    )
    cards = "".join(
        f"""<div class="elo-card rv">
            <span class="elo-n">{n}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>"""
        for n, title, body in ELO_CARDS
    )
    return f"""
    <section class="section" id="ranked">
      <div class="container">
        {section_head("Ranked ladder", "Bronze to Dragon")}
        <div class="ladder-rail rv">{tiers}</div>
        <div class="elo-grid">{cards}</div>
        <div class="elo-formula rv">
          <span>NEW ELO = ELO + <b>K</b> &times; (RESULT &minus; EXPECTED)</span>
          <span>K <b>32</b></span>
          <span>PLACEMENTS <b>64</b></span>
          <span>SEASON RESET <b>SOFT</b></span>
        </div>
      </div>
    </section>"""


# ============================================================ HOME
def build_home():
    tiers = "".join(
        f"""<div class="tier t-{key}">
          <span class="crest" aria-hidden="true"><i></i></span>
          <b class="tier-name">{name}</b>
          <span class="tier-elo">{elo}</span>
        </div>"""
        for key, name, elo, _ in TIERS
    )
    content = f"""
    <div class="hero hero-competitive">
      <div class="hero-bg"></div>
      <img class="hero-wm" src="{SKULL}" alt="">
      <div class="hero-inner">
        <div class="season-banner" aria-label="Countdown to PK League Season 1">
          <div class="season-banner-title">
            <span class="season-number">S1</span>
            <span><b>PK League PvP Ranked Ladder</b><small>Season 1 opens September 15 · 18:00 UTC</small></span>
          </div>
          <div class="season-countdown" aria-live="polite">
            <span><b class="js-cd-d">00</b><small>Days</small></span><i>:</i>
            <span><b class="js-cd-h">00</b><small>Hrs</small></span><i>:</i>
            <span><b class="js-cd-m">00</b><small>Min</small></span><i>:</i>
            <span><b class="js-cd-s">00</b><small>Sec</small></span>
          </div>
        </div>
        <h1 class="hero-title">Ranked <span class="line-gold">PvP ladder.</span></h1>
        <div class="hero-actions">
          <a class="btn btn-gold btn-lg" href="/download/"><i class="bi bi-crosshair"></i> ENTER THE LEAGUE</a>
          <a class="hero-text-link" href="/hiscore/">VIEW THE LADDER <i class="bi bi-arrow-right"></i></a>
        </div>
        <div class="hero-ranks" aria-label="Ranked divisions from Bronze to Dragon">
          <div class="hero-ranks-head"><span>Ranked divisions</span><span>Elo progression</span></div>
          <div class="ladder-rail">{tiers}</div>
        </div>
      </div>
    </div>

    <div class="feed-ticker" aria-label="Recent kills">
      <div class="feed-ticker-label"><i class="bi bi-broadcast"></i> Kill feed</div>
      <div class="feed-ticker-viewport">
        <div class="feed-ticker-track" id="feed-ticker-track">
          <span class="feed-ticker-item">Live kills stream in once the league opens.</span>
        </div>
      </div>
    </div>

    """

    page("index.html", "PK League — The #1 PvP League",
         "PK League — competitive Old School PvP. Five divisions, weekly hybrid tournaments, "
         "bounty tiers and a 250M PKP prize pool. Play instantly in your browser.",
         "home", content, extra_js="assets/js/killfeed.js")


# ============================================================ DOWNLOAD
def build_download():
    os_cards = ""
    for ic, name, feats, btn, hot in [
        ("bi-windows", "Windows", ["Automatic updates", "Windows 10 &amp; 11", "PKLeague64.exe — 38MB", "Install tutorial"], "DOWNLOAD (64-BIT)", True),
        ("bi-apple", "Mac OS", ["Automatic updates", "macOS 12 – 15", "PKLeague.dmg — 115MB", "Install tutorial"], "DOWNLOAD", False),
        ("bi-linux", "Linux", ["Automatic updates", "Debian, Ubuntu &amp; more", "Unzip &amp; launch PK League", "PKLeague.jar — 80KB"], "DOWNLOAD", False),
        ("bi-filetype-java", "Java JAR", ["Automatic updates", "All operating systems", "Requires Java 11+", "PKLeague.jar — 80KB"], "DOWNLOAD", False),
    ]:
        ul = "".join(f"<li>{f}</li>" for f in feats)
        os_cards += f"""<div class="os-card rv">
          <span class="os-ic"><i class="bi {ic}"></i></span>
          <h3>{name}</h3>
          <ul>{ul}</ul>
          <a class="btn {'btn-gold' if hot else 'btn-outline'} btn-block js-soon" data-soon="The {name} installer" href="#">{btn}</a>
        </div>"""

    content = f"""
    {page_hero("Client downloads", "Native <em>Clients</em>",
               "Windows, macOS, Linux and Java builds. All update automatically.")}
    <section class="section">
      <div class="container">
        {section_head("Native clients", "Download the Client")}
        <div class="os-grid">{os_cards}</div>
        <div class="note-strip">
          <i class="bi bi-tools"></i>
          <span>Debug tool, uninstaller and no-admin installer available. Downloads unlock with Season 1.</span>
        </div>
      </div>
    </section>"""
    page("download/index.html", "Downloads — PK League Client",
         "Download the PK League client for Windows, macOS, Linux or Java. "
         "All clients update automatically.", "download", content)


# ============================================================ REGISTER
def build_register():
    content = f"""
    {page_hero("Create your account", "Ready in <em>Seconds</em>",
               "No website sign-up. The account is created on first login.")}
    <section class="section">
      <div class="container">
        {section_head("Procedure", "Three Steps")}
        <div class="steps">
          <div class="step rv"><h3>Open the Client</h3>
            <p>Open a client above to reach the login screen.</p></div>
          <div class="step rv"><h3>Choose your Login</h3>
            <p>Enter a username and password.</p></div>
          <div class="step rv"><h3>Start Playing</h3>
            <p>An available username creates the account instantly.</p></div>
        </div>
        <div class="note-strip">
          <i class="bi bi-exclamation-triangle"></i>
          <span>“Invalid username or password” on a new account means the name is taken.
          Native builds: <a href="/download/">downloads</a>.</span>
        </div>
      </div>
    </section>"""
    page("register/index.html", "Create Your Account — Play Instantly | PK League",
         "Create your PK League account — no website sign-up required. Your account is "
         "created the first time you log in.", "more", content)


# ============================================================ DONATE
def product_card(art_img, title, tags, price, value, variants=None,
                 data_product=None, btn="BUY NOW") -> str:
    tags_html = "".join(f'<span class="tag {c}">{t}</span>' for t, c in tags)
    if variants:
        opts = "".join(
            f'<option data-price="{p}" data-value="{v}">{n} [${p}]</option>'
            for n, p, v in variants
        )
        var = f'<select class="input variant-select">{opts}</select>'
    else:
        var = ""
    dp = data_product or title
    return f"""<div class="product-card rv">
      <div class="product-art"><div class="tags">{tags_html}</div><img src="{art_img}" alt=""></div>
      <div class="product-body">
        <h3>{title}</h3>
        <div class="product-variants">{var}</div>
        <div class="product-price"><span class="p">${price}</span></div>
        <div class="product-value">VALUE: <b>{value}</b> *</div>
        <div class="product-actions">
          <a class="btn btn-ghost" href="#shop-faq">MORE INFO</a>
          <button class="btn btn-gold js-buy" data-product="{dp}">{btn}</button>
        </div>
      </div>
    </div>"""


def rank_card(rank, color, price, value, perks, tags, bonus=""):
    perks_html = "".join(f'<li><i class="bi bi-check2"></i>{p}</li>' for p in perks)
    tags_html = "".join(f'<span class="tag {c}">{t}</span>' for t, c in tags)
    return f"""<div class="product-card rank-card rv" style="border-top-color:{color}">
      <div class="product-art"><div class="tags">{tags_html}</div><img src="{SKULL_COIN}" alt=""></div>
      <div class="product-body">
        <div class="rank-name" style="color:{color if color != '#7d6320' else '#f5d97a'}">{rank}</div>
        <ul class="perks">{perks_html}</ul>
        <div class="product-price"><span class="p">${price}</span></div>
        <div class="product-value">VALUE: <b>{value}</b> * {bonus}</div>
        <div class="product-actions">
          <a class="btn btn-ghost" href="#shop-faq">MORE INFO</a>
          <button class="btn btn-gold js-buy" data-product="{rank} Rank">BUY NOW</button>
        </div>
      </div>
    </div>"""


def build_donate():
    credits = "".join(
        product_card(SKULL_COIN, f"${amt} League Credits", tags, f"{amt:,}", val)
        for amt, val, tags in [
            (10, "701K PKP", [("POPULAR", "")]),
            (25, "1.74M PKP", []),
            (50, "3.47M PKP", [("HOT", "")]),
            (100, "6.94M PKP", []),
            (500, "34.68M PKP", [("BEST VALUE", "")]),
            (1000, "69.36M PKP", []),
        ]
    )

    ranks = "".join([
        rank_card("Qualifier", "#7a5230", "9.95", "670K PKP",
                  ["Qualifier badge on your profile", "yell channel access",
                   "Qualifier lounge access", "+15% boosted drop rates",
                   "30 donator points bonus"], [("STARTER", "")]),
        rank_card("Div 3", "#8f9099", "29.95", "1.96M PKP",
                  ["::bank command in safe zones", "Div 3 lounge access",
                   "all lower tier perks", "+20% boosted drop rates",
                   "100 donator points bonus"], []),
        rank_card("Div 2", "#c9c4b8", "89.95", "5.46M PKP",
                  ["::teles quick-teleport command", "free Jad &amp; Skotizo teleports",
                   "15 extra custom kits", "+25% boosted drop rates",
                   "400 donator points bonus"], []),
        rank_card("Div 1", "#f5d97a", "189.95", "11.85M PKP",
                  ["::spec &amp; ::hp commands in safe zones", "::unskull command",
                   "+30% boosted drop rates", "800 donator points bonus",
                   "Div 1 gold nameplate"], [("HOT", "")], "⚡ +5 Credits"),
        rank_card("Grandmaster", "#5fbfa4", "499.95", "29.87M PKP",
                  ["Quick-actions into bank, shops &amp; teleports",
                   "Grandmaster keep-on-death slot", "AFK skilling kingdom access",
                   "+35% boosted PvM drop rates", "2,000 donator points bonus"],
                  [("BEST VALUE", "")], "⚡ +40 Credits"),
        rank_card("Champion", "#fff3c4", "999.95", "58.20M PKP",
                  ["Champion home zone &amp; dungeons", "league coin skull overhead",
                   "private Grandmaster + Champion areas", "+40% boosted PvM drop rates",
                   "5,000 donator points bonus", "every lower tier perk"],
                  [("NEW", "tag-green"), ("HOT", "")], "⚡ +150 Credits"),
    ])

    points = "".join(
        product_card(SKULL_COIN, "League Points", [], "14.95", "250K PKP",
                     variants=[("250,000 PK Points", "14.95", "250K PKP"),
                               ("500,000 PK Points", "24.95", "500K PKP"),
                               ("1,000,000 PK Points", "49.95", "1M PKP"),
                               ("2,500,000 PK Points", "99.95", "2.5M PKP"),
                               ("5,000,000 PK Points", "179.95", "5M PKP"),
                               ("20,000,000 PK Points", "599.95", "20M PKP")],
                     data_product="PK Points Pack")
        for _ in [0]
    )

    boxes = [
        ("Bronze Box", "3.29", [("STARTER", "")], [("Bronze Box", "3.29", "62K PKP"),
         ("3x Bronze Boxes", "8.95", "186K PKP"), ("10x Bronze Boxes", "25.95", "620K PKP")]),
        ("Steel Box", "6.49", [], [("Steel Box", "6.49", "55K PKP"),
         ("5x Steel Boxes", "27.95", "275K PKP"), ("25x Steel Boxes", "120.95", "1.37M PKP")]),
        ("Rune Box", "7.95", [], [("Rune Box", "7.95", "98K PKP"),
         ("5x Rune Boxes", "33.95", "490K PKP"), ("25x Rune Boxes", "149.95", "2.45M PKP")]),
        ("Dragon Box", "19.95", [], [("Dragon Box", "19.95", "283K PKP"),
         ("5x Dragon Boxes", "79.95", "1.41M PKP"), ("25x Dragon Boxes", "299.95", "7.07M PKP")]),
        ("Gold Box", "39.95", [("HOT", "")], [("Gold Box", "39.95", "680K PKP"),
         ("5x Gold Boxes", "159.95", "3.4M PKP"), ("25x Gold Boxes", "599.95", "17M PKP")]),
        ("Grandmaster Box", "99.95", [], [("Grandmaster Box", "99.95", "2.68M PKP"),
         ("5x Grandmaster Boxes", "395.95", "13.4M PKP"), ("25x Grandmaster Boxes", "1495.95", "67M PKP")]),
        ("Champion Box", "199.95", [("NEW", "tag-green")], [("Champion Box", "199.95", "5.74M PKP"),
         ("5x Champion Boxes", "789.95", "28.7M PKP"), ("25x Champion Boxes", "2989.95", "143.5M PKP")]),
    ]
    boxes_html = "".join(
        product_card(SKULL, name, tags, price, variants[0][2], variants=variants,
                     data_product=name + " (Mystery)")
        for name, price, tags, variants in boxes
    )

    scrolls = "".join([
        product_card(SKULL_COIN, "Prayer Scrolls", [], "39.95", "177K PKP",
                     variants=[("Dexterous Scroll (Rigour)", "39.95", "177K PKP"),
                               ("Arcane Scroll (Augury)", "39.95", "177K PKP"),
                               ("Rigour &amp; Augury bundle", "69.95", "354K PKP"),
                               ("2x Dexterous Scroll", "69.95", "354K PKP"),
                               ("2x Arcane Scroll", "69.95", "354K PKP")],
                     data_product="Prayer Scroll"),
        product_card(SKULL_COIN, "Utility Scrolls", [], "49.95", "3.09M PKP",
                     variants=[("Name Change Scroll", "49.95", "3.09M PKP"),
                               ("Reset KDR Scroll", "49.95", "3.09M PKP")],
                     data_product="Utility Scroll"),
        product_card(SKULL_COIN, "Gold XP Lamp", [], "19.95", "814K PKP",
                     variants=[("Gold XP Lamp (500K XP)", "19.95", "814K PKP"),
                               ("3x Gold XP Lamps", "53.95", "2.44M PKP"),
                               ("10x Gold XP Lamps", "159.95", "8.14M PKP"),
                               ("25x Gold XP Lamps", "324.95", "20.35M PKP")],
                     data_product="Gold XP Lamp"),
    ])

    faq_items = [
        ("How fast is delivery?", "Delivery is instant in-game while online, and waits in your bank otherwise."),
        ("What payment methods are accepted?", "All major cards plus regional methods via the league checkout. Currency is converted automatically at daily rates."),
        ("Can I upgrade my rank later?", "Yes — pay the difference at any time. Your tier perks upgrade immediately on claim."),
        ("What does the * value mean?", "The PKP value shows what the purchase would be worth if traded for player-kill points on the league market."),
        ("Do ranks affect combat balance?", "No. Ranks unlock convenience commands and cosmetics only."),
    ]
    faq = "".join(
        f"<details><summary>{q}</summary><div class='a'>{a}</div></details>"
        for q, a in faq_items
    )

    content = f"""
    {page_hero("Shop", "PK League <em>Shop</em>",
               "Credits, ranks, mystery boxes and scrolls. Instant in-game delivery.")}
    <section class="section">
      <div class="container">
        <div class="shop-strip rv">
          <span><b>⚡</b> Instant in-game delivery</span>
          <span><b>🔒</b> Secure checkout</span>
          <span><b>🧑‍💻</b> 24/7 support available</span>
          <span><b>🏆</b> Most popular: $50 League Credits</span>
        </div>

        {section_head("Top up", "League Credits")}
        <div class="shop-grid">{credits}</div>

        {section_head("Supporter tiers", "Supporter Ranks",
               "Six tiers. Commands, cosmetics and drop-rate boosts only; no combat stats.")}
        <div class="shop-grid">{ranks}</div>

        {section_head("PK points", "League Points")}
        <div class="shop-grid">{points}</div>

        {section_head("Mystery boxes", "Mystery Boxes",
               "Seeded rolls, verifiable on the Provably Fair page.")}
        <div class="shop-grid">{boxes_html}</div>

        {section_head("Consumables", "Scrolls &amp; Lamps")}
        <div class="shop-grid">{scrolls}</div>

        <div class="shop-foot">
          <button class="btn btn-outline btn-lg" id="cart-open-btn" onclick="document.getElementById('cart-fab').click()">
            <i class="bi bi-trophy"></i> VIEW CART
          </button>
          <button class="btn btn-gold btn-lg" onclick="document.getElementById('cart-fab').click()">
            CHECKOUT
          </button>
        </div>

        <div class="panel rv" style="margin-top:34px">
          <div class="panel-head"><h3>Select your currency</h3>
          <div class="r">Converted at daily rates</div></div>
          <div class="panel-body">
            <select class="input" style="max-width:420px">
              <option>🇺🇸 USD $ — US Dollar</option><option>🇪🇺 EUR € — Euro</option>
              <option>🇬🇧 GBP £ — British Pound</option><option>🇨🇦 CAD $ — Canadian Dollar</option>
              <option>🇦🇺 AUD $ — Australian Dollar</option><option>🇸🇪 SEK — Swedish Krona</option>
              <option>🇳🇴 NOK — Norwegian Krone</option><option>🇩🇰 DKK — Danish Krone</option>
              <option>🇵🇱 PLN — Polish Złoty</option><option>🇯🇵 JPY ¥ — Japanese Yen</option>
            </select>
          </div>
        </div>

        <div class="info-tabs">
          <a href="#shop-faq">F.A.Q</a><a href="#" class="js-soon" data-soon="The top donors board">TOP DONORS</a>
          <a href="/support/">SUPPORT</a><a href="/rules/#refund">SHOP TERMS</a>
          <a href="#" class="js-soon" data-soon="Deal streaks">DEAL STREAKS</a>
        </div>

        <div class="section-head" id="shop-faq" style="margin-top:44px">
          <div class="kicker">Shop</div><h2>F.A.Q</h2>
          <div class="diamond"><i></i></div>
        </div>
        <div class="faq rv" style="max-width:820px;margin:0 auto">{faq}</div>

        <p class="small muted text-center" style="margin-top:26px">* Values shown for reference only.
        The shop activates with Season 1 — carts are saved on this device until then.</p>
      </div>
    </section>"""
    page("donate/index.html", "PK League Shop — Donations",
         "Support PK League and climb the tiers — league credits, supporter ranks, mystery "
         "boxes and scrolls. Instant in-game delivery, secure checkout.", "donate", content)


# ============================================================ HISCORE
def build_hiscore():
    def group(title, links):
        first = links[0][0]
        lis = "".join(
            f'<a href="#" data-board="{bid}"{" class=\"on\"" if bid == first else ""}>{label}<i class="bi bi-chevron-right"></i></a>'
            for bid, label in links
        )
        return f'<div class="cat-group"><p class="cat-title">{title}</p>{lis}</div>'

    combat = group("Combat", [("kills", "Top Kills"), ("deaths", "Top Deaths"), ("kdr", "Top KDR"),
                              ("elo", "Top Elo"), ("streak", "Current Streak"), ("best", "Highest Streak")])
    skills = group("Skills", [("total", "Total Level"), ("slayer", "Slayer")])
    misc = group("Misc Hiscores", [("lms", "LMS Rating"), ("log", "Collection Log")])
    monsters = group("Monster Killcounts", [
        ("mc0", "King Black Dragon"), ("mc1", "Corporeal Beast"), ("mc2", "Zulrah"),
        ("mc3", "Kraken"), ("mc4", "Callisto"), ("mc5", "Venenatis"),
        ("mc6", "Vet'ion"), ("mc7", "Scorpia"), ("mc8", "Chaos Elemental"),
        ("mc9", "TzTok-Jad"), ("mc10", "Skotizo"), ("mc11", "Revenant Dragon"),
    ])

    content = f"""
    {page_hero("Ladders", "PK League <em>Hiscores</em>",
               "Combat, skills, LMS rating and monster killcounts. Normal and Hardcore PvP.")}
    <section class="section">
      <div class="container">
        <div class="with-side">
          <div class="panel rv">
            <div class="panel-head">
              <h3 id="hs-board-title">TOP KILLS HISCORE (NORMAL)</h3>
              <div class="seg">
                <button class="on" data-mode="normal">Normal</button>
                <button data-mode="hc">Hardcore PvP</button>
              </div>
            </div>
            <div class="panel-body tight">
              <div class="table-wrap">
                <table class="league-table">
                  <thead><tr id="hs-head"><th>Rank</th><th>Username</th><th>KILLS</th><th>DEATHS</th><th>KDR</th></tr></thead>
                  <tbody id="hs-body"></tbody>
                </table>
              </div>
              <div class="pager" id="hs-pager"></div>
            </div>
          </div>
          <div class="side-col">
            <div class="panel rv">
              <div class="panel-head"><h3>Find a player</h3></div>
              <div class="panel-body">
                <form id="hs-search">
                  <div class="field">
                    <label for="hs-query">Log-in name</label>
                    <input class="input" id="hs-query" placeholder="Search players">
                  </div>
                  <button class="btn btn-gold btn-block" type="submit">PLAYER SEARCH</button>
                </form>
              </div>
            </div>
            <div class="panel rv">
              <div class="panel-head"><h3>Hiscore categories</h3></div>
              <div class="panel-body hs-cats">
                {combat}{skills}{misc}{monsters}
              </div>
            </div>
          </div>
        </div>
        <div class="note-strip">
          <i class="bi bi-database"></i>
          <span>Sample ladder data — the live boards sync from the league database when
          Season 1 opens.</span>
        </div>
      </div>
    </section>"""
    page("hiscore/index.html", "Hiscores — PK League Ladders",
         "PK League hiscores — top kills, KDR, Elo, streaks, skills, LMS rating and monster "
         "killcounts across Normal and Hardcore PvP.", "hiscore", content,
         extra_js="assets/js/hiscore.js")


# ============================================================ PLAYER PROFILE
def build_player():
    """The public per-player profile at ``/player/?name=<name>``.

    The web half of the in-game card (``spec/PLAYER_CARD.md``): who this is,
    what the ladders say about them, and what they have been killing. It is one
    static page rather than a page per account - the site is committed HTML and
    a player is a row in a database, so the name travels in the query string
    and ``assets/js/player.js`` fills the shell from ``GET /api/player/:name``.

    Every name printed anywhere on the site - a hiscore row, a killcam card, a
    feed post - links here, so the profile is the site's one answer to "who is
    that", and the killcam rows on it link back out to ``/killcams/?cam=<id>``
    for the replay rather than embedding a second viewer.
    """
    content = f"""
    <div class="page-hero pp-hero">
      <img class="wm" src="{SKULL}" alt="">
      <div class="kicker" id="pp-kicker">Profile</div>
      <h1 id="pp-name">Player</h1>
      <p class="sub" id="pp-sub">Loading the league record&hellip;</p>
      <div class="pp-chips" id="pp-chips"></div>
    </div>
    <section class="section">
      <div class="container">
        <div class="with-side">
          <div class="pp-main">
            <div class="panel rv">
              <div class="panel-head">
                <h3>THE RECORD</h3>
                <div class="seg" id="pp-mode">
                  <button class="on" data-mode="normal">Normal</button>
                  <button data-mode="hc">Hardcore PvP</button>
                </div>
              </div>
              <div class="panel-body tight">
                <div class="pp-tiles" id="pp-tiles"></div>
              </div>
            </div>
            <div class="panel panel-killcams rv">
              <div class="panel-head">
                <div>
                  <div class="panel-kicker"><i class="bi bi-play-circle-fill"></i> Replay archive</div>
                  <h3>PLAYER KILLCAMS</h3>
                </div>
                <div class="seg" id="pp-cams">
                  <button class="on" data-cams="kills">Kills</button>
                  <button data-cams="deaths">Deaths</button>
                  <button data-cams="top">Top voted</button>
                </div>
              </div>
              <div class="panel-body tight">
                <p class="pp-killcam-copy">Watch recorded fights from this player, including kills, deaths, and community favourites.</p>
                <div class="kc-list" id="pp-cam-list"></div>
              </div>
            </div>
            <div class="panel rv">
              <div class="panel-head"><h3>SKILLS</h3><div class="r" id="pp-total">&mdash;</div></div>
              <div class="panel-body tight">
                <div class="pp-skills" id="pp-skills"></div>
              </div>
            </div>
          </div>
          <div class="side-col">
            <div class="panel rv">
              <div class="panel-head"><h3>Ladder positions</h3></div>
              <div class="panel-body tight">
                <div class="pp-ranks" id="pp-ranks"></div>
              </div>
            </div>
            <div class="panel rv">
              <div class="panel-head"><h3>Another player</h3></div>
              <div class="panel-body">
                <form id="pp-search">
                  <div class="field">
                    <label for="pp-query">Log-in name</label>
                    <input class="input" id="pp-query" placeholder="Search players" autocomplete="off">
                  </div>
                  <div class="pp-suggest" id="pp-suggest"></div>
                  <button class="btn btn-gold btn-block" type="submit">OPEN PROFILE</button>
                </form>
              </div>
            </div>
            <div class="panel rv">
              <div class="panel-head"><h3>Elsewhere</h3></div>
              <div class="panel-body hs-cats">
                <div class="cat-group">
                  <a href="/hiscore/" id="pp-link-hiscore">Hiscores<i class="bi bi-chevron-right"></i></a>
                  <a href="/killcams/" id="pp-link-cams">All killcams<i class="bi bi-chevron-right"></i></a>
                  <a href="/killfeed/" id="pp-link-feed">Kill feed<i class="bi bi-chevron-right"></i></a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="note-strip" id="pp-note" style="display:none">
          <i class="bi bi-person-badge"></i>
          <span>Sample profile. Live records sync from the league database at Season 1.</span>
        </div>
      </div>
    </section>
    <div id="pp-items" hidden data-items="{item_icon_version()}"></div>"""
    page("player/index.html", "Player Profile — PK League",
         "A PK League player profile — kills, deaths, K/D, streaks, ladder positions, "
         "skills and every killcam the player appears in.", "hiscore", content,
         extra_js="assets/js/killcam-icons.js assets/js/player.js")


# ============================================================ BATTLES
def build_battles():
    """The Battle Finder board.

    The board reads ``/api/battles?sort=hype`` - the high-value ordering, the
    same one the in-game panel's Featured tab uses - and falls back to a
    friendly empty state rather than an error, as the hiscores do.
    """
    content = f"""
    {page_hero("Scheduled PvP", "The <em>Battle Finder</em>",
               "Rated 1v1s in three builds: Pure NH, Zerk NH, Main NH. One ladder, fixed gear.")}
    <section class="section">
      <div class="container">
        <div class="with-side">
          <div class="panel rv">
            <div class="panel-head">
              <h3 id="bf-board-title">HIGH VALUE BATTLES</h3>
              <div class="seg">
                <button class="on" data-sort="hype">Biggest</button>
                <button data-sort="time">Soonest</button>
              </div>
            </div>
            <div class="panel-body tight">
              <div class="table-wrap">
                <table class="league-table">
                  <thead><tr><th>Starts</th><th>Fight</th><th>Build</th><th>Rating</th><th>Status</th></tr></thead>
                  <tbody id="bf-body"></tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="side-col">
            <div class="panel rv">
              <div class="panel-head"><h3>How it works</h3></div>
              <div class="panel-body hs-cats">
                <div class="cat-group">
                  <p class="cat-title">In game</p>
                  <p class="sub"><b>::battles</b> opens the finder. Queueing pairs the closest waiting rating.</p>
                </div>
                <div class="cat-group">
                  <p class="cat-title">Book ahead</p>
                  <p class="sub">Posted battles with an open seat stay listed until taken.</p>
                </div>
                <div class="cat-group">
                  <p class="cat-title">Rating</p>
                  <p class="sub">Bronze through Dragon. Higher-rated wins pay more Elo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>"""
    page("battles/index.html", "Battle Finder — PK League Scheduled PvP",
         "PK League Battle Finder - rated 1v1 battles on Pure NH, Zerk NH and Main NH builds "
         "the scheduled fight board.",
         "battles", content, extra_js="assets/js/battles.js")


# ============================================================ KILLCAMS
def build_killcams():
    """The Top Killcams board.

    The cams themselves arrive from the API as the game's own KCP1 bytes and
    are decoded and drawn by assets/js/killcams.js, so nothing about a replay
    is baked into this page: the markup is a shell for the board, the viewer
    and the vote, and every number on it comes from a field the world recorded
    at the moment of the kill.

    The stage holds two canvases. The 3D one draws both fighters in the gear
    their appearance blocks describe, playing the animations the fight played;
    the tile one is the same cam as positions on a grid, and is what a browser
    without WebGL or without a gzip stream gets. Neither is a fallback for a
    missing cam - they are two readings of the same nine ticks.
    """
    content = f"""
    {page_hero("Replays", "Top <em>Killcams</em>",
               "The final five seconds of every Wilderness kill, replayed tick by tick, ranked by vote.")}
    <section class="section">
      <div class="container">
        <div class="with-side">
          <div class="panel rv">
            <div class="panel-head">
              <h3>THE BOARD</h3>
              <div class="seg" id="kc-sort">
                <button class="on" data-sort="top">Most Voted</button>
                <button data-sort="new">Newest</button>
              </div>
            </div>
            <div class="panel-body tight">
              <div class="kc-list" id="kc-list"></div>
              <div class="pager" id="kc-pager"></div>
            </div>
          </div>
          <div class="side-col">
            <div class="panel rv">
              <div class="panel-head"><h3>Find a fight</h3></div>
              <div class="panel-body">
                <form id="kc-search">
                  <div class="field">
                    <label for="kc-player-filter">Killer or victim</label>
                    <input class="input" id="kc-player-filter" placeholder="Search players">
                  </div>
                  <button class="btn btn-gold btn-block" type="submit">SEARCH CAMS</button>
                </form>
              </div>
            </div>
            <div class="panel rv">
              <div class="panel-head"><h3>How cams work</h3></div>
              <div class="panel-body">
                <div class="kc-meta" style="text-transform:none;letter-spacing:.02em;font-family:var(--font-body);font-size:13.5px;display:block;color:var(--muted)">
                  <p style="margin:0 0 10px">Five seconds before each Wilderness kill are recorded
                  for both fighters, every tick and hit. The last twenty are kept;
                  <b style="color:var(--parch)">::killcams</b> replays them in game.</p>
                  <p style="margin:0">Cams post automatically. One vote per viewer; the board sorts by votes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="note-strip" id="kc-note">
          <i class="bi bi-camera-reels"></i>
          <span>Sample board. Live cams sync from the world at Season 1.</span>
        </div>
      </div>
    </section>

    <div class="kc-modal" id="kc-modal" role="dialog" aria-modal="true"
         aria-label="Killcam replay" data-assets="{killcam_version()}"
         data-items="{item_icon_version()}">
      <div class="kc-frame">
        <div class="kc-frame-head">
          <h3 id="kc-modal-title">Killcam</h3>
          <div class="kc-head-tools">
            <div class="seg" id="kc-view">
              <button class="on" data-view="3d">3D</button>
              <button data-view="tiles">Tiles</button>
            </div>
            <button class="kc-vote" id="kc-modal-vote" data-vote=""></button>
            <button id="kc-close" aria-label="Close replay"><i class="bi bi-x-lg"></i></button>
          </div>
        </div>
        <div class="kc-stage" id="kc-stage">
          <canvas id="kc-gl"></canvas>
          <canvas id="kc-canvas" width="620" height="620" hidden></canvas>
          <div class="kc-overlay" id="kc-overlay"></div>
          <div class="kc-loading" id="kc-loading">Loading the fight&hellip;</div>
        </div>
        <div class="kc-controls">
          <button id="kc-play" aria-label="Play or pause"><i class="bi bi-pause-fill"></i></button>
          <input type="range" id="kc-scrub" min="0" max="800" value="0" step="1"
                 aria-label="Scrub through the replay">
          <span id="kc-status">&mdash;</span>
        </div>
        <div class="kc-legend">
          <span><i class="kc-dot-k"></i> Killer</span>
          <span><i class="kc-dot-v"></i> Victim</span>
          <span>Drag to orbit &middot; scroll to zoom &middot; 1 tile = 1 square</span>
        </div>
        <div class="kc-scoreboard" id="kc-scoreboard"></div>
      </div>
    </div>"""
    page("killcams/index.html", "Top Killcams — PK League Replays",
         "Watch the top PK League killcams — the last five seconds of every wilderness kill, "
         "replayed tick by tick, and voted on by the league.", "killcams", content,
         extra_js=("assets/js/killcam-mesh.js assets/js/killcam-cam.js "
                   "assets/js/killcam-anim.js assets/js/killcam-figure.js "
                   "assets/js/killcam-assets.js assets/js/killcam-icons.js "
                   "assets/js/killcams.js"),
         module_js="assets/js/killcam-3d.js")


# ============================================================ KILL FEED
def build_killfeed():
    """The kill feed: a scrollable newsfeed of recent kills.

    This is the killcams table again, read in kill order instead of vote
    order (`GET /api/killfeed`, `server/web/src/killcams.js#listFeed`) - no
    parallel capture pipeline, no second table. A post links back into
    `/killcams/` for a replay only when the kill sampled one; not every kill
    does, and the page says so rather than linking to nothing.
    """
    content = f"""
    {page_hero("Live", "Kill <em>Feed</em>",
               "Every wilderness kill the league records, newest first — killer, victim, weapon, bracket, and a replay where one was sampled.")}
    <section class="section">
      <div class="container">
        <div class="panel rv">
          <div class="panel-head">
            <h3>RECENT KILLS</h3>
          </div>
          <div class="panel-body tight">
            <div class="kc-list" id="kf-list"></div>
            <div class="kf-more"><button class="btn btn-outline btn-sm" id="kf-more">LOAD MORE</button></div>
          </div>
        </div>
        <div class="note-strip" id="kf-note">
          <i class="bi bi-broadcast"></i>
          <span>Sample feed. Live kills sync from the world at Season 1.</span>
        </div>
      </div>
    </section>"""
    page("killfeed/index.html", "Kill Feed — Recent Kills | PK League",
         "The PK League kill feed — every wilderness kill, newest first, with weapon, "
         "bracket, location and a replay link where a killcam was recorded.",
         "killfeed", content, extra_js="assets/js/killfeed.js")


# ============================================================ VOTE
def build_vote():
    sites = ""
    for i, (name, reward) in enumerate([
        ("RuneLocus", "2 Vote Credits + 50K PKP"),
        ("TopG RSPS", "2 Vote Credits + 50K PKP"),
        ("RuneStatus", "2 Vote Credits + 50K PKP"),
        ("Gaming Top 100", "3 Vote Credits + 75K PKP"),
        ("RSPS Arena", "3 Vote Credits + 75K PKP"),
    ], 1):
        sites += f"""<div class="vote-site">
          <span class="vs-ic">{i}</span>
          <div class="vs-body"><b>{name}</b><span>Reward: {reward} · cooldown 12h</span></div>
          <button class="btn btn-gold btn-sm js-soon" data-soon="The {name} vote link">VOTE NOW</button>
        </div>"""

    content = f"""
    {page_hero("Toplists", "Vote for <em>PK League</em>",
               "Five toplists. 12-hour cooldown each. Vote credits and PKP per vote.")}
    <section class="section">
      <div class="container">
        <div class="with-side">
          <div class="panel rv">
            <div class="panel-head"><h3>Vote &amp; claim</h3>
              <div class="r">5 sites · 12h cooldown</div></div>
            <div class="panel-body">
              <form id="vote-form">
                <div class="field" style="max-width:420px">
                  <label for="vote-username">Please enter your log-in name</label>
                  <input class="input" id="vote-username" placeholder="Your in-game name">
                </div>
                <button class="btn btn-gold" type="submit">CONTINUE TO VOTING <i class="bi bi-arrow-right"></i></button>
              </form>
              <div id="vote-sites" style="display:none;margin-top:22px">
                <p class="small muted" style="margin:0 0 14px">Voting as <b class="gold" id="vote-for">—</b>.
                Visit each site, complete the vote, then claim your rewards in-game with <span class="mono gold">::claim</span>.</p>
                {sites}
              </div>
            </div>
          </div>
          <div class="side-col">
            <div class="panel rv">
              <div class="panel-head"><h3>Vote rewards</h3></div>
              <div class="panel-body">
                <ul class="reward-list">
                  <li><i class="bi bi-trophy"></i> Vote Credits — spend in the ::voteshop</li>
                  <li><i class="bi bi-coin"></i> 50K–75K PKP per site, every 12 hours</li>
                  <li><i class="bi bi-fire"></i> 5-site streak: Bonus Box roll</li>
                  <li><i class="bi bi-gem"></i> 25-vote streak: Golden Skull token</li>
                  <li><i class="bi bi-hourglass-split"></i> 100-vote season: exclusive Season 1 cape</li>
                </ul>
              </div>
            </div>
            <div class="panel rv">
              <div class="panel-head"><h3>Why vote?</h3></div>
              <div class="panel-body">
                <p class="small muted">Toplist rank drives new-player traffic. Each site pays out every 12 hours.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>"""
    page("vote/index.html", "Vote for a Reward — PK League",
         "Vote for PK League on the toplists and claim vote credits and PKP in-game every "
         "12 hours. Streak rewards include the Golden Skull token.", "more", content,
         extra_js="assets/js/vote.js")


# ============================================================ ITEMLIST
def build_itemlist():
    content = f"""
    {page_hero("Item database", "PK League <em>Item List</em>",
               "Search by name or ID for in-game item stats.")}
    <section class="section">
      <div class="container">
        <div class="panel rv" style="margin-bottom:22px">
          <div class="panel-head"><h3>Find an item</h3><div class="r" id="item-count">— ITEMS</div></div>
          <div class="panel-body">
            <form id="item-search" style="display:flex;gap:10px;flex-wrap:wrap">
              <input class="input" id="item-query" style="flex:1;min-width:220px" placeholder="Search items by name or ID">
              <button class="btn btn-gold" type="submit"><i class="bi bi-search"></i> SEARCH</button>
            </form>
          </div>
        </div>
        <div class="panel rv">
          <div class="panel-head"><h3>Item browser</h3><div class="r">Toolkit · all game items</div></div>
          <div class="panel-body">
            <div class="item-grid" id="item-grid"></div>
            <div class="pager" id="item-pager"></div>
          </div>
        </div>
        <div class="note-strip">
          <i class="bi bi-database"></i>
          <span>Sample slice. The full 24,000+ item index loads from the league cache at Season 1.</span>
        </div>
      </div>
    </section>"""
    page("itemlist/index.html", "Item List — PK League Item Database",
         "Browse the PK League item database — search by name or ID, view every item in the "
         "league toolkit.", "more", content, extra_js="assets/js/itemlist.js")


# ============================================================ DROPTABLE
def build_droptable():
    chips = "".join(
        f'<button class="chip{" on" if r == 0 else ""}" data-rank="{rid}">{label}'
        + (f'<span class="pct">+{pct}%</span>' if pct else '<span class="pct">BASE</span>') + '</button>'
        for r, (rid, label, pct) in enumerate([
            ("regular", "Regular Player", 0), ("qualifier", "Qualifier", 15),
            ("div3", "Div 3", 20), ("div2", "Div 2", 25), ("div1", "Div 1", 30),
            ("grandmaster", "Grandmaster", 35), ("champion", "Champion", 40),
        ])
    )
    content = f"""
    {page_hero("Drop rates", "Monster <em>Drop Tables</em>",
               "Published rates for every monster, per supporter rank.")}
    <section class="section">
      <div class="container">
        {section_head("Calculator", "Select a Rank")}
        <div class="chip-row" style="justify-content:center;margin-bottom:30px">{chips}</div>
        <div class="with-side">
          <div class="panel rv">
            <div class="panel-head">
              <h3 id="dt-monster">KING BLACK DRAGON</h3>
              <div class="r" id="dt-rank-view">Regular Player — BASE DROP RATES</div>
            </div>
            <div class="panel-body tight">
              <div class="table-wrap">
                <table class="league-table">
                  <thead><tr><th>Item</th><th>Rate</th><th>PKP Value</th><th id="dt-count" style="text-align:right">— DROPS</th></tr></thead>
                  <tbody id="dt-body"></tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="side-col">
            <div class="panel rv">
              <div class="panel-head"><h3>Find a monster</h3></div>
              <div class="panel-body">
                <form id="dt-search" style="display:flex;gap:10px">
                  <input class="input" id="dt-query" placeholder="Search monsters">
                  <button class="btn btn-gold" type="submit"><i class="bi bi-search"></i></button>
                </form>
              </div>
            </div>
            <div class="panel rv">
              <div class="panel-head"><h3>Monster browser</h3></div>
              <div class="panel-body">
                <div class="monster-grid" id="dt-monsters"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>"""
    page("droptable/index.html", "Drop Tables & Rate Calculator — PK League",
         "PK League monster drop tables with a live drop-rate calculator — preview exact "
         "in-game rates for every supporter tier.", "more", content,
         extra_js="assets/js/droptable.js")


# ============================================================ STAFF
def build_staff():
    def group(rank, members):
        cards = "".join(
            f'<div class="staff-card"><span class="staff-av">{m.split()[0][:2].upper()}</span>'
            f'<div><b>{m}</b><span>{rank}</span></div></div>'
            for m in members
        )
        return f"""<div class="staff-group rv">
          <div class="sg-head"><img src="{SKULL_RISK if rank in ('Owner','League Council') else SKULL_COIN}" style="width:20px;height:20px;image-rendering:pixelated" alt="">
          <h3>{rank}</h3><span class="cnt">{len(members)} STAFF MEMBER{'S' if len(members) != 1 else ''}</span></div>
          <div class="staff-grid">{cards}</div>
        </div>"""

    groups = (
        group("Owner", ["Hunter"]) +
        group("League Council", ["Nyx", "Solfar"]) +
        group("Administrator", ["Korvex", "Mirelle"]) +
        group("Community Manager", ["Fable"]) +
        group("Senior Moderator", ["Drako", "Wrenna"]) +
        group("Moderator", ["Onyx", "Talver", "Cressida"]) +
        group("Server Support", ["Perrin", "Luxen", "Maribel", "Rocco"])
    )

    content = f"""
    {page_hero("The team", "PK League <em>Staff List</em>",
               "League staff by in-game rank.")}
    <section class="section">
      <div class="container">
        {section_head("Roster", "Staff Team")}
        {groups}
        <div class="note-strip">
          <i class="bi bi-shield-check"></i>
          <span>Staff never request passwords or item trades. Report impersonation via
          <a href="/support/#report">support</a>.</span>
        </div>
      </div>
    </section>"""
    page("staff/index.html", "Staff List — Meet the PK League Team",
         "Meet the PK League staff — owners, council, moderators and server support, "
         "grouped by in-game rank.", "more", content)


# ============================================================ SUPPORT
def build_support():
    cards = [
        ("bi-envelope", "Email Support",
         "Account, payment and website issues: support@rspkl.com.",
         '<a class="btn btn-outline" href="mailto:support@rspkl.com">SEND AN EMAIL</a>'),
        ("bi-controller", "In-Game Support",
         "::staff contacts an online staff member directly.",
         '<span class="btn btn-outline mono" style="cursor:default">::STAFF IN-GAME</span>'),
        ("bi-chat-dots", "Live Chat Support",
         "Live agent via the chat icon, bottom-right.",
         '<button class="btn btn-outline js-soon" data-soon="Live chat">OPEN LIVE CHAT</button>'),
        ("bi-discord", "Discord Support",
         "Discord tickets for team and community support.",
         '<button class="btn btn-outline js-soon" data-soon="Discord">OPEN DISCORD</button>'),
    ]
    cards_html = "".join(
        f'<div class="support-card rv"><span class="s-ic"><i class="bi {ic}"></i></span>'
        f'<h3>{t}</h3><p>{p}</p>{b}</div>'
        for ic, t, p, b in cards
    )
    faq_items = [
        ("I lost my account — how do I recover it?", "Email support@rspkl.com from the address on the account with your log-in name and creation details. Recovery is handled within 48 hours."),
        ("My purchase did not arrive.", "Deliveries are instant in-game. If anything is missing after a relog, email support@rspkl.com with your order ID — the shop ledger reconciles every 15 minutes."),
        ("How do I report a player?", "Use ::report in-game with the player name, or open a ticket with video evidence. Cheating is reviewed within 24 hours."),
        ("Someone claiming to be staff asked for my password.", "It is an impersonator. Staff never ask for passwords or hold items. Screenshot it and send it to support@rspkl.com immediately."),
    ]
    faq = "".join(
        f"<details><summary>{q}</summary><div class='a'>{a}</div></details>"
        for q, a in faq_items
    )
    content = f"""
    {page_hero("Contact", "PK League <em>Support</em>",
               "Four channels: email, in-game ::staff, live chat, Discord.")}
    <section class="section">
      <div class="container">
        {section_head("Channels", "Contact PK League")}
        <div class="support-grid">{cards_html}</div>
        <div class="safety-note">
          <i class="bi bi-shield-exclamation"></i>
          <span><b>Account safety.</b> Passwords and authentication codes are never
          requested by staff.</span>
        </div>
        <div class="section-head" id="recovery" style="margin-top:54px">
          <div class="kicker">Support</div><h2>Account Recovery &amp; FAQ</h2>
          <div class="diamond"><i></i></div>
        </div>
        <div class="faq rv" style="max-width:820px;margin:0 auto" id="report">{faq}</div>
      </div>
    </section>"""
    page("support/index.html", "Support & Help — PK League",
         "PK League support — email, in-game ::staff, live chat and Discord tickets for "
         "accounts, payments and reports.", "more", content)


# ============================================================ RULES
def build_rules():
    rules = [
        ("No botting or automated input", "Macro clients, auto-clickers and any scripted input are banned. League integrity is enforced by detection + replay review."),
        ("One account per person in ranked play", "Play on your main ladder account. Alts are for content only and may never feed kills, GP or boost another account."),
        ("No RWT (real-world trading)", "Buying or selling league items, accounts or PKP for real currency outside the official shop is a permanent ban."),
        ("No bug abuse", "Found a dupe or exploit? Report it via ::report and get rewarded. Using it silently is a ban and a rollback."),
        ("No scamming or luring outside the wild", "Wilderness luring is part of PK. Scamming — fake trades, stake tricks, impersonation — is not."),
        ("No toxic chat beyond the line", "Banter is the Wilderness. Hate speech, harassment, doxxing or threats end your season immediately."),
        ("No advertising other servers", "No links or names of other RSPS in-game or in Discord."),
        ("Staff decisions are final in tournaments", "Bracket rulings are reviewed on video. Tournament referee decisions stand."),
        ("English in ::yell", "Keep global channels English so staff can moderate. Any language in clan &amp; private chat."),
        ("Chargebacks close the account", "A chargeback on any purchase permanently locks the account and linked accounts until repaid."),
    ]
    rules_html = "".join(
        f'<li><span class="rule-num">RULE {i:02d}</span><span><b>{t}</b> — {d}</span></li>'
        for i, (t, d) in enumerate(rules, 1)
    )
    content = f"""
    {page_hero("League law", "PK League <em>Rules</em>",
               "Ten rules, the punishment ladder, and legal policies.")}
    <section class="section">
      <div class="container">
        {section_head("Season 1", "The Rulebook")}
        <ul class="rules-list rv">{rules_html}</ul>

        <div class="section-head" style="margin-top:54px">
          <div class="kicker">Enforcement</div><h2>Punishment Ladder</h2>
          <div class="diamond"><i></i></div>
        </div>
        <div class="grid-2">
          <div class="panel rv"><div class="panel-head"><h3>Minor offenses</h3></div>
            <div class="panel-body"><ul class="perks">
              <li><i class="bi bi-1-circle"></i>First offense — 24h mute</li>
              <li><i class="bi bi-2-circle"></i>Second offense — 48h mute + 1 event ban</li>
              <li><i class="bi bi-3-circle"></i>Third offense — 7 day ban</li>
            </ul></div></div>
          <div class="panel rv"><div class="panel-head"><h3>Major offenses</h3></div>
            <div class="panel-body"><ul class="perks">
              <li><i class="bi bi-x-circle"></i>Botting / RWT / bug abuse — permanent ban</li>
              <li><i class="bi bi-x-circle"></i>Chargeback — account lock until repaid</li>
              <li><i class="bi bi-x-circle"></i>Hate speech — instant season removal</li>
            </ul></div></div>
        </div>

        <div class="section-head" id="terms" style="margin-top:54px">
          <div class="kicker">Legal</div><h2>Policies</h2>
          <div class="diamond"><i></i></div>
        </div>
        <div class="grid-2" id="privacy">
          <div class="panel rv"><div class="panel-head"><h3>Terms of Service</h3></div>
            <div class="panel-body"><p class="small muted">PK League is an unofficial fan-made
            league and is not affiliated with Jagex Ltd. Accounts and league items remain
            league property. Purchases grant in-game benefits only. We may amend these
            terms with notice on the news page.</p></div></div>
          <div class="panel rv"><div class="panel-head"><h3>Privacy &amp; Refunds</h3></div>
            <div class="panel-body"><p class="small muted">We store only your log-in name,
            hashed password and league history. No personal data is sold or shared.
            Refunds are honored within 48h for undelivered items; delivered digital goods
            are final except where law requires otherwise. Email
            support@rspkl.com to action a refund.</p></div></div>
        </div>
      </div>
    </section>"""
    page("rules/index.html", "Rules — PK League Season Rulebook",
         "PK League rules — the ten golden rules of the league, punishment ladder, terms of "
         "service, privacy and refund policy.", "more", content)


# ============================================================ PROVABLY FAIR
def build_provablyfair():
    content = f"""
    {page_hero("Verification", "Provably <em>Fair</em>",
               "Every box roll, stake and tournament draw is seeded, hashed and player-verifiable.")}
    <section class="section">
      <div class="container">
        {section_head("Method", "The Seed Chain")}
        <div class="pf-steps">
          <div class="step rv"><h3>Server seed</h3>
            <p>The server generates a seed each season and publishes its SHA-256 hash.
            The seed stays sealed until reveal.</p></div>
          <div class="step rv"><h3>Your client seed</h3>
            <p>The client adds its own seed, visible and changeable in settings.
            Neither side alone determines the roll.</p></div>
          <div class="step rv"><h3>The roll</h3>
            <p>Roll = HMAC(server seed, client seed + nonce), deciding box, stake and
            bracket. The server seed is published afterward for verification.</p></div>
        </div>
        <div class="panel rv" style="max-width:860px;margin:34px auto 0">
          <div class="panel-head"><h3>Verify a roll yourself</h3><div class="r">Season 1 demo</div></div>
          <div class="panel-body">
            <div class="field"><label>Published server seed hash</label>
              <div class="hash-out">9f2c1a7e4b8d63f05a2e9c4d1b8f7a3e5d6c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8</div></div>
            <div class="field"><label>Your client seed</label>
              <input class="input" value="golden-skull" readonly></div>
            <div class="field"><label>Example roll — Gold Mystery Box</label>
              <div class="hash-out">HMAC-SHA256 → 0.7412 → item tier 3 — Dragon claws</div></div>
            <p class="small muted">At season launch this panel verifies against the published seeds.</p>
          </div>
        </div>
        <div class="note-strip" style="max-width:860px;margin:26px auto 0">
          <i class="bi bi-patch-check"></i>
          <span>Hashes are committed before play and revealed weekly. A hash that fails
          verification voids and compensates that week&rsquo;s rolls.</span>
        </div>
      </div>
    </section>"""
    page("provablyfair/index.html", "Provably Fair — PK League",
         "PK League provably fair — how seed hashing makes every mystery box roll, stake and "
         "tournament draw verifiable by players.", "more", content)


# ============================================================ 404
def build_404():
    content = f"""
    <div class="hero" style="min-height:70vh">
      <div class="hero-bg"></div>
      <img class="hero-wm" src="{SKULL_RISK}" alt="">
      <div class="hero-inner">
        <div class="hero-kicker">Error 404</div>
        <h1 class="hero-title">Lost in the<span class="line-gold">Wilderness</span></h1>
        <p class="hero-sub">This page does not exist.</p>
        <div class="hero-actions">
          <a class="btn btn-gold btn-lg" href="/"><i class="bi bi-house"></i> BACK TO HOME</a>
          <a class="btn btn-outline btn-lg" href="/download/"><i class="bi bi-play-fill"></i> PLAY NOW</a>
        </div>
      </div>
    </div>"""
    # 404 lives at website root; assets resolve fine from there.
    page("404.html", "404 — Lost in the Wilderness | PK League",
         "Page not found.", "home", content)


def build_extras():
    pages = ["", "download/", "register/", "donate/", "hiscore/", "battles/",
             "killcams/", "killfeed/", "player/", "itemlist/", "droptable/", "staff/", "support/",
             "rules/", "provablyfair/"]
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for p in pages:
        sitemap += f"  <url><loc>{DOMAIN}/{p}</loc></url>\n"
    sitemap += "</urlset>\n"
    with open(os.path.join(ROOT, "sitemap.xml"), "w") as f:
        f.write(sitemap)
    with open(os.path.join(ROOT, "robots.txt"), "w") as f:
        f.write("User-agent: *\nAllow: /\nSitemap: " + DOMAIN + "/sitemap.xml\n")
    print("wrote sitemap.xml, robots.txt")


if __name__ == "__main__":
    build_home()
    build_download()
    build_register()
    build_donate()
    build_hiscore()
    build_player()
    build_battles()
    build_killcams()
    build_killfeed()
    build_vote()
    build_itemlist()
    build_droptable()
    build_staff()
    build_support()
    build_rules()
    build_provablyfair()
    build_404()
    build_extras()
    print("site build complete")
