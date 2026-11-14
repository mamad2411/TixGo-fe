"""Unduh 16 foto konser CC0 (Wikimedia Commons, 2000 px) ke design-src/originals/concerts + meta.json (kredit). Dipakai backend/cmd/seed-demo."""
import json,urllib.parse,urllib.request,time,re,os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","design-src","originals","concerts")
os.makedirs(OUT,exist_ok=True)
UA={"User-Agent":"TixGoDesignResearch/1.0 (asset sourcing; CC0 only)"}
def raw(u):
    for i in range(6):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=120).read()
        except Exception as e: time.sleep(8*(i+1))
    raise SystemExit("gagal "+u)
P={
 "rock":"Rock concert in intense light (Unsplash).jpg",
 "redguitar":"Guitarist bathed in red light (Unsplash).jpg",
 "jazz":"Colorful jazz concert (Unsplash).jpg",
 "djnight":"Party Night (Unsplash).jpg",
 "edmfest":"Said The Sky (Unsplash).jpg",
 "cheer":"Cheering concertgoers (Unsplash).jpg",
 "acoustic":"Acoustic guitar player in pale light (Unsplash).jpg",
 "singer":"Singer In Concert (Unsplash).jpg",
 "hall":"Katowice concert hall (Unsplash).jpg",
 "festcrowd":"Looking into festival crowd (Unsplash).jpg",
 "smoke":"Smoke and light beams (Unsplash).jpg",
 "bluered":"Guitarist on stage with blue and red lights (Unsplash).jpg",
 "soldout":"Sold-out concert in Montreal (Unsplash).jpg",
 "vinyl":"Spin that record (Unsplash).jpg",
 "frontrow":"Front row audience (Unsplash).jpg",
 "crowd":"Concert crowd (Unsplash).jpg",
}
meta={}
for k,t in P.items():
    d=json.loads(raw("https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode({"action":"query","format":"json","titles":"File:"+t,"prop":"imageinfo","iiprop":"url|extmetadata","iiurlwidth":2000})))
    ii=next(iter(d["query"]["pages"].values()))["imageinfo"][0]; m=ii["extmetadata"]
    lic=m["LicenseShortName"]["value"]
    assert "CC0" in lic or "Public" in lic, (k,lic)
    open(os.path.join(OUT,k+".jpg"),"wb").write(raw(ii["thumburl"]))
    art=re.sub("<[^>]+>","",m.get("Artist",{}).get("value","?"))
    meta[k]={"title":t,"license":lic,"author":art,"source":ii["descriptionurl"]}
    print(k,lic,art[:40],os.path.getsize(os.path.join(OUT,k+".jpg"))//1024,"KB"); time.sleep(1.5)
json.dump(meta,open(os.path.join(OUT,"meta.json"),"w"),ensure_ascii=False,indent=1)
