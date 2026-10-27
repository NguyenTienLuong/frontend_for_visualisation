"""Download Cell2Cell once, preserve raw source and audit loader transformations."""
import json
from analysis_models import DATA, OUT, acquire, native

DATA.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
_, manifest = acquire()
print(json.dumps(native(manifest), ensure_ascii=False, indent=2))
