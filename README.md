# Dự án phân tích Cell2Cell Customer Churn

Đây là gói kết quả và mã nguồn phục vụ phân tích khách hàng, xếp hạng rủi ro và thiết kế chính sách giữ chân. Báo cáo tiếng Việt gồm 34 trang, 21 hình và 13 bảng. Notebook đã thực thi đủ 61 ô code, không có lỗi; có 41 hình tĩnh và 4 công cụ khám phá tương tác.

## Tệp chính

- `Cell2Cell_Customer_Churn_Analysis.ipynb`: notebook có code, markdown, kết quả thực thi, nhận xét và khuyến nghị. Các ô `%%writefile` chứa toàn bộ mã nguồn phân tích có thể khôi phục module.
- `Cell2Cell_Customer_Churn_Report.docx`: báo cáo có thể chỉnh sửa, mục lục và danh mục tự động đã cập nhật bằng Word.
- `Cell2Cell_Customer_Churn_Report.pdf`: bản đọc và in đã kiểm tra mọi trang.
- `Cell2Cell_Churn_Risk_Scores.csv`: 50,891 điểm OOF trên toàn cohort lịch sử, có observed_churn và cờ xác nhận trạng thái hiện tại.
- `Cell2Cell_Retention_Candidates_Historical.csv`: 36,250 hồ sơ có observed_churn=0 trong dữ liệu nguồn, đã sắp xếp ưu tiên. Trong đó P1 gồm 2,534 người.

## Kết quả chính

Nguồn gồm 51,047 khách hàng. Empulse loại 156 dòng thiếu MonthlyRevenue, còn 50,891 người với 14,641 churner, tỷ lệ 28.77%. Mô hình được chọn là Histogram Gradient Boosting. Test ROC AUC = 0.6857, average precision = 0.4666. Top 20% theo rủi ro bao phủ 34.60% churner, lift 1.73 lần trên test. Những con số này không đo hiệu quả của một can thiệp giữ chân.

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

Môi trường đã kiểm tra: Python 3.11; phiên bản thư viện ghi chính xác trong `requirements.txt` và model_summary. Cài đặt môi trường Python riêng rồi chạy từ thư mục gốc gói dự án:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe src/fetch_data.py
.\.venv\Scripts\python.exe src/execute_notebook.py
.\.venv\Scripts\python.exe src/build_report.py
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

Nguồn dữ liệu đã ghim commit: https://raw.githubusercontent.com/janebunr/Cell2Cell/d646177d0c23e7dd7cde532ee7a5162c768fe963/Data%20files/cell2celltrain.csv

Cole Nussbaumer Knaflic, *Storytelling with Data*; Matthew O. Ward, Georges Grinstein, Daniel Keim, *Interactive Data Visualization: Foundations, Techniques, and Applications*. Thiết kế dùng tiêu đề kết luận, nhấn có chọn lọc, mẫu số rõ ràng, mã hóa vị trí/độ dài, khoảng bất định và nhiệm vụ tương tác cụ thể.
