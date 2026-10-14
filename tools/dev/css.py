import os, re, glob
os.chdir(r'C:\Claude\Sedona breath\lite\entry\src\main\js\MainAbility')
src = open('common/style.css', encoding='utf8').read()
header = src[:src.index('.root {')]
blocks = re.findall(r'(/\*[^*]*\*/\n)?(\.([a-z-]+) \{[^}]*\}\n)', src)
by = {}
for comment, block, name in blocks:
    by[name] = (comment or '') + block

def used(page):
    hml = open(f'pages/{page}/{page}.hml', encoding='utf8').read()
    names = set()
    for m in re.finditer(r'class="([^"]+)"', hml):
        names.update(m.group(1).split())
    return names

own_css = {}
for p in glob.glob('pages/*/*.css'):
    page = os.path.basename(os.path.dirname(p))
    css = open(p, encoding='utf8').read()
    own = css.replace("@import '../../common/style.css';\n", '').lstrip('\n')
    own_names = set(re.findall(r'^\.([a-z-]+) \{', own, re.M))
    need = [n for n in by if n in used(page) and n not in own_names]
    missing = used(page) - set(by) - own_names
    if missing:
        print(page, 'MISSING', missing)
    text = ('/* Shared classes this page uses, copied from common/style.css by tools: every class in a lite\n'
            '   page becomes an object in the small JS heap, so pages carry only what they show. */\n')
    text = "/* Generated from common/style.css (only the classes this page uses: every lite CSS class is an\n   object in the small JS heap). Edit common/style.css and run node tools/build-lite.mjs. */\n"
    out = text + ''.join(by[n] for n in need) + ('\n' + own if own.strip() else '')
    own_css[page] = own
    open(p, 'w', encoding='utf8', newline='\n').write(out)
    print(page, len(need), 'shared classes')
