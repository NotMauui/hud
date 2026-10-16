# Copia nell'app la tabella dei muscoli e l'elenco dei video pronti (blocco MUSCOLI in 19-mobilita-palestra.js).
# Uso: python3 sincronizza_app.py <cartella 11_Omini_3D> <file 19-mobilita-palestra.js>
import json, os, sys, re
dove, dest = sys.argv[1], sys.argv[2]
T = json.load(open(os.path.join(dove, "muscoli.json"), encoding="utf-8"))
nomi = T["muscoli"]
musc = {k: [[nomi[m] for m in e[r]] for r in ("lavora", "aiuta", "allunga")] for k, e in T["esercizi"].items()}
vd = os.path.join(dove, "video")
mp4 = sorted(f[:-4] for f in os.listdir(vd) if f.endswith(".mp4") and os.path.getsize(os.path.join(vd, f)) > 10000) if os.path.isdir(vd) else []
# nell'app il loop gira come immagine animata WebP (parte da sola ovunque, anche dove i video non partono senza un tocco).
# Serve ffmpeg (per leggere l'mp4) e Pillow (per scrivere il WebP): brew install ffmpeg · pip3 install pillow.
# Se mancano, l'app usa l'mp4.
import shutil, subprocess, tempfile, glob
ff = shutil.which("ffmpeg")
try:
    from PIL import Image
except ImportError:
    Image = None
for k in mp4:
    src, w = os.path.join(vd, k + ".mp4"), os.path.join(vd, k + ".webp")
    if not ff or Image is None or (os.path.exists(w) and os.path.getmtime(w) >= os.path.getmtime(src)): continue
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([ff, "-v", "quiet", "-i", src, "-vf", "scale=480:-2", os.path.join(tmp, "%04d.png")])
        fr = [Image.open(f).convert("RGB") for f in sorted(glob.glob(os.path.join(tmp, "*.png")))]
        if len(fr) < 2: print("video non leggibile (ancora in corso?):", k); continue
        fps = 24
        try:
            fps = round(eval(subprocess.run([shutil.which("ffprobe") or "ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", src], capture_output=True, text=True).stdout.strip()))
        except Exception: pass
        fr[0].save(w, save_all=True, append_images=fr[1:], duration=round(1000 / fps), loop=0, quality=80, method=4, minimize_size=False, allow_mixed=False)
video = {k: ("webp" if os.path.exists(os.path.join(vd, k + ".webp")) else "mp4") for k in mp4}
blocco = ("// >>> MUSCOLI (generato da 11_Omini_3D/sincronizza_app.py: non modificare a mano)\n"
          "// per ogni esercizio: [muscoli che lavorano, che aiutano, che si allungano]; VIDEO_ES = esercizi con il video 3D e il formato\n"
          f"const MUSC = {json.dumps(musc, ensure_ascii=False, separators=(',', ':'))};\n"
          f"const VIDEO_ES = {json.dumps(video)};\n"
          "// <<< MUSCOLI")
s = open(dest, encoding="utf-8").read()
if "// >>> MUSCOLI" in s:
    s = re.sub(r"// >>> MUSCOLI.*?// <<< MUSCOLI", lambda m: blocco, s, flags=re.S)
else:
    s = s.rstrip("\n") + "\n\n" + blocco + "\n"
open(dest, "w", encoding="utf-8").write(s)
print(len(musc), "esercizi,", len(video), "video:", ", ".join(f"{k} ({e})" for k, e in video.items()) or "nessuno")
if mp4 and (not ff or Image is None): print("Per i loop WebP servono ffmpeg e Pillow (brew install ffmpeg · pip3 install pillow): per ora l'app usa l'mp4.")
