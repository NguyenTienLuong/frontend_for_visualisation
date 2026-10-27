"""Write the user guide, verify final artifacts, and package a portable project."""
from pathlib import Path
import json
import hashlib
import zipfile
import re
import nbformat
import pandas as pd
from pypdf import PdfReader
BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'output/analysis'
def load(name): return json.loads((OUT/name).read_text(encoding='utf-8'))

def main():
    model=load('model_summary.json');data=load('data_manifest.json');risk=load('risk_summary.json');execution=load('notebook_execution_check.json');report=load('report_manifest.json')
    top=pd.read_csv(OUT/'targeting_test.csv');t20=top.loc[(top.capacity-.2).abs().idxmin()]
    score=pd.read_csv(BASE/'Cell2Cell_Churn_Risk_Scores.csv');candidates=pd.read_csv(BASE/'Cell2Cell_Retention_Candidates_Historical.csv')
    pdf=PdfReader(BASE/'Cell2Cell_Customer_Churn_Report.pdf');pages=len(pdf.pages)
    nb=nbformat.read(BASE/'Cell2Cell_Customer_Churn_Analysis.ipynb',as_version=4)
    errors=[o for c in nb.cells for o in c.get('outputs',[]) if o.get('output_type')=='error']
    assert not errors and not execution['errors']
    assert execution['code_cells']==execution['executed_code_cells']
    assert score.customer_id.is_unique and len(score)==data['loader_rows']
    assert candidates.observed_churn.eq(0).all() and len(candidates)==data['loader_rows']-data['churn_count']
    assert 25<=pages<=35 and 20<=report['figure_count']<=30
    assert len(load('charts.json'))==30 and len(load('model_charts.json'))==11 and len(load('interactive_charts.json'))==4
    text='\n'.join(p.extract_text() or '' for p in pdf.pages)
    assert 'Mục lục tự động' not in text and 'Cập nhật trường trong Word' not in text
    assert not re.search(r'\bTODO\b|\bTBD\b|\bPLACEHOLDER\b',text,re.I)
    for x in ['CHƯƠNG 1','CHƯƠNG 13','DANH MỤC HÌNH','DANH MỤC BẢNG']:
        assert x in text, x
    checks={'notebook_cells':len(nb.cells),'code_cells_executed':execution['executed_code_cells'],'notebook_errors':len(errors),'report_pages':pages,'report_words':len(text.split()),'report_figures':report['figure_count'],'report_tables':report['table_count'],'static_visualizations':41,'interactive_visualizations':4,'raw_customers':data['raw_rows'],'analysis_customers':data['loader_rows'],'scored_customers':len(score),'historical_nonchurn_candidates':len(candidates),'historical_p1_nonchurn_candidates':int(candidates.priority_level.eq('P1').sum()),'risk_csv_unique_ids':True,'notebook_report_shared_result_files':True,'visual_qa':'All pages inspected after final Word export; all static charts inspected.','limitations':'Historical labels and random split; no reliable snapshot date, currency, intervention effect or live customer state supplied.'}
    (OUT/'final_quality_checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
    guide=f'''# Dự án phân tích Cell2Cell Customer Churn

Đây là gói kết quả và mã nguồn phục vụ phân tích khách hàng, xếp hạng rủi ro và thiết kế chính sách giữ chân. Báo cáo tiếng Việt gồm {pages} trang, {report['figure_count']} hình và {report['table_count']} bảng. Notebook đã thực thi đủ {execution['executed_code_cells']} ô code, không có lỗi; có 41 hình tĩnh và 4 công cụ khám phá tương tác.

## Tệp chính

- `Cell2Cell_Customer_Churn_Analysis.ipynb`: notebook có code, markdown, kết quả thực thi, nhận xét và khuyến nghị. Các ô `%%writefile` chứa toàn bộ mã nguồn phân tích có thể khôi phục module.
- `Cell2Cell_Customer_Churn_Report.docx`: báo cáo có thể chỉnh sửa, mục lục và danh mục tự động đã cập nhật bằng Word.
- `Cell2Cell_Customer_Churn_Report.pdf`: bản đọc và in đã kiểm tra mọi trang.
- `Cell2Cell_Churn_Risk_Scores.csv`: {len(score):,} điểm OOF trên toàn cohort lịch sử, có observed_churn và cờ xác nhận trạng thái hiện tại.
- `Cell2Cell_Retention_Candidates_Historical.csv`: {len(candidates):,} hồ sơ có observed_churn=0 trong dữ liệu nguồn, đã sắp xếp ưu tiên. Trong đó P1 gồm {int(candidates.priority_level.eq('P1').sum()):,} người.

## Kết quả chính

Nguồn gồm {data['raw_rows']:,} khách hàng. Empulse loại {data['rows_removed_missing_monthly_revenue']:,} dòng thiếu MonthlyRevenue, còn {data['loader_rows']:,} người với {data['churn_count']:,} churner, tỷ lệ {data['churn_rate']:.2%}. Mô hình được chọn là {model['selected_model']}. Test ROC AUC = {model['test']['roc_auc']:.4f}, average precision = {model['test']['pr_auc_average_precision']:.4f}. Top 20% theo rủi ro bao phủ {t20.capture_recall:.2%} churner, lift {t20.lift:.2f} lần trên test. Những con số này không đo hiệu quả của một can thiệp giữ chân.

## Đọc danh sách khách hàng

`churn_probability` là điểm OOF lịch sử, không phải dự báo trực tiếp cho một kỳ tương lai đã định. `customer_value_proxy` là MonthlyRevenue không âm; `priority_score` bằng xác suất nhân đại diện giá trị, chưa phải CLV, doanh thu có thể cứu hoặc lợi ích tăng thêm. `key_risk_signals` là các cờ mô tả có kiểm tra bằng chứng chỉ trên train, không phải SHAP hoặc giải thích cục bộ của mô hình.

Ngưỡng phân khúc rủi ro được lấy từ phân vị validation; ngưỡng giá trị là trung vị train. P1 là giá trị cao và rủi ro cao; P2 là giá trị cao và rủi ro trung bình; P3 là giá trị thấp hơn với rủi ro từ trung bình; P4 theo dõi. Mỗi nhóm sắp xếp theo priority_score giảm dần. Cần kiểm tra thuê bao còn hoạt động, tính sẵn có theo thời điểm của feature và điều kiện liên hệ trên snapshot mới trước khi triển khai. Hồ sơ đã churn chỉ dùng phân tích hoặc win-back riêng.

## Dữ liệu và bảng bằng chứng

- `data/cell2cell_raw.csv`: nguồn nguyên bản được bảo toàn.
- `data/empulse_cache/cell2cell.csv.gz`: cache chính thức của loader, cho phép chạy lại không tải mạng.
- `data/cell2cell_features.csv` và `cell2cell_target.csv`: X và y do API trả, tên cột native snake_case.
- `data/cell2cell_analysis.csv`: tên cột nguồn đã khôi phục qua ánh xạ kiểm tra một đối một, CustomerID và Churn.
- `output/analysis/`: manifest, data dictionary, thống kê, khoảng Wilson, dữ liệu chia train/validation/test, đánh giá mô hình, targeting, ngưỡng, hệ số, permutation, personas, KPI và kiểm tra chất lượng.
- `output/analysis/evaluation_model.joblib`: mô hình đã đóng băng dùng cho benchmark test.
- `output/analysis/production_model.joblib`: cấu hình được fit toàn lịch sử sau đánh giá; không dùng kết quả fit này để báo cáo test.

Không gán đơn vị tiền tệ khi nguồn chưa xác nhận. PercChangeMinutes và PercChangeRevenues được giữ theo đơn vị nguồn, không tự diễn giải là phần trăm. Tuổi bằng không, IncomeGroup và HandsetPrice có chính sách mã hóa riêng. Tuổi thiết bị âm được giữ và đánh dấu cần xác minh. Không tự động loại outlier hoặc dùng các cost assumptions mặc định của Empulse để tính lợi ích.

## Mở các biểu đồ tương tác

Mở các tệp HTML trong `output/interactive/` bằng trình duyệt. HTML chứa sẵn Plotly, không cần Internet. Các scatter dùng mẫu phân tầng hoặc mẫu tái lập và ghi rõ quy mô hiển thị; bảng thống kê vẫn tính trên toàn cohort. Hover, bấm legend, zoom, pan và chọn vùng phục vụ identify, compare, filter và explore.

## Chạy lại

Môi trường đã kiểm tra: Python {model['versions'].get('python','3.11')}; phiên bản thư viện ghi chính xác trong `requirements.txt` và model_summary. Cài đặt môi trường Python riêng rồi chạy từ thư mục gốc gói dự án:

```powershell
python -m venv .venv
.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt
.\\.venv\\Scripts\\python.exe src/fetch_data.py
.\\.venv\\Scripts\\python.exe src/execute_notebook.py
.\\.venv\\Scripts\\python.exe src/build_report.py
```

`execute_notebook.py` tạo kernel cục bộ dùng đúng Python đang gọi và thực thi toàn bộ notebook, gồm huấn luyện thật; không lấy metrics đã lưu làm kết quả huấn luyện. Nếu muốn tạo lại bố cục notebook từ source trước khi chạy, gọi `python src/build_notebook.py`. Trên macOS hoặc Linux, thay đường dẫn Python bằng executable của virtualenv tương ứng.

Khi dùng Microsoft Word trên Windows, có thể chạy `src/export_word_pdf.ps1` để cập nhật field và xuất PDF; script chạy Word ẩn. Bản PDF đã có sẵn trong gói. Các file PNG QA không nằm trong gói bàn giao.

Ví dụ chấm một snapshot mới có cùng định nghĩa cột sau khi đã kiểm tra thời điểm sẵn có:

```python
import sys, joblib
sys.path.insert(0, 'src')
from analysis_models import feature_engineering
model = joblib.load('output/analysis/production_model.joblib')
X_new, definitions = feature_engineering(new_snapshot)
new_probabilities = model.predict_proba(X_new)[:, 1]
```

## Đo hiệu quả retention

Phân bổ treatment và control ngẫu nhiên trong các tầng rủi ro và giá trị; ghi nhận phân nhóm trước liên hệ, chi phí và outcome. Đánh giá theo intention to treat và cùng cửa sổ theo dõi. Incremental retention lift bằng tỷ lệ duy trì treatment trừ control. Chỉ tính chi phí trên khách giữ lại tăng thêm khi tác động tăng thêm dương. Do chưa có experiment, gói này chưa ước lượng một offer giảm churn bao nhiêu.

## Nguồn

Empulse `fetch_cell2cell`: https://empulse.readthedocs.io/en/latest/guide/datasets/cell2cell.html

Nguồn dữ liệu đã ghim commit: {data['source_url']}

Cole Nussbaumer Knaflic, *Storytelling with Data*; Matthew O. Ward, Georges Grinstein, Daniel Keim, *Interactive Data Visualization: Foundations, Techniques, and Applications*. Thiết kế dùng tiêu đề kết luận, nhấn có chọn lọc, mẫu số rõ ràng, mã hóa vị trí/độ dài, khoảng bất định và nhiệm vụ tương tác cụ thể.
'''
    (BASE/'README.md').write_text(guide,encoding='utf-8')
    root_names=['Cell2Cell_Customer_Churn_Analysis.ipynb','Cell2Cell_Customer_Churn_Report.docx','Cell2Cell_Customer_Churn_Report.pdf','Cell2Cell_Churn_Risk_Scores.csv','Cell2Cell_Retention_Candidates_Historical.csv','README.md','requirements.txt']
    files=[BASE/n for n in root_names]
    for folder in ['src','data','output/analysis','output/charts','output/figures','output/interactive']:
        files.extend(p for p in (BASE/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
    hashes={str(p.relative_to(BASE)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    manifest=BASE/'DELIVERY_MANIFEST.json';manifest.write_text(json.dumps({'quality_checks':checks,'sha256':hashes},ensure_ascii=False,indent=2),encoding='utf-8')
    files.append(manifest)
    archive=BASE/'Cell2Cell_Customer_Churn_Project.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as bundle:
        for path in files: bundle.write(path,str(path.relative_to(BASE)).replace('\\','/'))
    print(json.dumps({'archive':str(archive),'files':len(files),'megabytes':round(archive.stat().st_size/1024**2,2),'quality_checks':checks},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
