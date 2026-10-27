"""Build a fully executable notebook with all implementation source embedded."""
from pathlib import Path
import json
import nbformat as nbf

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'output' / 'analysis'

def build():
    nb = nbf.v4.new_notebook()
    cells = []
    def md(s): cells.append(nbf.v4.new_markdown_cell(s))
    def code(s): cells.append(nbf.v4.new_code_cell(s))
    md('''# Phân tích khách hàng có khả năng rời bỏ dịch vụ và chính sách giữ chân

**Cell2Cell Customer Churn · Báo cáo phân tích khách hàng nội bộ · 27 tháng 10 năm 2026**

Tài liệu giúp ban quản lý xác định nhóm cần ưu tiên, các dấu hiệu liên quan đến churn và cách đo hiệu quả can thiệp. Kết quả mô tả dựa trên cohort quan sát; dữ liệu không cung cấp ngày snapshot và cửa sổ nhãn đủ tin cậy để gọi đây là tỷ lệ churn tháng hiện tại.

Notebook đọc dữ liệu bằng `empulse.datasets.fetch_cell2cell(backend=pd)`, giữ bản nguồn và mã khách hàng để đối soát, kiểm tra chất lượng, phân tích hành vi, xây dựng mô hình cảnh báo sớm, chấm điểm lịch sử và thiết kế chính sách giữ chân. Mọi kết quả và biểu đồ được tính lại khi chạy toàn bộ notebook. Báo cáo Word dùng chính các bảng kết quả này.

**Cách chạy:** giải nén gói dự án, đặt notebook tại thư mục gốc chứa `data` và `src`, cài `requirements.txt`, chọn kernel Python của môi trường dự án rồi Run All. Lần đầu cần mạng nếu chưa có cache. Các ô định nghĩa bên dưới ghi lại toàn bộ mã nguồn cần dùng, vì vậy notebook có thể khôi phục các module phân tích. Dữ liệu, mã nguồn, biểu đồ tương tác và tài liệu hướng dẫn đi kèm trong gói dự án.''')
    code('''from pathlib import Path
import os, sys, json, hashlib
BASE = Path.cwd().resolve()
if not (BASE / 'data').exists():
    raise FileNotFoundError('Mở notebook trong thư mục gốc của gói dự án có thư mục data.')
(BASE / 'src').mkdir(exist_ok=True)
os.environ['MPLCONFIGDIR'] = str(BASE / 'output' / '.matplotlib')
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.path.insert(0, str(BASE / 'src'))
RANDOM_STATE = 42
from IPython.display import display, Markdown, Image, IFrame
import pandas as pd
pd.set_option('display.max_columns', 60)
print('Thư mục dự án:', BASE)
print('Random state:', RANDOM_STATE)''')
    md('''## 1 Business Understanding

Quyết định cần hỗ trợ là thứ tự liên hệ khi năng lực retention chỉ đáp ứng một phần khách hàng. Quy trình phân tích đi từ chất lượng dữ liệu tới bức tranh churn, hồ sơ và hành vi, tương tác nhiều biến, xếp hạng dự báo, ưu tiên theo giá trị rồi kiểm nghiệm chính sách. Số churn và tỷ lệ churn được trình bày đồng thời với quy mô nhóm.

Thành công được đánh giá qua khả năng nhận diện churner ở top khách hàng ưu tiên và hiệu quả giữ chân tăng thêm trong thử nghiệm. Điểm dự báo không đo khả năng khách hàng sẽ phản hồi can thiệp. Do chưa có chi phí, biên lợi nhuận hoặc tác động can thiệp, dự án dùng doanh thu làm đại diện giá trị và không công bố CLV hay ROI ước đoán.''')
    md('''## 2 Mã nguồn có thể tái lập

Các ô dưới chứa toàn bộ xử lý dữ liệu, mô hình, trực quan hóa và ưu tiên khách hàng. `Pipeline` và `ColumnTransformer` bảo đảm các bước học từ dữ liệu chỉ fit trong tập huấn luyện. Bộ dữ liệu được ghim nguồn bằng commit và kiểm tra bằng SHA256.''')
    for name in ['runtime_compat.py','analysis_models.py','eda_visuals.py','risk_and_visuals.py']:
        md(f'### Mã nguồn {name}')
        code(f'%%writefile src/{name}\n' + (BASE/'src'/name).read_text(encoding='utf-8'))
    md('''## 3 Data Understanding và Data Quality Assessment

Loader có chuyển tên biến sang snake_case và loại dòng thiếu MonthlyRevenue. Dự án lưu nguyên các features do API trả về, đồng thời khôi phục tên cột nguồn và CustomerID qua ánh xạ một đối một đã đối chiếu nhãn và các trường số. Tập nguồn và tập phân tích có mẫu số riêng để tránh đổi quy mô khách hàng một cách âm thầm.''')
    code('''import importlib
import analysis_models as models
import eda_visuals as visuals
import risk_and_visuals as riskviz
importlib.reload(models); importlib.reload(visuals); importlib.reload(riskviz)
frame, data_manifest = models.acquire()
display(pd.DataFrame([{
    'Khách hàng nguồn': data_manifest['raw_rows'],
    'Khách hàng phân tích': data_manifest['loader_rows'],
    'Features do API trả': data_manifest['loader_feature_count'],
    'Dòng thiếu doanh thu bị loader loại': data_manifest['rows_removed_missing_monthly_revenue'],
    'Số churn': data_manifest['churn_count'],
    'Tỷ lệ churn': data_manifest['churn_rate'],
}]))
display(frame.head())
frame.info()
display(frame.describe(include='all').T)
display(pd.read_csv(BASE/'output/analysis/schema.csv'))''')
    md('''### Cleaning và kiểm tra leakage

Dữ liệu gốc được giữ nguyên. Tuổi bằng không được chuyển thành thiếu trong mô hình theo giả định mã không rõ tuổi; tuổi thiết bị âm được đánh dấu cần xác minh. Các giá trị doanh thu âm được giữ như khoản điều chỉnh có thể hợp lệ, không tự động xóa outlier. HandsetPrice dạng số hoặc Unknown được xử lý theo ý nghĩa trường; IncomeGroup là mã phân nhóm.

CustomerID và ServiceArea được loại khỏi mô hình. Các trường RetentionCalls, RetentionOffersAccepted và MadeCallToRetentionTeam chỉ phục vụ mô tả quy trình vì thời điểm phát sinh chưa được xác nhận. Cần kiểm chứng tất cả trường đều tồn tại trước thời điểm dự báo khi triển khai; riêng cơ chế thiếu của các chỉ số thay đổi sử dụng phải được điều tra.''')
    code('''# Thống kê EDA và biểu đồ được tính trực tiếp từ hai file dữ liệu đã kiểm tra.
visuals.run()
eda = json.loads((BASE/'output/analysis/eda.json').read_text(encoding='utf-8'))
eda_charts = json.loads((BASE/'output/analysis/charts.json').read_text(encoding='utf-8'))
display(pd.read_csv(BASE/'output/analysis/data_dictionary.csv'))
display(pd.read_csv(BASE/'output/analysis/missing_audit.csv'))
display(pd.read_csv(BASE/'output/analysis/validity_audit.csv'))
display(pd.read_csv(BASE/'output/analysis/outlier_audit.csv'))''')
    charts=json.loads((OUT/'charts.json').read_text(encoding='utf-8'))
    def chart(c, collection='eda_charts'):
        md(f'### {c["id"]} {c["title"]}\n\n**Câu hỏi kinh doanh:** {c.get("question", c.get("next_question", ""))}\n\n**Quyết định:** {c.get("decision", c.get("business_meaning", ""))}')
        code(f"_chart = next(c for c in {collection} if c['id'] == {c['id']!r})\ndisplay(Image(filename=str(BASE / _chart['path'])))")
        md(f'**Insight**\n\n{c["insight"]}\n\n**Business Meaning**\n\n{c["business_meaning"]}\n\n**Next Question**\n\n{c["next_question"]}')
    for c in charts:
        if c['id']=='E02': chart(c)
    md('''**Kết luận chất lượng dữ liệu.** Quy mô phân tích và số dòng bị loại được ghi trong manifest. Các lỗi phạm vi giá trị được phân biệt với hành vi cực đoan, và missing được giữ để xử lý trong từng phân vùng huấn luyện. Không dùng thống kê toàn bộ cohort để fit imputer hoặc chọn ngưỡng mô hình.''')
    md('''## 4 Customer Overview và Churn Situation

Phần này xác định quy mô churn, doanh thu, vòng đời và sử dụng trước khi đi vào từng nhóm. Các phân phối chỉ mô tả sự khác nhau giữa hai nhóm; dữ liệu không thiết lập trình tự thời gian hay quan hệ nguyên nhân.''')
    for c in charts:
        if c['id'] in ['E01','E03','E04','E05']: chart(c)
    md('''## 5 Customer Profile Usage Revenue Call Quality và Lifecycle Analysis

Các nhóm được tạo từ phân phối quan sát và giữ riêng nhóm thiếu. Mỗi bảng phân nhóm chứa quy mô, số churn, tỷ lệ churn và khoảng tin cậy để phân biệt mức độ rủi ro với lượng khách hàng. Trục thời gian gắn bó và các nhóm sử dụng có thứ tự; đây không phải chuỗi thời gian theo lịch.''')
    for c in charts:
        if 'E06' <= c['id'] <= 'E25': chart(c)
    code('''display(pd.read_csv(BASE/'output/analysis/segment_profiles.csv'))
display(pd.read_csv(BASE/'output/analysis/descriptive_statistics.csv'))''')
    md('''**Kết luận phân tích đặc trưng.** Cần sử dụng chiều liên hệ thực sự trong dữ liệu thay vì mặc định khách hàng mới, nhiều cuộc gọi hỗ trợ hoặc nhiều cuộc gọi rớt luôn có rủi ro cao hơn. Nhãn các biến PercChange được giữ là chỉ số thay đổi theo nguồn; chưa gắn đơn vị phần trăm khi chưa có định nghĩa công thức. Các trường retention chỉ cho biết liên hệ quan sát, không đo hiệu quả của offer.''')
    md('''## 6 Multivariate Analysis và Churn Driver Summary

Tương tác được trình bày bằng heatmap có quy mô từng ô. Nhóm nhỏ cần thận trọng ngay cả khi tỷ lệ churn cao. Thống kê đơn biến kết hợp effect size và p-value; p-value nhỏ trên dữ liệu lớn không tự động tạo ra giá trị kinh doanh. Các phép kiểm tra mang tính khám phá, không phải kết luận xác nhận một giả thuyết duy nhất.''')
    for c in charts:
        if c['id'] >= 'E26': chart(c)
    code("display(pd.read_csv(BASE/'output/analysis/univariate_associations.csv'))")
    md('''## 7 Feature Engineering và Operational Early Warning Model

Bốn tỷ số có ý nghĩa được tạo bằng phép tính theo từng dòng: doanh thu trên phút sử dụng, thuê bao hoạt động trên tổng thuê bao, liên hệ hỗ trợ trên thời lượng và chỉ báo rớt/chặn cuộc gọi trên thời lượng. Mẫu số bằng không tạo missing, không được thay bằng một giá trị tùy ý.

Dữ liệu được chia stratified thành train, validation và test với random state 42. Logistic Regression tạo mốc so sánh; Random Forest và Histogram Gradient Boosting kiểm tra quan hệ phi tuyến. Chọn mô hình dựa trên average precision và chất lượng xếp hạng trên validation. Ngưỡng liên hệ được chọn trên validation cho kịch bản năng lực, rồi đóng băng trước đánh giá test. Kiểm tra hiệu chỉnh sigmoid cũng chỉ dùng train và validation.

Không có mốc snapshot đủ tin cậy nên chưa đánh giá được drift và kết quả ở thời kỳ tương lai. Stratified random split không thay thế được temporal validation khi vận hành.''')
    code('''# Chạy huấn luyện thực sự từ đầu; không lấy metrics từ kết quả đã lưu.
models.run()
model_summary = json.loads((BASE/'output/analysis/model_summary.json').read_text(encoding='utf-8'))
display(pd.DataFrame(model_summary['splits']).T)
display(pd.DataFrame(model_summary['feature_engineering']))
display(pd.read_csv(BASE/'output/analysis/model_comparison_validation.csv'))
display(pd.DataFrame([model_summary['test']]))
display(pd.DataFrame(model_summary['test_bootstrap_95_ci']).T)
print('Missing policy:', model_summary['missing_policy'])
print('Excluded identifiers:', model_summary['excluded_identifiers'])
print('Excluded leakage:', model_summary['excluded_potential_leakage'])''')
    md('''## 8 Model Evaluation Interpretability và Threshold Analysis

Average precision đánh giá chất lượng xếp hạng trong Precision–Recall; ROC AUC đánh giá phân biệt tổng thể. Precision, recall và số người được chọn thay đổi theo ngưỡng. Đánh giá test dùng cấu hình và ngưỡng đã đóng băng. Khoảng bootstrap phản ánh biến thiên trên tập test quan sát, chưa bao gồm drift ở thời gian mới.

Coefficient của Logistic Regression cho biết chiều liên hệ trong cấu trúc mô hình. Permutation importance đo mức suy giảm chất lượng khi xáo trộn một trường và có thể bị phân tán bởi các trường tương quan. Cả hai đều không phải tác động nhân quả.''')
    code('''risk_scores, model_charts = riskviz.run()
display(pd.read_csv(BASE/'output/analysis/threshold_analysis_validation.csv'))
display(pd.read_csv(BASE/'output/analysis/logistic_coefficients.csv').head(25))
display(pd.read_csv(BASE/'output/analysis/permutation_importance_test.csv').head(20))''')
    modelcharts=json.loads((OUT/'model_charts.json').read_text(encoding='utf-8')) if (OUT/'model_charts.json').exists() else []
    for c in modelcharts:
        if c['id'] <= 'M07': chart(c,'model_charts')
    md('''## 9 Customer Risk Scoring Segmentation và Prioritization

Điểm lịch sử được tạo bằng năm fold: từng khách hàng được chấm bởi mô hình không fit nhãn của chính người đó. Cấu hình được chọn từ cùng dữ liệu lịch sử nên metrics OOF không thay thế kết quả test độc lập. Mô hình production fit toàn bộ lịch sử được lưu riêng sau khi đóng đánh giá.

Các ngưỡng Low, Medium, High và Very High Risk lấy từ phân vị validation. Giá trị dùng MonthlyRevenue không âm; đây là đại diện giá trị, chưa phải CLV. Các cờ dấu hiệu chỉ được dùng khi nhóm tương ứng trong train có quy mô đủ và churn rate cao hơn baseline. Chúng mô tả hồ sơ đi kèm, không phải giải thích đóng góp cục bộ của từng dự đoán.

P1 kết hợp giá trị cao và rủi ro cao; P2 là giá trị cao với rủi ro trung bình; P3 dùng chăm sóc chi phí thấp cho giá trị thấp hơn với rủi ro từ trung bình; P4 theo dõi. Thứ tự trong nhóm dùng xác suất nhân đại diện giá trị và không thể được diễn giải là doanh thu sẽ cứu được.''')
    code('''risk_summary = json.loads((BASE/'output/analysis/risk_summary.json').read_text(encoding='utf-8'))
display(pd.read_csv(BASE/'output/analysis/personas.csv'))
display(pd.read_csv(BASE/'output/analysis/risk_segments.csv'))
display(pd.read_csv(BASE/'output/analysis/priority_summary.csv'))
display(pd.DataFrame(risk_summary['signal_evidence_train']).T)
display(risk_scores.head(15)[['customer_id','churn_probability','risk_segment','priority_level','key_risk_signals','observed_churn','recommended_action']])
assert risk_scores.customer_id.is_unique
assert risk_scores.churn_probability.between(0,1).all()
assert len(risk_scores) == len(frame)
assert not risk_scores[['customer_id','churn_probability','risk_segment','priority_level','recommended_action']].isna().any().any()''')
    for c in modelcharts:
        if c['id'] in ['M10','M11']: chart(c,'model_charts')
    md('''**Kết luận chấm điểm.** File toàn bộ cohort giữ nhãn churn đã quan sát và trạng thái cần xác nhận. File ứng viên lịch sử chỉ giữ nhóm chưa churn trong snapshot nguồn. Trước khi gọi khách hàng, công ty cần lấy snapshot mới, xác nhận khách còn hoạt động, thời điểm sẵn có của mọi feature và các điều kiện liên hệ trong hệ thống vận hành.''')
    md('''## 10 Targeting Deciles Lift và Cumulative Gains

Kịch bản top 5%, 10%, 20% và 30% phản ánh các phương án năng lực được yêu cầu phân tích. Số churner bao phủ là số đã quan sát trong test, không phải số sẽ được giữ chân. Lift là precision của nhóm ưu tiên chia tỷ lệ churn của toàn test.''')
    code("display(pd.read_csv(BASE/'output/analysis/targeting_test.csv'))\ndisplay(pd.read_csv(BASE/'output/analysis/deciles_test.csv'))")
    for c in modelcharts:
        if c['id'] in ['M08','M09']: chart(c,'model_charts')
    md('''## 11 Interactive Data Visualization

Thiết kế áp dụng Knaflic bằng tiêu đề kết luận từ kết quả, trục và nhãn trực tiếp, màu cam cho churn hoặc điểm cần chú ý, nền xám cho nhóm so sánh và hạn chế đường kẻ. Thiết kế theo Ward, Grinstein và Keim xác định nhiệm vụ tương tác trước: nhận diện bằng hover, so sánh nhóm, lọc theo dấu hiệu, chọn vùng để khám phá. Vị trí và độ dài mã hóa các so sánh định lượng; không dùng diện tích hoặc bảng màu cầu vồng để thay so sánh chính xác.

Biểu đồ tương tác có bản HTML tự chứa trong `output/interactive`. Các file này mở độc lập trong trình duyệt. Hover giúp kiểm tra hồ sơ, legend/menu lọc nhóm; zoom chỉ thay đổi vùng xem, không thay đổi mẫu số của bảng kết quả đã tính.''')
    code('''# Bổ sung risk explorer khi file điểm đã được tạo.
interactive_records = visuals.make_interactive(pd.read_csv(BASE/'data/cell2cell_analysis.csv')) + visuals.add_risk_interactive()
visuals.write_json(BASE/'output/analysis/interactive_charts.json', interactive_records)
interactive = json.loads((BASE/'output/analysis/interactive_charts.json').read_text(encoding='utf-8'))
display(pd.DataFrame(interactive))''')
    interactive=json.loads((OUT/'interactive_charts.json').read_text(encoding='utf-8')) if (OUT/'interactive_charts.json').exists() else []
    # At least four explorer cells are generated after initial risk scoring.
    for c in interactive:
        md(f'### {c["id"]} {c.get("title", c.get("name", "Khám phá dữ liệu"))}\n\n**Interaction task:** {c.get("interaction_task", c.get("task", "Identify, compare, filter, explore"))}')
        code(f"_interactive = next(c for c in interactive if c['id'] == {c['id']!r})\n_interactive_path = Path(_interactive['path'])\n_interactive_src = _interactive_path.relative_to(BASE).as_posix() if _interactive_path.is_absolute() else _interactive_path.as_posix()\ndisplay(IFrame(src=_interactive_src, width='100%', height=600))")
    md('''## 12 Retention Strategies Business Recommendations và KPI

Đội retention nên bắt đầu từ nhóm giá trị cao và điểm rủi ro cao sau khi xác nhận trạng thái hiện tại. Chuyên viên cần kiểm tra dấu hiệu quan sát được trước khi lựa chọn giải pháp. Nhóm giảm sử dụng cần xác minh thay đổi nhu cầu và độ phù hợp gói cước; nhóm có thiết bị sử dụng lâu cần kiểm tra khả năng đáp ứng rồi mới tư vấn đổi thiết bị. Sự cố và lịch sử hỗ trợ cần được rà soát khi thực sự hiện diện, không mặc định nhiều cuộc gọi chăm sóc đồng nghĩa với churn.

Chính sách được triển khai theo chuỗi bằng chứng, khách hàng mục tiêu, can thiệp, lý do và KPI. Nhóm giá trị thấp hơn có thể dùng kênh tự động và chuyển chuyên viên khi phát hiện vấn đề. Nhóm điểm thấp tiếp tục được theo dõi và chăm sóc phù hợp nhu cầu. Chi phí offer và doanh thu được bảo vệ không thể suy ra chỉ từ churn probability.

Quy trình vận hành gồm cập nhật snapshot, kiểm tra chất lượng và tính sẵn có, chấm điểm, lọc trạng thái hoạt động, xếp ưu tiên theo năng lực, phân công chăm sóc, ghi nhận kết quả và đánh giá bằng nhóm đối chứng. Trước production cần kiểm tra calibration, drift và khả năng tái lập trên snapshot tiếp theo.''')
    code('''kpi = pd.DataFrame([
    ['Churn rate','Số churn / số đủ điều kiện theo cùng cửa sổ','Theo kỳ nhãn'],
    ['Precision@k','Churner trong top k / khách trong top k','Mỗi kỳ đánh giá'],
    ['Capture@k','Churner trong top k / toàn bộ churner','Mỗi kỳ đánh giá'],
    ['Lift@k','Precision@k / churn rate toàn cohort','Mỗi kỳ đánh giá'],
    ['Offer acceptance','Người chấp nhận / người nhận offer hợp lệ','Theo chiến dịch'],
    ['Observed retained rate','Khách còn hoạt động / khách đủ điều kiện theo dõi','Theo cửa sổ kết quả'],
    ['Incremental retention lift','Retained rate treatment - retained rate control','Sau thử nghiệm'],
    ['Incremental saved customers','Incremental retention lift × số khách treatment','Sau thử nghiệm'],
    ['Cost per incremental save','Chi phí tăng thêm / incremental saved customers','Khi tác động tăng thêm dương'],
    ['Incremental revenue protected','Doanh thu trên khách treatment trừ control, điều chỉnh quy mô','Sau thử nghiệm'],
],columns=['KPI','Công thức','Tần suất'])
display(kpi)
kpi.to_csv(BASE/'output/analysis/kpi_framework.csv',index=False,encoding='utf-8-sig')''')
    md('''### Thiết kế thử nghiệm retention

Phân bổ ngẫu nhiên treatment và control trong các tầng rủi ro và giá trị đủ điều kiện. Cả hai nhóm phải có cùng ngày bắt đầu và cửa sổ theo dõi nhãn. Ghi nhận phân nhóm trước khi liên hệ và đánh giá theo intention to treat, kể cả khách không nghe máy. KPI chính là chênh lệch tỷ lệ duy trì giữa treatment và control cùng khoảng tin cậy; tỷ lệ chấp nhận offer chỉ là chỉ số quy trình.

Chọn mức tác động tối thiểu có ý nghĩa, cỡ mẫu và thời hạn theo dõi trước khi chạy dựa trên năng lực, baseline kỳ triển khai và ngân sách. Dữ liệu hiện tại chưa chứa phép phân bổ ngẫu nhiên nên không cung cấp bằng chứng rằng một offer cụ thể làm giảm churn. Hiệu quả targeting và hiệu quả can thiệp là hai câu hỏi phải được đo riêng.

## 13 Kết luận và giới hạn

Kết quả giúp xếp hạng và lựa chọn nhóm cần kiểm tra, nhưng không xác định chắc chắn khách nào sẽ rời bỏ hoặc ai có thể được giữ chân. Dữ liệu quan sát còn thiếu mốc thời gian, chi phí, đối thủ và thông tin nguyên nhân chi tiết. Các biến nhạy với mã hóa hoặc cơ chế thiếu cần được xác minh với chủ dữ liệu. Ưu tiên tiếp theo là chuẩn hóa snapshot trước sự kiện, thử nghiệm retention có đối chứng và theo dõi mô hình ở các kỳ mới.

### Tài liệu tham khảo

1. Empulse, tài liệu và mã nguồn `fetch_cell2cell`: https://empulse.readthedocs.io/en/latest/guide/datasets/cell2cell.html và https://empulse.readthedocs.io/en/latest/_modules/empulse/datasets/_remote.html
2. Cole Nussbaumer Knaflic, *Storytelling with Data*, 2015. Tài liệu được yêu cầu: https://luutruvn.com/wp-content/uploads/2025/03/Storytelling-with-Data_-A-Data-Visualization-Guide-for-Business-Professionals-PDFDrive-.pdf ; các nguyên tắc thiết kế được áp dụng và đối chiếu qua bản trích sách của nhà xuất bản: https://www.oreilly.com/library/view/storytelling-with-data/9781119002253/f_07.xhtml
3. Matthew O. Ward, Georges Grinstein, Daniel Keim, *Interactive Data Visualization: Foundations, Techniques, and Applications*, ấn bản 2, 2015. Trang tác giả: https://www.idvbook.com/index.html ; hướng dẫn thiết kế: https://davis.wpi.edu/~matt/projects/visbook/ch14.html

### Kiểm tra cuối và xuất file

Các assertion dưới kiểm tra quy mô, ánh xạ target, exclusion leakage, xác suất, tính duy nhất mã khách và artifact đã tạo. Báo cáo Word và PDF được tạo từ cùng JSON và CSV sau lần thực thi notebook thành công.''')
    code('''import numpy as np
assert data_manifest['loader_rows'] == len(frame)
assert int(frame.Churn.sum()) == data_manifest['churn_count']
x_check, _ = models.feature_engineering(frame)
assert not set(['CustomerID','ServiceArea','RetentionCalls','RetentionOffersAccepted','MadeCallToRetentionTeam','Churn']).intersection(x_check.columns)
assert model_summary['splits']['test']['n'] == len(pd.read_csv(BASE/'output/analysis/predictions_test.csv'))
assert sum(v['n'] for v in model_summary['splits'].values()) == len(frame)
for key,file in [('raw_sha256','data/cell2cell_raw.csv'),('analysis_sha256','data/cell2cell_analysis.csv')]:
    assert hashlib.sha256((BASE/file).read_bytes()).hexdigest() == data_manifest[key]
assert len(eda_charts)==30 and len(model_charts)==11 and len(interactive)==4
for chart in eda_charts+model_charts+interactive:
    assert (BASE/chart['path']).is_file(), chart['path']
assert (BASE/'Cell2Cell_Churn_Risk_Scores.csv').is_file()
print('PASS: raw audit, target, split, leakage exclusions, scores, 41 static charts và 4 interactive explorers.')''')
    nb['cells']=cells
    nb['metadata']={'kernelspec':{'display_name':'Python Cell2Cell','language':'python','name':'cell2cell'},'language_info':{'name':'python','version':'3.11'},'cell2cell':{'random_state':42,'source':'Empulse pinned Cell2Cell','results_generated_from_dataset':True}}
    path=BASE/'Cell2Cell_Customer_Churn_Analysis.ipynb'
    nbf.write(nb,path)
    print(f'Built {path.name}: {len(cells)} cells')
    return path

if __name__=='__main__': build()
