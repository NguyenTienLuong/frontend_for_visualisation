from pathlib import Path
import json
import re
import pypdfium2 as pdfium
from pypdf import PdfReader
BASE=Path(__file__).resolve().parents[1]
path=BASE/'Cell2Cell_Customer_Churn_Report.pdf'
out=BASE/'output/docx_qa';out.mkdir(parents=True,exist_ok=True)
doc=pdfium.PdfDocument(path)
reader=PdfReader(path)
pages=[]
for i,page in enumerate(doc):
    image=page.render(scale=2).to_pil()
    image.save(out/f'page-{i+1}.png')
    text=reader.pages[i].extract_text() or ''
    (out/f'page-{i+1}.txt').write_text(text,encoding='utf-8')
    pages.append({'page':i+1,'words':len(text.split()),'first_text':text[:180],'last_text':text[-200:],'image':f'page-{i+1}.png'})
(out/'pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':len(pages),'word_count':sum(p['words'] for p in pages),'sparse_pages':[(p['page'],p['words']) for p in pages if p['words']<90]},ensure_ascii=False))
