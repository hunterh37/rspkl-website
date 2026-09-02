#!/usr/bin/env python3
"""RSPKL website generator.

Writes the static site (HTML/robots/sitemap) into website/. Pages are plain
static output committed to the repo, so hosting needs no build step.

Run:  python3 website/tools/build_pages.py
"""
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
    ("/play/", "PLAY", "play"),
    ("/donate/", "DONATE", "donate"),
    ("/hiscore/", "HISCORES", "hiscore"),
    ("/download/", "DOWNLOAD", "download"),
]

MORE_LINKS = [
    ("/vote/", "Vote for a Reward"),
    ("/itemlist/", "Item List"),
    ("/droptable/", "Drop Table"),
    ("sep",),
    ("/staff/", "Staff List"),
    ("/support/", "Support"),
    ("/rules/", "Rules"),
    ("/provablyfair/", "Provably Fair"),
]


def nav_html(active: str) -> str:
    links = "".join(
        f'<a class="nav-link{" active" if key == active else ""}" href="{href}">{label}</a>'
        for href, label, key in NAV_LINKS
    )
    more = "".join(
        '<div class="sep"></div>' if item[0] == "sep" else
        f'<a href="{item[0]}">{item[1]}</a>'
        for item in MORE_LINKS
    )
    mobile = "".join(
        f'<a href="{href}">{label}</a>' for href, label, _ in NAV_LINKS
    ) + "".join(
        f'<a href="{item[0]}">{item[1]}</a>'
        for item in MORE_LINKS if item[0] != "sep"
    )
    return f"""
    <header class="site-header">
      <div class="nav-inner">
        <a class="brand" href="/" aria-label="RSPKL home">
          <img src="{SKULL}" alt="RSPKL golden PK skull">
          <span class="brand-mark">
            <span class="over">Runescape</span>
            <span class="main">PK <span>League</span></span>
          </span>
        </a>
        <nav class="nav" aria-label="Primary">
          {links}
          <div class="has-dropdown">
            <a class="nav-link" href="/vote/">MORE <i class="bi bi-chevron-down" style="font-size:10px"></i></a>
            <div class="dropdown">{more}</div>
          </div>
          <div class="nav-cta">
            <a class="btn btn-gold btn-sm" href="/play/">PLAY NOW <small style="font-size:9px;letter-spacing:.2em">· WEB CLIENT</small></a>
          </div>
        </nav>
        <button class="burger" id="burger" aria-label="Menu"><i class="bi bi-list"></i></button>
      </div>
    </header>
    <div class="mobile-nav" id="mobile-nav">
      {mobile}
      <a class="btn btn-gold btn-block" href="/play/">PLAY NOW — WEB CLIENT</a>
    </div>"""


