#!/usr/bin/env python3
"""Merge parsed questions, explanations and images into tools/private/bundle.json.

The bundle is plaintext and never published; tools/encrypt.mjs turns it into
data/vault.json, which is the only question data the site ships.

Usage: python3 tools/build.py && node tools/encrypt.mjs
"""
import base64
import glob
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIVATE = os.path.join(ROOT, 'tools', 'private')

raw = json.load(open(os.path.join(PRIVATE, 'questions_raw.json'), encoding='utf-8'))

# --- manual fixes to parsing artefacts ---------------------------------------
FIX_ANSWER = {360: 'A'}  # answer missing in source PDF
PBQ = {76, 77, 310, 322, 462}
PBQ_ANSWER_IMGS = {  # images that show the solution (rest are the task)
    76: ['q76_1.jpeg'], 77: ['q77_7.jpeg'], 310: ['q310_6.png'],
    322: ['q322_2.png'], 462: ['q462_2.png'],
}
DROP_IMGS = {'q310_5.png', 'q462_1.png', 'q462_3.png'}  # duplicates

expl = {}
for f in sorted(glob.glob(os.path.join(PRIVATE, 'explanations', '*.json'))):
    for e in json.load(open(f, encoding='utf-8')):
        expl[e['n']] = e

IMG_RE = re.compile(r'\[\[IMG:([^\]]+)\]\]')


def unwrap(text):
    """Join lines that the PDF hard-wrapped at the page width."""
    out = []
    for line in text.split('\n'):
        if out and len(out[-1]) >= 100 and not out[-1].endswith(':') \
                and not line.startswith(('•', '[[IMG')) and not out[-1].startswith('[[IMG'):
            out[-1] += ' ' + line
        else:
            out.append(line)
    return '\n'.join(out)


def imgs_in(text):
    return IMG_RE.findall(text)


out_q, out_pbq, missing = [], [], []
for r in raw:
    n = r['n']
    stem, opts = unwrap(r['stem']), [list(o) for o in r['options']]
    if n == 321:  # option images were extracted one slot early
        imgs = imgs_in(stem) + [i for o in opts for i in imgs_in(o[1])]
        stem = IMG_RE.sub('', stem).strip()
        for o, im in zip(opts, imgs):
            o[1] = f'[[IMG:{im}]]'
    if n == 4:  # each option is a two-line ACL
        for o in opts:
            o[1] = o[1].replace(' Access list', '\nAccess list')
    e = expl.get(n)
    if not e:
        missing.append(n)
    if n in PBQ:
        task = [i for i in imgs_in(stem) if i not in DROP_IMGS and i not in PBQ_ANSWER_IMGS[n]]
        text = IMG_RE.sub('', stem)
        text = re.sub(r'\n-\n', '\n', text).strip()
        out_pbq.append({'n': n, 'text': text, 'img': task, 'ans': PBQ_ANSWER_IMGS[n],
                        'd': e['d'] if e else 0, 'l': e['l'] if e else '',
                        'e': e['e'] if e else ''})
        continue
    answer = (e or {}).get('a') or FIX_ANSWER.get(n) or r['answer']
    out_q.append({
        'n': n, 'q': stem, 'o': [o[1] for o in opts], 'a': answer,
        'k': r['answer'] or FIX_ANSWER.get(n, ''), 'v': r['votes'],
        'd': e['d'] if e else 0, 'l': e['l'] if e else '', 'e': e['e'] if e else '',
    })



def data_uri(name):
    """Inline an image, re-encoding large opaque PNGs as JPEG to keep the vault small."""
    from PIL import Image
    path = os.path.join(PRIVATE, 'img', name)
    raw_bytes = open(path, 'rb').read()
    mime = 'image/png' if name.endswith('.png') else 'image/jpeg'
    if len(raw_bytes) > 150_000:
        im = Image.open(path)
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGBA')
            bg = Image.new('RGB', im.size, 'white')
            bg.paste(im, mask=im.split()[-1])
            im = bg
        buf = io.BytesIO()
        im.convert('RGB').save(buf, 'JPEG', quality=82, optimize=True)
        if buf.tell() < len(raw_bytes):
            raw_bytes, mime = buf.getvalue(), 'image/jpeg'
    return f'data:{mime};base64,' + base64.b64encode(raw_bytes).decode()


used = set()
for q in out_q:
    used.update(imgs_in(q['q'] + ' '.join(q['o'])))
for p in out_pbq:
    used.update(p['img'] + p['ans'])
images = {name: data_uri(name) for name in sorted(used)}

bundle = {'questions': out_q, 'pbqs': out_pbq, 'images': images}
with open(os.path.join(PRIVATE, 'bundle.json'), 'w', encoding='utf-8') as f:
    json.dump(bundle, f, ensure_ascii=False, separators=(',', ':'))

print(f'{len(out_q)} questions, {len(out_pbq)} PBQs, {len(expl)} explanations')
if missing:
    print(f'missing explanations: {len(missing)} (e.g. {missing[:10]})')
