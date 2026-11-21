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

# 5) Google login: Web Client ID ko Android strings.xml me bhi likhna (plugin yahan se bhi parhta hai)
import json
try:
    cid = json.load(open('capacitor.config.json'))['plugins']['GoogleAuth']['serverClientId']
    sx = f'{RES}/values/strings.xml'
    t = open(sx, encoding='utf8').read()
    if 'server_client_id' not in t:
        t = t.replace('</resources>', f'    <string name="server_client_id">{cid}</string>\n</resources>')
        open(sx, 'w', encoding='utf8').write(t)
    print('google client id set')
except Exception as e:
    print('google client id step skipped:', e)

# 6) Har build ka versionCode badhta rahe taake naya APK purani app ke upar update ho jaye
# (appId aur signing key pehle se fixed hain, sirf versionCode upar jana chahiye)
try:
    run = int(os.environ.get('GITHUB_RUN_NUMBER', '1'))
    code = 10 + run
    name = json.load(open('package.json')).get('version', '1.0.0') + '.' + str(run)
    gp = 'android/app/build.gradle'
    g = open(gp, encoding='utf8').read()
    g, n1 = re.subn(r'versionCode\s+\d+', f'versionCode {code}', g, count=1)
    g, n2 = re.subn(r'versionName\s+"[^"]*"', f'versionName "{name}"', g, count=1)
    open(gp, 'w', encoding='utf8').write(g)
    print('version set', code, name, n1, n2)
except Exception as e:
    print('version step skipped:', e)

# 7) Release signing (GitHub secrets). Secrets na hon to ye step skip ho jata hai.
try:
    if os.environ.get('KEYSTORE_BASE64'):
        import base64
        open('android/app/kaizen-release.jks', 'wb').write(base64.b64decode(os.environ['KEYSTORE_BASE64']))
        g = open('android/app/build.gradle', encoding='utf8').read()
        if 'signingConfigs' not in g:
            sc = ("    signingConfigs {\n        release {\n"
                  "            storeFile file('kaizen-release.jks')\n"
                  "            storePassword System.getenv('KEYSTORE_PASSWORD')\n"
                  "            keyAlias System.getenv('KEY_ALIAS')\n"
                  "            keyPassword System.getenv('KEY_PASSWORD')\n        }\n    }\n")
            g, n = re.subn(r'(\n\s*buildTypes\s*\{)', '\n' + sc.rstrip('\n') + r'\1', g, count=1)
            g, m = re.subn(r'(buildTypes\s*\{\s*release\s*\{)', r'\1\n            signingConfig signingConfigs.release', g, count=1)
            open('android/app/build.gradle', 'w', encoding='utf8').write(g)
            print('release signing set', n, m)
except Exception as e:
    print('release signing step skipped:', e)
