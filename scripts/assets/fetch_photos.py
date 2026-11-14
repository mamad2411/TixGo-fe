#!/usr/bin/env python3
"""Unduh foto sumber CC0 dari Wikimedia Commons (versi 2400 px) + catat provenans ke design-src/photos.meta.json.

Hanya berkas yang metadata lisensinya CC0/Public domain di Commons (dicek ulang saat unduh; berhenti keras bila berubah).
Berkas asli TIDAK di-commit (design-src/originals/ di .gitignore). Pakai: python3 scripts/assets/fetch_photos.py
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT = os.path.join(ROOT, "design-src", "originals")
UA = {"User-Agent": "TixGoDesignResearch/1.0 (asset sourcing; CC0 only)"}
PHOTOS = {  # id -> judul berkas di Commons
    "front-row": "File:Front row audience (Unsplash).jpg",
    "hands-red": "File:Put your hands in the air (Unsplash).jpg",
    "hands-silhouette": "File:Houston audience lifting up hands (Unsplash).jpg",
    "phone-light": "File:Monterrey concert silhouette (Unsplash).jpg",
    "blue-flare": "File:Enjoying the concert (Unsplash).jpg",
    "disco-ball": "File:Mirrored Disco Ball with Light and Motor.jpg",
}


def get(url, tries=6):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and i < tries - 1:
                time.sleep(8 * (i + 1)); continue
            raise


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = []
    for pid, title in PHOTOS.items():
        q = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "query", "format": "json", "titles": title, "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 2400})
        d = json.loads(get(q))
        ii = next(iter(d["query"]["pages"].values()))["imageinfo"][0]
        m = ii["extmetadata"]
        lic = m.get("LicenseShortName", {}).get("value", "?")
        if not ("CC0" in lic or "Public domain" in lic):
            sys.exit(f"BERHENTI: lisensi {title} sekarang '{lic}' (bukan CC0/PD)")
        dst = os.path.join(OUT, pid + ".jpg")
        if not os.path.exists(dst) or os.path.getsize(dst) == 0:
            open(dst, "wb").write(get(ii["thumburl"])); time.sleep(4)
        meta.append({"id": pid, "title": title, "page": ii["descriptionurl"], "download": ii["thumburl"], "license": lic,
                     "author": re.sub("<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip(), "original_px": [ii["width"], ii["height"]],
                     "fetched": time.strftime("%Y-%m-%d")})
        print(pid, os.path.getsize(dst) // 1024, "KB", lic)
    json.dump(meta, open(os.path.join(ROOT, "design-src", "photos.meta.json"), "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
