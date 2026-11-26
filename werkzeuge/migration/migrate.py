#!/usr/bin/env python3
"""Einmalige Migration: WordPress-Export (raw/*.json) -> Astro-Inhalte (site/src/content).

Aufruf:  python3 tools/migrate.py
Liest raw/posts.json, raw/pages.json, raw/media.json, raw/galleries.json
(Exporte der oeffentlichen WordPress-REST-API) und schreibt Markdown + Bilder.
"""
import base64, hashlib, html, io, json, os, re, subprocess, sys, unicodedata
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse, unquote, parse_qs

from bs4 import BeautifulSoup, NavigableString
from markdownify import MarkdownConverter
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'raw')
SITE = os.path.join(ROOT, 'site')
CONTENT = os.path.join(SITE, 'src', 'content')
FILES = os.path.join(SITE, 'public', 'dateien')
CACHE = os.path.join(RAW, 'files')
HOST = 'fmc-dietzenbach.org'
BASE = 'https://' + HOST

IMG_EXT = ('.jpg', '.jpeg', '.png', '.gif', '.webp')
DOC_EXT = ('.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.mp4', '.mov')

posts = json.load(open(os.path.join(RAW, 'posts.json')))
pages = json.load(open(os.path.join(RAW, 'pages.json')))
media = {m['id']: m for m in json.load(open(os.path.join(RAW, 'media.json')))}
cats = {c['id']: c for c in json.load(open(os.path.join(RAW, 'categories.json')))}
galleries = json.load(open(os.path.join(RAW, 'galleries.json')))

redirects = []   # (alt, neu)
report = []      # Hinweise fuer den Abschlussbericht


# ---------------------------------------------------------------- Helfer
def slugify(s):
    s = s.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    s = s.replace('Ä', 'Ae').replace('Ö', 'Oe').replace('Ü', 'Ue')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def cache_path(url):
    p = urlparse(url)
    return os.path.join(CACHE, unquote(p.path).lstrip('/'))


def download(url):
    """Laedt url in den Cache; gibt Pfad oder None zurueck."""
    dst = cache_path(url)
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return dst
    if os.path.exists(dst + '.404'):
        return None
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    for _ in range(3):
        r = subprocess.run(['curl', '-sS', '-L', '--max-time', '180', '-o', dst + '.part', '-w', '%{http_code}', url],
                           capture_output=True, text=True)
        if r.stdout.strip() == '200':
            os.replace(dst + '.part', dst)
            return dst
        if r.stdout.strip() in ('404', '403', '410'):
            break
    if os.path.exists(dst + '.part'):
        os.remove(dst + '.part')
    open(dst + '.404', 'w').close()
    return None


def original_url(url):
    """Aus einer WordPress-Thumbnail-URL (…-300x200.jpg) die Original-URL machen."""
    return re.sub(r'-\d{2,4}x\d{2,4}(\.[A-Za-z]+)$', r'\1', url)


def save_image(src_path, dst_dir, name, maxpx=1920, quality=82):
    """Bild verkleinert als JPEG (oder PNG bei Transparenz) speichern; gibt Dateinamen zurueck."""
    stem = slugify(os.path.splitext(name)[0]) or 'bild'
    try:
        im = Image.open(src_path)
        im = ImageOps.exif_transpose(im)
    except Exception as e:  # noqa
        report.append(f'Bild nicht lesbar: {src_path} ({e})')
        return None
    # PNG nur behalten, wenn das Bild wirklich durchsichtige Stellen hat
    alpha = (im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 250) or (im.mode == 'P' and 'transparency' in im.info)
    ext = '.png' if alpha else '.jpg'
    out = stem + ext
    n = 2
    while os.path.exists(os.path.join(dst_dir, out)) and getattr(save_image, 'seen', {}).get((dst_dir, out)) != src_path:
        out = f'{stem}-{n}{ext}'
        n += 1
    save_image.seen[(dst_dir, out)] = src_path
    dst = os.path.join(dst_dir, out)
    if os.path.exists(dst):
        return out
    os.makedirs(dst_dir, exist_ok=True)
    im.thumbnail((maxpx, maxpx), Image.LANCZOS)
    if alpha:
        im.save(dst, optimize=True)
    else:
        im.convert('RGB').save(dst, 'JPEG', quality=quality, optimize=True, progressive=True)
    return out


