# Inlines src/engine.js into src/page.html -> hyperiux-scroll-journey.html
import pathlib
root = pathlib.Path(__file__).parent
page = (root / 'src/page.html').read_text()
engine = (root / 'src/engine.js').read_text()
assert page.count('/*__ENGINE__*/') == 1
(root / 'hyperiux-scroll-journey.html').write_text(page.replace('/*__ENGINE__*/', engine))
