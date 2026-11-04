#!/usr/bin/env python3
"""Generate small, original, offline PDF/EPUB samples for real-browser reader tests."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
import sys


def build_pdf(path: Path) -> None:
    count = 12
    font_id = 3 + count * 2
    objects: list[bytes] = []
    objects.append(b'<< /Type /Catalog /Pages 2 0 R >>')
    kids = ' '.join(f'{3 + 2 * i} 0 R' for i in range(count))
    objects.append(f'<< /Type /Pages /Kids [{kids}] /Count {count} >>'.encode())
    for page in range(1, count + 1):
        content = [f'BT /F1 20 Tf 55 785 Td (Reader Integration Page {page:02}) Tj ET']
        for line in range(22):
            text = f'Page {page} - sample text line {line+1:02} - generated for local integration testing only'
            content.append(f'BT /F1 12 Tf 55 {745 - 27 * line} Td ({text}) Tj ET')
        stream = ('\n'.join(content) + '\n').encode('ascii')
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {4 + 2 * (page - 1)} 0 R >>'.encode())
        objects.append(f'<< /Length {len(stream)} >>\nstream\n'.encode() + stream + b'endstream')
    objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    pdf = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f'{index} 0 obj\n'.encode())
        pdf.extend(obj)
        pdf.extend(b'\nendobj\n')
    startxref = len(pdf)
    pdf.extend(f'xref\n0 {len(offsets)}\n0000000000 65535 f \n'.encode())
    for offset in offsets[1:]:
        pdf.extend(f'{offset:010d} 00000 n \n'.encode())
    pdf.extend(f'trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF\n'.encode())
    path.write_bytes(pdf)


def build_epub(path: Path) -> None:
    with ZipFile(path, 'w') as archive:
        archive.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
        archive.writestr('META-INF/container.xml', '''<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
 <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>''', compress_type=ZIP_DEFLATED)
        chapters = 5
        archive.writestr('OEBPS/navigation.xhtml', '''<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>TOC</title></head><body><nav epub:type="toc"><ol>''' + ''.join(f'<li><a href="chapter{i}.xhtml">Chapter {i}</a></li>' for i in range(1, chapters+1)) + '''</ol></nav></body></html>''', compress_type=ZIP_DEFLATED)
        manifest = '<item id="nav" href="navigation.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
        spine = ''
        for i in range(1, chapters + 1):
            manifest += f'<item id="chapter{i}" href="chapter{i}.xhtml" media-type="application/xhtml+xml"/>'
            spine += f'<itemref idref="chapter{i}"/>'
            paras = ''.join(f'<p>Original test chapter {i}, paragraph {n:03}. This prose validates scrolling, page reflow, and CFI restoration in a local test.</p>' for n in range(1, 86))
            archive.writestr(f'OEBPS/chapter{i}.xhtml', f'''<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter {i}</title></head><body><h1>Chapter {i}</h1>{paras}</body></html>''', compress_type=ZIP_DEFLATED)
        archive.writestr('OEBPS/content.opf', f'''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">urn:uuid:22e87038-4291-4330-a71e-2bb8212f0201</dc:identifier>
<dc:title>Original Reader Fixture</dc:title><dc:language>en</dc:language><dc:creator>Atoman Test Fixture</dc:creator>
<meta property="dcterms:modified">2026-11-04T00:00:00Z</meta>
</metadata><manifest>{manifest}</manifest><spine>{spine}</spine></package>''', compress_type=ZIP_DEFLATED)


if __name__ == '__main__':
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    build_pdf(out / 'reader-fixture.pdf')
    build_epub(out / 'reader-fixture.epub')
    print('generated', *(f.name for f in out.glob('reader-fixture.*')))
