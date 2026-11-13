"""CI step: icon, splash screen, signing key. Runs after `npx cap add android`."""
import os, re, shutil, glob
from PIL import Image

RES = 'android/app/src/main/res'
logo = Image.open('resources/logo.png').convert('RGBA')

# 1) launcher icons (plain PNGs, remove adaptive xml so ours are used)
shutil.rmtree(f'{RES}/mipmap-anydpi-v26', ignore_errors=True)
for d in os.listdir('resources/android-res'):
    os.makedirs(f'{RES}/{d}', exist_ok=True)
    for f in os.listdir(f'resources/android-res/{d}'):
        shutil.copy(f'resources/android-res/{d}/{f}', f'{RES}/{d}/{f}')

# 2) splash.png everywhere (same size as the default file, white + our logo)
for p in glob.glob(f'{RES}/**/splash.png', recursive=True):
    w, h = Image.open(p).size
    bg = Image.new('RGBA', (w, h), 'white')
    s = int(min(w, h) * 0.26)
    k = logo.resize((s, int(s * logo.height / logo.width)), Image.LANCZOS)
    bg.alpha_composite(k, ((w - k.width) // 2, (h - k.height) // 2))
    bg.convert('RGB').save(p)
    print('splash', p, w, h)

# 3) Android 12+ system splash: our logo on white
os.makedirs(f'{RES}/drawable', exist_ok=True)
canvas = Image.new('RGBA', (768, 768), (0, 0, 0, 0))
k = logo.resize((420, int(420 * logo.height / logo.width)), Image.LANCZOS)
canvas.alpha_composite(k, ((768 - k.width) // 2, (768 - k.height) // 2))
canvas.save(f'{RES}/drawable/splash_logo.png')
sp = f'{RES}/values/styles.xml'
x = open(sp, encoding='utf8').read()
if 'windowSplashScreenAnimatedIcon' not in x:
    x = re.sub(r'(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)(.*?)(</style>)',
        lambda m: m.group(1) + m.group(2) +
        '\n        <item name="windowSplashScreenBackground">#FFFFFF</item>'
        '\n        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_logo</item>\n    ' + m.group(3),
        x, count=1, flags=re.S)
    open(sp, 'w', encoding='utf8').write(x)

# 4) fixed signing key so new APK installs over the old one
home = os.path.expanduser('~/.android')
os.makedirs(home, exist_ok=True)
shutil.copy('resources/debug.keystore', f'{home}/debug.keystore')
print('prepare_android done')
