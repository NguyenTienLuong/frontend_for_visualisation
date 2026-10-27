"""Execute every cell in a local kernel and save outputs plus a validation log."""
from pathlib import Path
import os
import sys
import json
import time
BASE=Path(__file__).resolve().parents[1]
for env,relative in [('JUPYTER_CONFIG_DIR','.jupyter/config'),('JUPYTER_DATA_DIR','.jupyter/data'),('JUPYTER_RUNTIME_DIR','.jupyter/runtime'),('IPYTHONDIR','.ipython')]:
    path=BASE/relative;path.mkdir(parents=True,exist_ok=True);os.environ[env]=str(path)
os.environ['JUPYTER_PATH']=str(BASE/'.jupyter')
os.environ['MPLCONFIGDIR']=str(BASE/'output/.matplotlib')
kernel=BASE/'.jupyter/kernels/cell2cell';kernel.mkdir(parents=True,exist_ok=True)
(kernel/'kernel.json').write_text(json.dumps({'argv':[sys.executable,'-X','utf8','-m','ipykernel_launcher','-f','{connection_file}'],'display_name':'Python Cell2Cell','language':'python','env':{'MPLCONFIGDIR':str(BASE/'output/.matplotlib'),'PYTHONIOENCODING':'utf-8'}}),encoding='utf-8')
import nbformat
from nbclient import NotebookClient
path=BASE/'Cell2Cell_Customer_Churn_Analysis.ipynb'
nb=nbformat.read(path,as_version=4)
started=time.time()
def progress(cell,cell_index,**kwargs):
    if cell['cell_type']=='code': print(f'Executing code cell {cell_index+1}/{len(nb.cells)}',flush=True)
client=NotebookClient(nb,timeout=1500,kernel_name='cell2cell',resources={'metadata':{'path':str(BASE)}},on_cell_start=progress)
try:
    client.execute()
finally:
    nbformat.write(nb,path)
errors=[{'cell':i+1,'name':o.get('ename'),'message':o.get('evalue')} for i,c in enumerate(nb.cells) for o in c.get('outputs',[]) if o.get('output_type')=='error']
checks={'notebook':path.name,'cells':len(nb.cells),'code_cells':sum(c.cell_type=='code' for c in nb.cells),'executed_code_cells':sum(c.cell_type=='code' and c.get('execution_count') is not None for c in nb.cells),'errors':errors,'runtime_seconds':time.time()-started}
(BASE/'output/analysis/notebook_execution_check.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
if errors: raise RuntimeError(errors)
print(json.dumps(checks,ensure_ascii=False),flush=True)