save_image.seen = {}


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def write_entry(dirpath, front, body):
    os.makedirs(dirpath, exist_ok=True)
    lines = ['---']
    for k, v in front.items():
        if v is None or v == [] or v == '':
            continue
        if isinstance(v, list):
            lines.append(f'{k}:')
            lines += [f'  - {yaml_str(x)}' for x in v]
        elif isinstance(v, bool):
            lines.append(f'{k}: {"true" if v else "false"}')
        elif k == 'datum' or isinstance(v, int):
            lines.append(f'{k}: {v}')
        else:
            lines.append(f'{k}: {yaml_str(v)}')
    lines.append('---')
    with open(os.path.join(dirpath, 'index.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n\n' + body.strip() + '\n')


# ---------------------------------------------------------------- URL-Zuordnung
PAGE_MAP = {  # alter Slug -> neuer Slug (None = Seite entfaellt / Sondervorlage)
    'wir': 'ueber-uns', 'jugend': 'jugend', 'gastpiloten': 'gastpiloten', 'anfahrt': 'anfahrt',
    'kontakt': 'kontakt', 'downloads': 'downloads', 'datenschutzerklaerung': 'datenschutz',
    'impressum': 'impressum', 'termine': 'termine', 'videos': 'videos',
}
PAGE_REDIRECT_ONLY = {
    'impressionen': '/impressionen/', 'i2014': '/impressionen/#2014', 'i2015': '/impressionen/#2015',
    'i2016': '/impressionen/#2016', '2017-2': '/impressionen/#2017', '2018-2': '/impressionen/#2018',
    '2019-2': '/impressionen/#2019', 'galerie': '/impressionen/', 'wetter': '/wetter/',
    'bauberichte': '/aktuelles/kategorie/baubericht/', 'bembel-crawlers': '/aktuelles/kategorie/bembel-crawler/',
    'bembel-crawlers-2': '/aktuelles/kategorie/bembel-crawler/',
}
POST_TITLES = {
    '1957-2': 'Wasserflugtreffen des FMCD am 17. und 18. Oktober 2026',
    '1884-2': 'Zweimal „Treppchen“ für heimische Modellflieger',
    '1501-2': 'Baubericht Dornier Do 24 T',
    '1346-2': 'Bembel Crawler – Impressionen',
    '1249-2': 'Veranstaltungen des FMCD 2023',
}
POST_AS_PAGE = {'der-vorstand-des-fmcd': 'vorstand'}
POST_SKIP = {'galerie'}  # reine Galerie-Uebersicht des alten Plugins
CAT_MAP = {
    'allgemein': 'Aktuelles', 'startseite': None, 'veranstaltungen': 'Veranstaltungen', 'baubericht': 'Baubericht',
    'kruschelkiste': 'Kruschelkiste', 'bembel-crawler': 'Bembel Crawler', 'verein': 'Verein', 'vorstand': 'Verein',
}

link_map = {}  # alter Pfad -> neuer Pfad
attach_map = {urlparse(m['link']).path: m['source_url'] for m in media.values() if m.get('link')}


def post_slug(p):
    title = POST_TITLES.get(p['slug']) or html.unescape(p['title']['rendered'])
    s = slugify(title)[:60].strip('-')
    return s


for p in pages:
    old = urlparse(p['link']).path
    if p['slug'] in PAGE_MAP:
        link_map[old] = f"/{PAGE_MAP[p['slug']]}/"
    elif p['slug'] in PAGE_REDIRECT_ONLY:
        link_map[old] = PAGE_REDIRECT_ONLY[p['slug']]
for p in posts:
    old = urlparse(p['link']).path
    if p['slug'] in POST_AS_PAGE:
        link_map[old] = f"/{POST_AS_PAGE[p['slug']]}/"
    elif p['slug'] in POST_SKIP:
        link_map[old] = '/impressionen/'
    else:
        link_map[old] = f"/aktuelles/{post_slug(p)}/"
for c in cats.values():
    old = urlparse(c['link']).path
    new = CAT_MAP.get(c['slug'])
    link_map[old] = f'/aktuelles/kategorie/{slugify(new)}/' if new else '/aktuelles/'
link_map['/category/vorstand/'] = '/vorstand/'
link_map['/category/verein/vorstand/'] = '/vorstand/'


file_src = {}


def shrink_docx(path, limit=20 * 1024 * 1024):
    """Sehr grosse Word-Dateien verkleinern: eingebettete Bilder neu komprimieren."""
    import zipfile
    data = open(path, 'rb').read()
    if len(data) < limit:
        return data
    out = io.BytesIO()
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            buf = zin.read(item.filename)
            if item.filename.startswith('word/media/') and item.filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                try:
                    im = Image.open(io.BytesIO(buf))
                    fmt = im.format
                    if max(im.size) > 1400 or len(buf) > 400_000:
                        im.thumbnail((1400, 1400), Image.LANCZOS)
                        b = io.BytesIO()
                        if fmt == 'JPEG':
                            im.convert('RGB').save(b, 'JPEG', quality=72, optimize=True)
                        else:
                            im.save(b, 'PNG', optimize=True)
                        if b.tell() < len(buf):
                            buf = b.getvalue()
                except Exception:
                    pass
            zout.writestr(item, buf)
    return out.getvalue()


# ---------------------------------------------------------------- HTML -> Markdown
class Conv(MarkdownConverter):
    def convert_img(self, el, text, *a, **k):
        alt = (el.attrs.get('alt') or '').replace('\n', ' ').strip()
        src = el.attrs.get('src') or ''
        if not src:
            return ''
        return f'\n\n![{alt}]({src})\n\n'

    def convert_u(self, el, text, *a, **k):
        return text

    def convert_q(self, el, text, *a, **k):
        return f'„{text}“'


def to_md(soup):
    md = Conv(heading_style='ATX', bullets='-', strong_em_symbol='*', escape_underscores=False,
              escape_asterisks=False, escape_misc=False, newline_style='backslash').convert_soup(soup)
    md = md.replace('\xa0', ' ')
    md = re.sub(r'[ \t]+\n', '\n', md)
    md = re.sub(r'\n{3,}', '\n\n', md)
    md = re.sub(r'^#{1,6}[ \t]*(!\[[^\]]*\]\([^)]*\))[ \t]*$', r'\1', md, flags=re.M)
    md = re.sub(r'\\?\n?(!\[[^\]]*\]\([^)]*\))\\?\n?', r'\n\n\1\n\n', md)
    md = re.sub(r'\\\n(\s*\n)', r'\n\1', md)
    md = re.sub(r'^(#{1,6}) \*\*(.+?)\*\*[ \t]*$', r'\1 \2', md, flags=re.M)   # fette Ueberschriften
    md = re.sub(r'^\*\*\s*\*\*$', '', md, flags=re.M)
    md = re.sub(r'\*\*(\s*)\*\*', r'\1', md)
    md = re.sub(r'\n{3,}', '\n\n', md)
    return md.strip()


def youtube_id(src):
    m = re.search(r'youtube(?:-nocookie)?\.com/embed/([\w-]{6,})', src) or re.search(r'youtu\.be/([\w-]{6,})', src)
    return m.group(1) if m else None


def process_html(content, entry_dir, label):
    """Bereinigt WordPress-HTML, laedt Bilder/Dateien, gibt (markdown, [bilddateien]) zurueck."""
    soup = BeautifulSoup(content, 'html.parser')
    images = []
    for sel in ['style', 'script', 'form', '.wpcf7', '.members-access-error', '.screen-reader-response',
                '.bwg_container', '[id^=bwg_container]', 'noscript']:
        for el in soup.select(sel):
            el.decompose()

    # iframes
    for fr in soup.find_all('iframe'):
        src = fr.get('src', '')
        yt = youtube_id(src)
        if yt:
            p = soup.new_tag('p')
            p.string = f'https://www.youtube.com/watch?v={yt}'
            fr.replace_with(p)
        else:
            fr.decompose()   # Karte / Kalender kommen aus der Seitenvorlage

    # Bilder
    n_data = 0
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src') or ''
        local = None
        name = None
        if src.startswith('data:image'):
            m = re.match(r'data:image/(\w+);base64,(.*)', src, re.S)
            if m:
                n_data += 1
                raw = base64.b64decode(m.group(2))
                name = f'bild-{n_data}.{m.group(1)}'
                local = os.path.join(CACHE, '_data', hashlib.md5(raw).hexdigest() + '.' + m.group(1))
                os.makedirs(os.path.dirname(local), exist_ok=True)
                open(local, 'wb').write(raw)
        else:
            url = src if src.startswith('http') else BASE + src
            if HOST not in url:
                report.append(f'{label}: externes Bild entfernt: {url[:100]}')
                img.decompose()
                continue
            parent = img.find_parent('a')
            cands = []
            if parent and parent.get('href', '').lower().endswith(IMG_EXT):
                cands.append(parent['href'])
            cands += [original_url(url), url]
            for c in cands:
                local = download(c)
                if local:
                    name = os.path.basename(urlparse(c).path)
                    break
        if not local:
            report.append(f'{label}: Bild nicht abrufbar: {src[:120]}')
            img.decompose()
            continue
        fn = save_image(local, entry_dir, name)
        if not fn:
            img.decompose()
            continue
        images.append(fn)
        new = soup.new_tag('img', src=fn, alt=(img.get('alt') or '').strip())
        a = img.find_parent('a')
        if a and (a.get('href', '').lower().endswith(IMG_EXT) or 'attachment' in (a.get('rel') or [])
                  or re.search(r'/[^/]+/[^/]+/$', a.get('href', '')) and HOST in a.get('href', '') and not a.get_text(strip=True)):
            a.replace_with(new)
        else:
            img.replace_with(new)

    # Links
    for a in soup.find_all('a'):
        href = a.get('href', '')
        if not href:
            a.unwrap()
            continue
        u = urlparse(href)
        if u.netloc and HOST not in u.netloc:
            continue
        if href.startswith(('mailto:', 'tel:', '#')):
            continue
        path = unquote(u.path)
        akey = u.path if u.path.endswith('/') else u.path + '/'
        if akey in attach_map:
            u = urlparse(attach_map[akey])
            path = unquote(u.path)
        if path.lower().endswith(DOC_EXT) or (path.lower().endswith(IMG_EXT) and '/wp-content/' in path):
            local = download(BASE + u.path)
            if not local:
                report.append(f'{label}: Datei nicht abrufbar: {href}')
                a.unwrap()
                continue
            stem, ext = os.path.splitext(os.path.basename(path))
            fn = slugify(stem) + ext.lower()
            os.makedirs(FILES, exist_ok=True)
            data = shrink_docx(local) if ext.lower() == '.docx' else open(local, 'rb').read()
            dst = os.path.join(FILES, fn)
            k = 2
            while os.path.exists(dst) and file_src.get(dst) != local:
                fn = f'{slugify(stem)}-{k}{ext.lower()}'
                dst = os.path.join(FILES, fn)
                k += 1
            file_src[dst] = local
            if not os.path.exists(dst):
                open(dst, 'wb').write(data)
            a['href'] = f'/dateien/{fn}'
            redirects.append((u.path, f'/dateien/{fn}'))
            if os.path.getsize(dst) > 24 * 1024 * 1024:
                report.append(f'{label}: Datei groesser als 24 MB (Cloudflare-Limit 25 MB): {fn}')
            continue
        key = path if path.endswith('/') else path + '/'
        if key in link_map:
            a['href'] = link_map[key]
        elif path in ('', '/'):
            a['href'] = '/'
        else:
            report.append(f'{label}: interner Link ohne Ziel: {href}')
            a['href'] = path

    # Aufraeumen
    for t in soup.find_all(['span', 'font', 'div', 'center']):
        t.unwrap()
    for t in soup.find_all('h1'):
        t.name = 'h2'
    for t in soup.find_all(True):
        for attr in ('style', 'class', 'id', 'width', 'height', 'align', 'decoding', 'loading', 'srcset', 'sizes',
                     'rel', 'target', 'data-mce-style'):
            t.attrs.pop(attr, None)
    return to_md(soup), images


# ---------------------------------------------------------------- Beitraege
def migrate_posts():
    n = 0
    for p in posts:
        if p['slug'] in POST_SKIP:
            continue
        title = POST_TITLES.get(p['slug']) or html.unescape(p['title']['rendered']).strip()
        date = p['date'][:10]
        if p['slug'] in POST_AS_PAGE:
            d = os.path.join(CONTENT, 'seiten', POST_AS_PAGE[p['slug']])
            md, _ = process_html(p['content']['rendered'], d, title)
            write_entry(d, {'titel': 'Vorstand'}, md)
            continue
        slug = post_slug(p)
        d = os.path.join(CONTENT, 'beitraege', f'{date}-{slug}')
        md, imgs = process_html(p['content']['rendered'], d, f'Beitrag „{title}“')
        kat = []
        for c in p['categories']:
            k = CAT_MAP.get(cats[c]['slug'], 'Aktuelles')
            if k and k not in kat:
                kat.append(k)
        if len(kat) > 1 and 'Aktuelles' in kat:
            kat.remove('Aktuelles')
        titelbild = None
        fm = media.get(p.get('featured_media') or 0)
        if fm:
            local = download(fm['source_url'])
            if local:
                titelbild = save_image(local, d, os.path.basename(urlparse(fm['source_url']).path))
        if not titelbild and imgs:
            titelbild = imgs[0]
        write_entry(d, {'titel': title, 'datum': date, 'kategorien': kat or ['Aktuelles'], 'titelbild': titelbild}, md)
        n += 1
    print('Beitraege:', n)


# ---------------------------------------------------------------- Seiten
def migrate_pages():
    n = 0
    for p in pages:
        new = PAGE_MAP.get(p['slug'])
        if not new:
            if p['slug'] not in PAGE_REDIRECT_ONLY:
                report.append(f"Seite nicht uebernommen: {p['slug']} ({html.unescape(p['title']['rendered'])}) – "
                              f"{'nur fuer Mitglieder sichtbar' if 'members-access-error' in p['content']['rendered'] else 'leer'}")
            continue
        title = html.unescape(p['title']['rendered']).strip()
        if new == 'datenschutz':
            title = 'Datenschutzerklärung'
        d = os.path.join(CONTENT, 'seiten', new)
        md, _ = process_html(p['content']['rendered'], d, f'Seite „{title}“')
        write_entry(d, {'titel': title}, md)
        n += 1
    print('Seiten:', n)


# ---------------------------------------------------------------- Galerien
def migrate_galleries():
    urls = [u for g in galleries for u in g['images']]
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(download, urls))
    total = 0
    for g in galleries:
        title = {'RC Hell Treffen': 'RC Heli Treffen', 'Nicolausfliegen': 'Nikolausfliegen'}.get(g['title'], g['title'])
        d = os.path.join(CONTENT, 'galerien', f"{g['year']}-{slugify(title)}")
        files = []
        for u in g['images']:
            local = download(u)
            if not local:
                report.append(f"Galerie {g['year']} {title}: Bild fehlt {u}")
                continue
            fn = save_image(local, d, os.path.basename(urlparse(u).path), maxpx=1600, quality=80)
            if fn and fn not in files:
                files.append(fn)
        write_entry(d, {'titel': title, 'jahr': g['year'], 'bilder': files}, '')
        total += len(files)
        print(' Galerie', g['year'], title, len(files), flush=True)
    print('Galeriebilder:', total)


if __name__ == '__main__':
    what = sys.argv[1:] or ['posts', 'pages', 'galleries']
    if 'posts' in what:
        migrate_posts()
    if 'pages' in what:
        migrate_pages()
    if 'galleries' in what:
        migrate_galleries()
    # Weiterleitungen alter Adressen
    seen = set()
    lines = []
    for old, new in list(link_map.items()) + redirects:
        if old in seen or old == new:
            continue
        seen.add(old)
        lines.append(f'{old} {new} 301')
    json.dump({'redirects': lines, 'report': sorted(set(report))}, open(os.path.join(RAW, f'migration-{"-".join(what)}.json'), 'w'),
              ensure_ascii=False, indent=1)
    print('\n'.join(sorted(set(report))))
