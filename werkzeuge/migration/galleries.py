"""Crawl the Photo Gallery (bwg) pages incl. pagination -> raw/galleries.json"""
import json,re,subprocess,html
B='https://fmc-dietzenbach.org'
def fetch(u):
    return subprocess.run(['curl','-sS','--max-time','60',u],capture_output=True).stdout.decode('utf-8','replace')
def sections(h):
    """return list of (title, bwg_index, gallery_id, [thumb urls], maxpage)"""
    m=re.search(r'<div class="entry-content".*?(?=<footer|<div id="comments"|</article>)',h,re.S)
    c=m.group(0) if m else h
    parts=re.split(r'(<h[1-4][^>]*>.*?</h[1-4]>)',c,flags=re.S)
    out=[];title=None
    for part in parts:
        if re.match(r'<h[1-4]',part):
            title=html.unescape(re.sub('<.*?>','',part)).strip(); continue
        for cm in re.finditer(r'id="bwg_container1_(\d+)".*?data-gallery-id="(\d+)"(.*?)(?=id="bwg_container1_\d+"|$)',part,re.S):
            idx,gid,body=cm.group(1),cm.group(2),cm.group(3)
            thumbs=[]
            for t in re.findall(r'(?:src|data-src)="([^"]*photo-gallery/[^"?]+/thumb/[^"?]+)',body):
                if t not in thumbs: thumbs.append(t)
            mp=re.search(r'class="total-pages_%s">\s*(\d+)'%idx,body) or re.search(r'von\s*<span[^>]*>\s*(\d+)',body)
            out.append([title,idx,gid,thumbs,int(mp.group(1)) if mp else 1])
    return out
res=[]
for year,path in [(2014,'/impressionen/i2014/'),(2015,'/impressionen/i2015/'),(2016,'/impressionen/i2016/'),(2017,'/impressionen/2017-2/'),(2018,'/impressionen/2018-2/'),(2019,'/2019-2/')]:
    secs=sections(fetch(B+path))
    for title,idx,gid,thumbs,maxpage in secs:
        allt=list(thumbs);pg=2
        while pg<=max(maxpage,1) or (maxpage==1 and len(thumbs)>=30 and pg<60):
            s=[x for x in sections(fetch(f'{B}{path}?page_number_{idx}={pg}')) if x[1]==idx]
            new=[t for t in (s[0][3] if s else []) if t not in allt]
            if not new: break
            allt+=new;pg+=1
        print(year,title,'gid',gid,'pages',maxpage,'images',len(allt),flush=True)
        res.append(dict(year=year,title=title,gid=gid,source=path,images=[html.unescape(t).replace('/thumb/','/') for t in allt]))
json.dump(res,open('raw/galleries.json','w'),ensure_ascii=False,indent=1)
print('total',sum(len(r['images']) for r in res))
