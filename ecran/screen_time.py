#!/usr/bin/env python3
"""Palier · temps d'écran iPhone → pont.
Lit la base Temps d'écran du Mac (alimentée par l'iPhone quand « Partager entre les appareils » est activé),
calcule le total d'hier pour les appareils autres que ce Mac, et l'envoie dans le check-in du matin (screen_min).
Nécessite « Accès complet au disque » pour l'app qui lance ce script."""
import sqlite3, json, sys, datetime, urllib.request, os, shutil, tempfile
DB = os.path.expanduser('~/Library/Application Support/Knowledge/knowledgeC.db')
URL = 'https://script.google.com/macros/s/AKfycbzbiutY5E4Y3qoTtCPx08txUJ0zuGWSfGhn5r_jNYZ_qYPrcIIKOL8UtBGjwntZ0pB2NQ/exec'
KEY = 'palier-7f3c9a2e5b1d4c8e'
LOG = os.path.expanduser('~/Library/Logs/palier-ecran.log')
def log(m):
    with open(LOG, 'a') as f: f.write(datetime.datetime.now().strftime('%Y-%m-%d %H:%M ') + m + '\n')
    print(m)
def main():
    day = datetime.date.today() - datetime.timedelta(days=1)
    if len(sys.argv) > 1: day = datetime.date.fromisoformat(sys.argv[1])
    start = datetime.datetime.combine(day, datetime.time()).astimezone()
    end = start + datetime.timedelta(days=1)
    mac = 978307200  # epoch Apple
    # copie pour éviter le verrou
    tmp = tempfile.mkdtemp(); dst = os.path.join(tmp, 'k.db')
    try:
        shutil.copy(DB, dst)
        for ext in ('-wal', '-shm'):
            if os.path.exists(DB + ext): shutil.copy(DB + ext, dst + ext)
    except PermissionError:
        log('ERREUR : accès refusé à knowledgeC.db (donner « Accès complet au disque » à Palier Écran)'); return 2
    con = sqlite3.connect(dst)
    rows = con.execute("""
      select coalesce(ZS.ZDEVICEID,'mac'), ZO.ZSTARTDATE, ZO.ZENDDATE, ZO.ZVALUESTRING
      from ZOBJECT ZO left join ZSOURCE ZS on ZO.ZSOURCE = ZS.Z_PK
      where ZO.ZSTREAMNAME = '/app/usage' and ZO.ZENDDATE > ? and ZO.ZSTARTDATE < ?""",
      (start.timestamp() - mac, end.timestamp() - mac)).fetchall()
    per = {}
    for dev, s0, e0, app in rows:
        s1 = max(s0 + mac, start.timestamp()); e1 = min(e0 + mac, end.timestamp())
        if e1 > s1: per[dev] = per.get(dev, 0) + (e1 - s1)
    phones = {d: v for d, v in per.items() if d != 'mac'}
    if not phones:
        log(f'{day} : aucune donnée iPhone (activer Temps d\'écran → Partager entre les appareils sur l\'iPhone et le Mac)'); return 1
    minutes = round(sum(phones.values()) / 60)
    log(f'{day} : iPhone {minutes} min ({len(phones)} appareil(s)) · Mac {round(per.get("mac", 0) / 60)} min')
    body = json.dumps({'key': KEY, 'what': 'health', 'date': (day + datetime.timedelta(days=1)).isoformat(), 'screen_min': minutes}).encode()
    req = urllib.request.Request(URL, data=body, headers={'Content-Type': 'text/plain'})
    log('pont : ' + urllib.request.urlopen(req, timeout=60).read().decode()[:120])
    return 0
if __name__ == '__main__': sys.exit(main())
