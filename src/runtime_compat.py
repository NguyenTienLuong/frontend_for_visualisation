"""Narrow compatibility fix for Unicode virtualenv paths on Windows.

Some Windows module-enumeration APIs return a question mark for a non-ASCII
directory. Resolve only a missing virtualenv DLL path against the real sys.prefix;
do not suppress DLL errors or alter any library on disk.
"""
from pathlib import Path
import os
import sys


def repair_windows_threadpool_paths():
    if os.name != "nt":
        return
    from threadpoolctl import ThreadpoolController
    if getattr(ThreadpoolController, "_cell2cell_unicode_paths_repaired", False):
        return
    original = ThreadpoolController._make_controller_from_path

    def with_resolved_prefix(self, filepath):
        candidate = Path(filepath)
        marker = "\\Lib\\site-packages\\"
        if not candidate.exists() and marker.lower() in str(filepath).lower():
            remainder = str(filepath)[str(filepath).lower().index(marker.lower()) + len(marker):]
            repaired = Path(sys.prefix) / "Lib" / "site-packages" / remainder
            if repaired.is_file():
                filepath = str(repaired)
        return original(self, filepath)

    ThreadpoolController._make_controller_from_path = with_resolved_prefix
    ThreadpoolController._cell2cell_unicode_paths_repaired = True