def footer_html() -> str:
    cols = {
        "RSPKL": [
            ("/play/", "Play in Browser"),
            ("/hiscore/", "Hiscores"),
            ("/download/", "Download"),
            ("soon:Forum", "Forum"),
        ],
        "Account": [
            ("/register/", "Register"),
            ("/donate/", "Donate"),
            ("/vote/", "Vote for a Reward"),
            ("/support/#recovery", "Account Recovery"),
        ],
        "Resources": [
            ("/itemlist/", "Item List"),
            ("/droptable/", "Drop Table"),
            ("/rules/", "Rules"),
            ("/provablyfair/", "Provably Fair"),
            ("soon:Wiki", "Wiki"),
        ],
        "Support": [
            ("/support/", "Contact Us"),
            ("mailto:support@rspkl.com", "Email Support"),
            ("soon:Discord", "Discord Support"),
            ("/staff/", "Staff List"),
            ("/support/#report", "Report a Problem"),
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

    return f"""
    <section class="section-tight">
      <div class="container">
        <div class="cta-band rv">
          <img class="wm" src="{SKULL}" alt="">
          <div class="kicker">The #1 PK League</div>
          <h2>Ready to enter <span class="gold">the League?</span></h2>
          <p>RSPKL is community-driven and supported. The league runs on player support —
          vote daily, gear up in the shop, and climb the divisions.</p>
          <div class="btns">
            <a class="btn btn-gold btn-lg" href="/play/">PLAY NOW</a>
            <a class="btn btn-outline btn-lg js-soon" data-soon="Discord" href="#">JOIN DISCORD</a>
          </div>
        </div>
      </div>
    </section>
    <footer class="site-footer">
      <div class="container">
        <div class="footer-cta">
          <div class="t">Season 1 — The Golden Skull</div>
          <div class="btns">
            <a class="btn btn-gold" href="/play/"><i class="bi bi-play-fill"></i> PLAY NOW</a>
            <a class="btn btn-outline js-soon" data-soon="Discord" href="#"><i class="bi bi-discord"></i> JOIN DISCORD</a>
          </div>
        </div>
        <div class="footer-grid">{grid}</div>
        <div class="footer-bottom">
          <div>&copy; <span class="js-year">2026</span> RUNESCAPE PK LEAGUE — All Rights Reserved.</div>
          <div class="lang"><i class="bi bi-globe2"></i>
            <select aria-label="Language">
              <option value="en" selected>🇺🇸 English</option>
              <option value="es">🇪🇸 Español</option>
            </select>
          </div>
          <div class="legal">
            <a href="/rules/#terms">Terms of Service</a>
            <a href="/rules/#privacy">Privacy Policy</a>
            <a href="/rules/#refund">Refund Policy</a>
          </div>
        </div>
      </div>
    </footer>
    <div class="overlay" id="overlay"></div>
    <aside class="cart-drawer" id="cart-drawer" aria-label="Cart">
      <div class="cart-head">
        <h3><i class="bi bi-trophy"></i> Your Cart</h3>
        <button class="cart-close" id="cart-close" aria-label="Close cart"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="cart-items">
        <div id="cart-items"></div>
        <p class="cart-empty" id="cart-empty">Your cart is empty — head to the shop.</p>
      </div>
      <div class="cart-foot">
        <div class="cart-total">TOTAL <b id="cart-total">$0.00 USD</b></div>
        <button class="btn btn-gold btn-block" id="cart-checkout">SECURE CHECKOUT</button>
        <span class="btn-note">Checkout activates with Season 1</span>
      </div>
    </aside>
    <button class="cart-fab" id="cart-fab"><i class="bi bi-trophy"></i> CART <span class="n" id="cart-count">0</span></button>
    <div class="toast" id="toast" role="status"></div>
    <script src="/assets/js/main.js"></script>"""


def page(path: str, title: str, desc: str, active: str, content: str,
          extra_js: str = "") -> None:
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
  <div class="notif-bar">
    <div class="notif-inner">
      <div class="notif-left">
        <img class="sk" src="{SKULL}" alt="">
        <span>RSPKL SEASON 1 — GOLDEN SKULL TOURNAMENT IN <b id="notif-countdown" class="notif-count">—</b></span>
      </div>
      <div class="notif-right">
        <span class="dot"></span>
        <span><b class="js-players">1,284</b> REAL PLAYERS ONLINE</span>
        <a href="/play/">JOIN THEM <i class="bi bi-chevron-right"></i></a>
      </div>
    </div>
  </div>
  {nav_html(active)}
  <main>
  {content}
  </main>
  {footer_html()}
  {f'<script src="{extra_js if extra_js.startswith("/") else "/" + extra_js}"></script>' if extra_js else ''}
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


# ============================================================ HOME
def build_home():
    news = ""
    items = [
        ("news-art art-a", "Season 1: The Golden Skull Opens",
         "September 1, 2026 12:00:00", "League Council",
         "Season 1 of the PK League is live. Five divisions, placement matches, and a "
         "250M PKP prize pool await. Step through the ::league portal to play your "
         "placement bracket and claim your Golden Skull badge."),
        ("news-art art-b", "Hybrid Tournament Series Announced",
         "August 18, 2026 10:00:00", "League Council",
         "Weekly hybrid tournaments begin with Season 1 — NH, Zerk and Max brackets every "
         "Saturday. Winners take division points, exclusive capes and a place on the "
         "Season trophy wall."),
        ("news-art art-c", "Wilderness Rework: Bounty Tiers & Target Teleports",
         "July 29, 2026 16:20:00", "League Council",
         "The Wilderness gets league justice: bounty tiers with escalating PKP payouts, "
         "target teleports to your hunter, and hotspots that rotate every 30 minutes. "
         "Risk is back on the menu."),
    ]
    for art, h3, date, by, body in items:
        news += f"""<article class="news-card rv">
          <div class="{art}"><img class="wm" src="{SKULL}" alt=""></div>
          <div class="news-body">
            <div class="news-meta"><span><i class="bi bi-calendar3"></i> {date.split(' ')[0]}</span>
            <span class="by"><i class="bi bi-person"></i> by {by}</span></div>
            <h3>{h3}</h3>
            <p>{body}</p>
            <a class="read-more js-soon" data-soon="The full news archive" href="#">READ MORE <i class="bi bi-arrow-right"></i></a>
          </div>
        </article>"""

    forum_items = [
        ("How do I climb out of Div 3?", "Sep 01, 2026 20:37", "Hybrid King"),
        ("Best inventory for NH brackets?", "Aug 29, 2026 11:04", "Ice Barrage"),
        ("Season 1 prize pool breakdown", "Aug 26, 2026 09:41", "League Council"),
        ("Clips: Golden Skull ace @ 30 wild", "Aug 23, 2026 17:11", "Gold Skull Gus"),
        ("Placement matches — how they work", "Aug 20, 2026 07:16", "TankBrid"),
    ]
    forum = "".join(
        f"""<div class="forum-item">
          <i class="bi bi-chat-left-text forum-ic"></i>
          <div><b class="js-soon" data-soon="The forum" style="cursor:pointer">{t}</b>
          <time>{d} · by {b}</time></div>
        </div>"""
        for t, d, b in forum_items
    )

    quick = "".join(
        f"""<a class="quick-link rv" href="{href}"><span class="q-ic"><i class="bi bi-{ic}"></i></span>{label}<i class="bi bi-arrow-up-right"></i></a>"""
        for href, ic, label in [
            ("/rules/", "shield-check", "Rules"),
            ("/itemlist/", "box-seam", "Item List"),
            ("/droptable/", "table", "Drop Table"),
            ("/hiscore/", "trophy", "Hiscores"),
        ]
    )

    content = f"""
    <div class="hero">
      <div class="hero-bg"></div>
      <img class="hero-wm" src="{SKULL}" alt="">
      <div class="hero-inner">
        <div class="hero-kicker">Old School · 317 · PvP-First</div>
        <h1 class="hero-title">Prepare for the<span class="line-gold">PK League</span></h1>
        <p class="hero-sub">Join the most competitive Wilderness in the scene. Five divisions,
        weekly tournaments, bounty tiers and a community that lives for the kill.
        Your legend starts here.</p>
        <div class="hero-actions">
          <a class="btn btn-gold btn-lg" href="/play/"><i class="bi bi-play-fill"></i> WEB CLIENT</a>
          <a class="btn btn-outline btn-lg" href="/play/#mobile"><i class="bi bi-phone"></i> MOBILE CLIENT</a>
          <a class="btn btn-outline btn-lg" href="/download/"><i class="bi bi-download"></i> DOWNLOAD</a>
          <a class="btn btn-outline btn-lg js-soon" data-soon="Discord" href="#"><i class="bi bi-discord"></i> JOIN DISCORD</a>
        </div>
        <div class="hero-stats">
          <span class="pill pill-gold">Season 1 · Sept 18</span>
          <span class="pill"><span class="dot"></span> <b class="js-players" style="color:var(--gold)">1,284</b> players online</span>
          <span class="pill">5 Divisions · 250M PKP prize pool</span>
        </div>
      </div>
      <div class="scroll-cue">Scroll for more</div>
    </div>

    <section class="section">
      <div class="container">
        {section_head("Choose your arena", "Play Anywhere, Instantly", "No download required. The league comes to your browser, phone or desktop.")}
        <div class="client-grid">
          <a class="client-card rv" href="/play/">
            <img class="sk-mini" src="{SKULL_COIN}" alt="">
            <h3>Web Client</h3><p>Play instantly in your browser</p>
            <span class="btn btn-gold btn-sm">LAUNCH</span>
          </a>
          <a class="client-card rv" href="/play/#mobile">
            <span class="glyph"><i class="bi bi-phone"></i></span>
            <h3>Mobile Client</h3><p>Play instantly on your phone</p>
            <span class="btn btn-outline btn-sm">LAUNCH</span>
          </a>
          <a class="client-card rv" href="/download/">
            <span class="glyph"><i class="bi bi-download"></i></span>
            <h3>Download</h3><p>Windows · macOS · Linux</p>
            <span class="btn btn-outline btn-sm">GET THE CLIENT</span>
          </a>
          <a class="client-card rv js-soon" data-soon="Discord" href="#">
            <span class="glyph"><i class="bi bi-discord"></i></span>
            <h3>Join Discord</h3><p>News, brackets &amp; support</p>
            <span class="btn btn-outline btn-sm">OPEN INVITE</span>
          </a>
        </div>
      </div>
    </section>

    <section class="section" id="news">
      <div class="container">
        {section_head("League dispatch", "The Latest News from RSPKL", "Season updates, tournament results and wilderness intel.")}
        <div class="home-grid">
          <div class="news-stack">{news}
            <div class="text-center"><a class="btn btn-outline js-soon" data-soon="The full news archive" href="#">READ MORE NEWS</a></div>
          </div>
          <aside>
            <div class="side-card spotlight rv">
              <h3>Media Spotlight</h3>
              <img src="{SKULL}" alt="Golden PK skull">
              <p>Clip your aces. Season highlight reels air on the league channel every week.</p>
              <a class="btn btn-gold btn-sm js-soon" data-soon="YouTube highlights" href="#">WATCH HIGHLIGHTS</a>
            </div>
            <div class="side-card rv">
              <h3>Follow the League</h3>
              <div class="social-row"><span class="social-ic"><i class="bi bi-discord"></i></span>
                <div class="social-copy"><b>Discord</b><span>Brackets, support &amp; pings</span></div>
                <i class="bi bi-arrow-up-right"></i></div>
              <div class="social-row"><span class="social-ic"><i class="bi bi-youtube"></i></span>
                <div class="social-copy"><b>YouTube</b><span>Highlights &amp; guides</span></div>
                <i class="bi bi-arrow-up-right"></i></div>
              <div class="social-row"><span class="social-ic"><i class="bi bi-instagram"></i></span>
                <div class="social-copy"><b>Instagram</b><span>Clips &amp; art drops</span></div>
                <i class="bi bi-arrow-up-right"></i></div>
            </div>
            <div class="side-card rv">
              <h3>Forum Activity</h3>
              {forum}
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        {section_head("Everything in one place", "Quick Links")}
        <div class="quick-grid">{quick}</div>
      </div>
    </section>

    <section class="section-tight">
      <div class="container">
        <div class="stat-strip rv">
          <div class="stat"><div class="v">5</div><div class="k">Divisions</div></div>
          <div class="stat"><div class="v">42</div><div class="k">Wilderness hotspots</div></div>
          <div class="stat"><div class="v">10</div><div class="k">Ranked ladders</div></div>
          <div class="stat"><div class="v">99.9%</div><div class="k">League uptime</div></div>
        </div>
      </div>
    </section>"""

    page("index.html", "RuneScape PK League — The #1 PvP League",
         "RSPKL — competitive Old School PvP. Five divisions, weekly hybrid tournaments, "
         "bounty tiers and a 250M PKP prize pool. Play instantly in your browser.",
         "home", content)


# ============================================================ PLAY
def build_play():
    content = f"""
    {page_hero("Web client", "Play RSPKL <em>Instantly</em>",
               "No download, no registration — pick a username and the league is yours.")}
    <section class="section">
      <div class="container">
        <div class="client-frame rv">
          <div class="client-titlebar">
            <span><i class="bi bi-trophy"></i> RSPKL — Season 1 Client</span>
            <span class="dots"><i></i><i></i><i></i></span>
          </div>
          <div class="client-canvas">
            <img class="wm" src="{SKULL}" alt="">
            <form class="login-card" id="launch-form">
              <img src="{SKULL}" alt="Golden PK skull">
              <h2>RuneScape PK League</h2>
              <div class="sub">Season 1 · The Golden Skull</div>
              <div class="field" style="text-align:left">
                <label for="lc-user">Log-in name</label>
                <input class="input" id="lc-user" autocomplete="username" placeholder="Choose your name">
              </div>
              <div class="field" style="text-align:left">
                <label for="lc-pass">Password</label>
                <input class="input" type="password" id="lc-pass" autocomplete="current-password" placeholder="New or existing">
              </div>
              <button class="btn btn-gold btn-block btn-lg" id="launch-btn" type="submit">
                <i class="bi bi-play-fill"></i> LAUNCH CLIENT
              </button>
              <span class="btn-note">Accounts are created on first login</span>
            </form>
          </div>
        </div>
        <div class="status-strip">
          <span>WORLDS <b>2</b></span>
          <span>UPTIME <b>99.9%</b></span>
          <span class="live"><span class="dot"></span> <b class="js-players">1,284</b> ONLINE</span>
          <span>CLIENT <b id="client-status">STANDBY</b></span>
        </div>
        <div class="note-strip">
          <i class="bi bi-info-circle"></i>
          <span>The web client deployment finalises with Season 1. Your login is saved to
          this device — when the league gate opens you will log straight into the lobby.</span>
        </div>
      </div>
    </section>
    <section class="section" id="mobile">
      <div class="container">
        {section_head("Any device", "Desktop or Mobile", "The same league, everywhere. Choose how you want to play.")}
        <div class="grid-2">
          <div class="panel choice-card rv">
            <span class="glyph"><i class="bi bi-display"></i></span>
            <h3>Desktop Browser</h3>
            <p>Full-screen action with the complete interface suite. Launches straight
            from this page — no install, automatic updates.</p>
            <a class="btn btn-gold" href="#top">OPEN WEB CLIENT</a>
          </div>
          <div class="panel choice-card rv">
            <span class="glyph"><i class="bi bi-phone"></i></span>
            <h3>Mobile Browser</h3>
            <p>Optimized touch controls for PK on the move. Same account, same ladder,
            same Wilderness — right in your pocket.</p>
            <a class="btn btn-outline js-soon" data-soon="The mobile client" href="#">OPEN MOBILE CLIENT</a>
          </div>
        </div>
      </div>
    </section>"""
    page("play/index.html", "Web Client — Play RSPKL Instantly | RuneScape PK League",
         "Play RSPKL instantly in your browser or on mobile. No download required — "
         "accounts are created on first login.", "play", content, extra_js="assets/js/play.js")


# ============================================================ DOWNLOAD
def build_download():
    os_cards = ""
    for ic, name, feats, btn, hot in [
        ("bi-windows", "Windows", ["Automatic updates", "Windows 10 &amp; 11", "RSPKL64.exe — 38MB", "Install tutorial"], "DOWNLOAD (64-BIT)", True),
        ("bi-apple", "Mac OS", ["Automatic updates", "macOS 12 – 15", "RSPKL.dmg — 115MB", "Install tutorial"], "DOWNLOAD", False),
        ("bi-linux", "Linux", ["Automatic updates", "Debian, Ubuntu &amp; more", "Unzip &amp; launch RSPKL", "RSPKL.jar — 80KB"], "DOWNLOAD", False),
        ("bi-filetype-java", "Java JAR", ["Automatic updates", "All operating systems", "Requires Java 11+", "RSPKL.jar — 80KB"], "DOWNLOAD", False),
    ]:
        ul = "".join(f"<li>{f}</li>" for f in feats)
        os_cards += f"""<div class="os-card rv">
          <span class="os-ic"><i class="bi {ic}"></i></span>
          <h3>{name}</h3>
          <ul>{ul}</ul>
          <a class="btn {'btn-gold' if hot else 'btn-outline'} btn-block js-soon" data-soon="The {name} installer" href="#">{btn}</a>
        </div>"""

    content = f"""
    {page_hero("Client downloads", "Take the League <em>Home</em>",
               "Prefer a native client? Every build auto-updates. Or skip the download and play in your browser.")}
    <section class="section">
      <div class="container">
        {section_head("No download required", "Instant Play", "The fastest way into the Wilderness.")}
        <div class="grid-2">
          <div class="panel choice-card rv">
            <span class="glyph"><i class="bi bi-window-desktop"></i></span>
            <h3>Web Client</h3>
            <p>Launch instantly in your desktop browser. No download, no registration,
            always up to date.</p>
            <a class="btn btn-gold" href="/play/">PLAY ON BROWSER</a>
          </div>
          <div class="panel choice-card rv">
            <span class="glyph"><i class="bi bi-phone"></i></span>
            <h3>Mobile Client</h3>
            <p>Launch instantly on your phone. Same account, same ladder, touch-tuned
            interfaces.</p>
            <a class="btn btn-outline" href="/play/#mobile">PLAY ON MOBILE</a>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        {section_head("Native clients", "Download the Client",
               "Select your operating system below. All clients update automatically.")}
        <div class="os-grid">{os_cards}</div>
        <div class="note-strip">
          <i class="bi bi-tools"></i>
          <span><b>Problems loading?</b> Try the RSPKL debug tool + uninstaller, or use an
          alternative installer (no admin required). Downloads unlock with Season 1 —
          join Discord to get pinged the moment they go live.</span>
        </div>
      </div>
    </section>"""
    page("download/index.html", "Downloads — RSPKL Client | RuneScape PK League",
         "Download the RSPKL client for Windows, macOS, Linux or Java — or play instantly "
         "in your browser. All clients update automatically.", "download", content)


# ============================================================ REGISTER
def build_register():
    content = f"""
    {page_hero("Create your account", "Ready in <em>Seconds</em>",
               "No website sign-up required. Your account is created the first time you log in.")}
    <section class="section">
      <div class="container">
        {section_head("Choose how you want to play", "Pick a Client",
               "Open a client, choose a username and password, and your account is created automatically.")}
        <div class="grid-2">
          <div class="panel choice-card rv">
            <span class="glyph"><i class="bi bi-window-desktop"></i></span>
            <h3>Web Client</h3>
            <p>Play instantly in your desktop browser. Your account is created when you
            log in for the first time.</p>
            <a class="btn btn-gold" href="/play/">OPEN WEB CLIENT</a>
          </div>
          <div class="panel choice-card rv">
            <span class="glyph"><i class="bi bi-phone"></i></span>
            <h3>Mobile Client</h3>
            <p>Play instantly on your phone. Your account is created when you log in for
            the first time.</p>
            <a class="btn btn-outline" href="/play/#mobile">OPEN MOBILE CLIENT</a>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        {section_head("How it works", "Three Steps to the Wilderness")}
        <div class="steps">
          <div class="step rv"><h3>Open the Client</h3>
            <p>Use the recommended client above to reach the login screen.</p></div>
          <div class="step rv"><h3>Choose your Login</h3>
            <p>Enter any username and password you would like to use.</p></div>
          <div class="step rv"><h3>Start Playing</h3>
            <p>If the username is available, your new account is created instantly.</p></div>
        </div>
        <div class="note-strip">
          <i class="bi bi-exclamation-triangle"></i>
          <span>Username already taken? If you see “Invalid username or password,” simply
          try another username. Prefer the downloadable desktop client?
          <a href="/download/">View downloads</a>.</span>
        </div>
      </div>
    </section>"""
    page("register/index.html", "Create Your Account — Play Instantly | RuneScape PK League",
         "Create your RSPKL account — no website sign-up required. Your account is "
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
        ("How fast is delivery?", "Credits, ranks and items deliver instantly in-game — if you are online you will see the reward within seconds. Offline? It is waiting in your bank on next login."),
        ("What payment methods are accepted?", "All major cards plus regional methods via the league checkout. Currency is converted automatically at daily rates."),
        ("Can I upgrade my rank later?", "Yes — pay the difference at any time. Your tier perks upgrade immediately on claim."),
        ("What does the * value mean?", "The PKP value shows what the purchase would be worth if traded for player-kill points on the league market."),
        ("Do ranks affect combat balance?", "Never. Ranks unlock convenience and cosmetics — combat power stays on your hands."),
    ]
    faq = "".join(
        f"<details><summary>{q}</summary><div class='a'>{a}</div></details>"
        for q, a in faq_items
    )

    content = f"""
    {page_hero("Support the league", "RSPKL <em>Shop</em>",
               "Every purchase keeps the league online and funds the Season prize pools. Use the buttons at the bottom of the page for extra information.")}
    <section class="section">
      <div class="container">
        <div class="shop-strip rv">
          <span><b>⚡</b> Instant in-game delivery</span>
          <span><b>🔒</b> Secure checkout</span>
          <span><b>🧑‍💻</b> 24/7 support available</span>
          <span><b>🏆</b> Most popular: $50 League Credits</span>
        </div>

        {section_head("Top up", "League Credits", "Spend on ranks, boxes and the seasonal shop.")}
        <div class="shop-grid">{credits}</div>

        {section_head("Climb the ladder", "Supporter Ranks",
               "Six tiers of convenience, cosmetics and boosted drop rates. Combat power is never for sale.")}
        <div class="shop-grid">{ranks}</div>

        {section_head("Straight to the market", "League Points", "PK points delivered straight to your pouch.")}
        <div class="shop-grid">{points}</div>

        {section_head("Roll the bones", "Mystery Boxes",
               "Seeded, provably fair — see the Provably Fair page for how rolls are verified.")}
        <div class="shop-grid">{boxes_html}</div>

        {section_head("Unlock &amp; upgrade", "Scrolls &amp; Lamps")}
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
    page("donate/index.html", "RSPKL Shop — Donations | RuneScape PK League",
         "Support RSPKL and climb the tiers — league credits, supporter ranks, mystery "
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
    {page_hero("Ladders", "RSPKL <em>Hiscores</em>",
               "Every kill counts. Track the ladders across combat, skills, LMS and monster killcounts.")}
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
    page("hiscore/index.html", "Hiscores — RSPKL Ladders | RuneScape PK League",
         "RSPKL hiscores — top kills, KDR, Elo, streaks, skills, LMS rating and monster "
         "killcounts across Normal and Hardcore PvP.", "hiscore", content,
         extra_js="assets/js/hiscore.js")


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
    {page_hero("Support the league", "Vote for <em>RSPKL</em>",
               "Help the league climb the toplists and pocket rewards for it. Every vote brings new players to the Wilderness.")}
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
                <p class="small muted"> toplists are how new players find the league. Higher rank
                — more fresh blood in the Wilderness. Voting takes under a minute per site and
                pays you every 12 hours.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>"""
    page("vote/index.html", "Vote for a Reward — RSPKL | RuneScape PK League",
         "Vote for RSPKL on the toplists and claim vote credits and PKP in-game every "
         "12 hours. Streak rewards include the Golden Skull token.", "more", content,
         extra_js="assets/js/vote.js")


# ============================================================ ITEMLIST
def build_itemlist():
    content = f"""
    {page_hero("Item database", "RSPKL <em>Item List</em>",
               "Search by item name or ID to view its in-game stats. Browse the complete league item database.")}
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
          <span>Sample database slice — the full 24,000+ item index loads from the league
          cache when Season 1 opens.</span>
        </div>
      </div>
    </section>"""
    page("itemlist/index.html", "Item List — RSPKL Item Database | RuneScape PK League",
         "Browse the RSPKL item database — search by name or ID, view every item in the "
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
    {page_hero("Drop transparency", "Monster <em>Drop Tables</em>",
               "Every rate in the league, published. Pick your rank to preview the exact drop rates you receive in-game.")}
    <section class="section">
      <div class="container">
        {section_head("Drop-rate calculator", "Choose Your Rank")}
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
    page("droptable/index.html", "Drop Tables & Rate Calculator — RSPKL | RuneScape PK League",
         "RSPKL monster drop tables with a live drop-rate calculator — preview exact "
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
    {page_hero("The league office", "RSPKL <em>Staff List</em>",
               "Meet the people who keep the league fair, welcoming and running smoothly — grouped by in-game rank.")}
    <section class="section">
      <div class="container">
        {section_head("Official staff team", "Our Team")}
        {groups}
        <div class="note-strip">
          <i class="bi bi-shield-check"></i>
          <span>Staff will never ask for your password or ask you to trade items to
          “verify” an account. Report anyone who does via <a href="/support/#report">support</a>.</span>
        </div>
      </div>
    </section>"""
    page("staff/index.html", "Staff List — Meet the RSPKL Team | RuneScape PK League",
         "Meet the RSPKL staff — owners, council, moderators and server support, "
         "grouped by in-game rank.", "more", content)


# ============================================================ SUPPORT
def build_support():
    cards = [
        ("bi-envelope", "Email Support",
         "For account, payment or website help, send us an email at support@rspkl.com.",
         '<a class="btn btn-outline" href="mailto:support@rspkl.com">SEND AN EMAIL</a>'),
        ("bi-controller", "In-Game Support",
         "Already in game? Use ::staff to contact an online staff member directly.",
         '<span class="btn btn-outline mono" style="cursor:default">::STAFF IN-GAME</span>'),
        ("bi-chat-dots", "Live Chat Support",
         "Chat with a support agent using the chat icon in the bottom-right corner.",
         '<button class="btn btn-outline js-soon" data-soon="Live chat">OPEN LIVE CHAT</button>'),
        ("bi-discord", "Discord Support",
         "Open a support ticket in Discord for fast help from our team and community.",
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
    {page_hero("We have your back", "RSPKL <em>Support</em>",
               "Choose the fastest way to reach the team. Account help, payments or a wild report — pick a channel.")}
    <section class="section">
      <div class="container">
        {section_head("Support center", "How to Contact RSPKL",
               "Select the option that best matches what you need.")}
        <div class="support-grid">{cards_html}</div>
        <div class="safety-note">
          <i class="bi bi-shield-exclamation"></i>
          <span><b>Keep your account safe.</b> Never share your password or authentication
          codes with anyone — including anyone claiming to be staff.</span>
        </div>
        <div class="section-head" id="recovery" style="margin-top:54px">
          <div class="kicker">Support</div><h2>Account Recovery &amp; FAQ</h2>
          <div class="diamond"><i></i></div>
        </div>
        <div class="faq rv" style="max-width:820px;margin:0 auto" id="report">{faq}</div>
      </div>
    </section>"""
    page("support/index.html", "Support & Help — RSPKL | RuneScape PK League",
         "RSPKL support — email, in-game ::staff, live chat and Discord tickets for "
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
    {page_hero("League law", "RSPKL <em>Rules</em>",
               "Ten rules keep the league competitive and fair. Ignorance is not a defence — read them once, then go skulled.")}
    <section class="section">
      <div class="container">
        {section_head("The golden rules", "Season Rulebook")}
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
            <div class="panel-body"><p class="small muted">RSPKL is an unofficial fan-made
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
    page("rules/index.html", "Rules — RSPKL Season Rulebook | RuneScape PK League",
         "RSPKL rules — the ten golden rules of the league, punishment ladder, terms of "
         "service, privacy and refund policy.", "more", content)


# ============================================================ PROVABLY FAIR
def build_provablyfair():
    content = f"""
    {page_hero("Nothing up our sleeve", "Provably <em>Fair</em>",
               "Every mystery box roll, duel stake and tournament draw in RSPKL is seeded, hashed and verifiable by you.")}
    <section class="section">
      <div class="container">
        {section_head("How it works", "The Seed Chain")}
        <div class="pf-steps">
          <div class="step rv"><h3>Server seed</h3>
            <p>Before each season the server generates a random seed and publishes its
            SHA-256 hash. The seed stays sealed until the reveal.</p></div>
          <div class="step rv"><h3>Your client seed</h3>
            <p>Your client adds its own seed — visible to you, changeable any time in
            settings. Neither side alone can move the roll.</p></div>
          <div class="step rv"><h3>The roll</h3>
            <p>Roll = HMAC(server seed, client seed + nonce). The result decides your box,
            your stake, your bracket. Then we publish the server seed to verify it all.</p></div>
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
            <p class="small muted">When the season server goes live this panel runs the
            real verification against the published seeds.</p>
          </div>
        </div>
        <div class="note-strip" style="max-width:860px;margin:26px auto 0">
          <i class="bi bi-patch-check"></i>
          <span>Hashes are committed before anyone plays and revealed after each season
          week. If the hash does not verify, that week’s rolls are voided and comped.</span>
        </div>
      </div>
    </section>"""
    page("provablyfair/index.html", "Provably Fair — RSPKL | RuneScape PK League",
         "RSPKL provably fair — how seed hashing makes every mystery box roll, stake and "
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
        <p class="hero-sub">This page got PKed. Teleport back to safety — the league is waiting.</p>
        <div class="hero-actions">
          <a class="btn btn-gold btn-lg" href="/"><i class="bi bi-house"></i> BACK TO HOME</a>
          <a class="btn btn-outline btn-lg" href="/play/"><i class="bi bi-play-fill"></i> PLAY NOW</a>
        </div>
      </div>
    </div>"""
    # 404 lives at website root; assets resolve fine from there.
    page("404.html", "404 — Lost in the Wilderness | RuneScape PK League",
         "Page not found.", "home", content)


def build_extras():
    pages = ["", "play/", "download/", "register/", "donate/", "hiscore/", "vote/",
             "itemlist/", "droptable/", "staff/", "support/", "rules/", "provablyfair/"]
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
    build_play()
    build_download()
    build_register()
    build_donate()
    build_hiscore()
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
