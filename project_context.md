# Project Context — Cell2Cell Customer Churn & Retention

## 1. Bối cảnh và quyết định kinh doanh

Cell2Cell cần xây dựng một quy trình phân tích giúp trả lời ba câu hỏi theo đúng thứ tự:

1. **Ai có khả năng rời bỏ dịch vụ?**
2. **Tín hiệu nào giải thích vì sao khách hàng đó được xếp vào nhóm rủi ro?**
3. **Công ty nên thử chính sách giữ chân nào, với nhóm nào và đo hiệu quả ra sao?**

Dự án ưu tiên khả năng giải thích và hành động. Mô hình dự đoán là công cụ xếp hạng khách hàng, không phải kết luận chắc chắn rằng một khách hàng sẽ churn. Chính sách giữ chân chỉ được xem là hiệu quả khi tạo ra tác động tăng thêm so với nhóm đối chứng.

Bộ dữ liệu complete-case hiện có **49.752 khách hàng**, **14.245 churner** và baseline churn **28,63%**. Đây là mẫu số chuẩn cho các phân tích sau khi BQ01 xác nhận cohort không bị sai lệch đáng kể so với dữ liệu gốc.

## 2. Storytelling cố định

Toàn bộ notebook, dashboard, báo cáo và thuyết trình phải đi theo cùng một mạch:

> **Tin dữ liệu → định lượng churn → tìm thời điểm rủi ro → giải thích tín hiệu → dự đoán ai có khả năng churn → ưu tiên và chọn chính sách → thử nghiệm và giám sát**

| Hồi | Câu hỏi quản trị | Vai trò trong câu chuyện | Quyết định sau hồi |
|---|---|---|---|
| 1. Tin dữ liệu và quy mô | Dữ liệu có đáng tin và churn lớn đến đâu? | Khóa cohort, target, denominator và baseline | Có đủ điều kiện phân tích hay phải quay lại xử lý dữ liệu |
| 2. Thời điểm và thiết bị | Rủi ro xuất hiện ở giai đoạn nào, thiết bị có liên quan không? | Tìm cửa sổ can thiệp theo tenure và thiết bị | Khi nào cần liên hệ, nhóm nào cần device review |
| 3. Giá trị, phí và tín dụng | Giá trị và gánh nặng phí liên quan thế nào đến churn? | Phân biệt value với price/plan mismatch | Nhóm nào cần bill review, plan review hoặc payment support |
| 4. Sử dụng và thay đổi hành vi | Mức sử dụng và xu hướng thay đổi có tạo cảnh báo sớm không? | Tìm tín hiệu disengagement có độ phủ và lead time | Khi nào kích hoạt re-engagement |
| 5. Dự đoán và ưu tiên | Tín hiệu nào còn hữu ích khi xem đồng thời và ai cần ưu tiên? | Khóa mô hình 10 feature, risk decile và reason code | Danh sách khách hàng/segment ưu tiên theo capacity |
| 6. Chính sách và đo hiệu quả | Can thiệp nào phù hợp và có tạo tác động tăng thêm không? | Ghép reason code với treatment, A/B test và monitoring | Mở rộng, sửa hoặc dừng chính sách |

Không đảo thứ tự này chỉ vì một biểu đồ hoặc một mô hình có kết quả nổi bật. Phần “ai có rủi ro” phải đứng sau phần xác nhận dữ liệu và bằng chứng mô tả; phần “chính sách” phải đứng sau risk ranking và reason code.

## 3. Mục tiêu dự án

### 3.1. Mục tiêu chính

- Nhận diện khách hàng có xác suất churn cao bằng bộ 10 feature đã khóa.
- Giải thích rủi ro bằng các tín hiệu có thể hiểu, có thể kiểm tra và có đường dẫn hành động.
- Ưu tiên nguồn lực theo **rủi ro × value proxy × actionability × capacity**.
- Thiết kế chính sách theo reason code thay vì phát ưu đãi đồng loạt.
- Đo incremental churn reduction bằng treatment/control và guardrail.

### 3.2. Người dùng kết quả

| Người ra quyết định | Quyết định cần hỗ trợ | Đầu ra cần có |
|---|---|---|
| Head of Retention | Nhóm nào cần ưu tiên ở chu kỳ tiếp theo? | Risk decile, priority segment, expected churners reached |
| CRM/Campaign Manager | Liên hệ ai, lúc nào, bằng chính sách nào? | Campaign list, reason code, treatment, exclusion và channel |
| Customer Care | Khách nào cần bill/plan/service review? | Trigger và giải thích ngắn gọn ở cấp khách hàng |
| Pricing/Commercial | Có nhóm price/plan mismatch đủ lớn để thử nghiệm không? | Revenue, recurring charge và usage profile theo churn |
| Device team | Nhóm thiết bị nào phù hợp với upgrade/trade-in pilot? | Equipment cohort, web capability và churn lift |
| Data/BI/Model Risk | Mô hình có ổn định, công bằng và còn hiệu lực không? | Model card, calibration, lift, drift và fairness monitoring |

## 4. Hợp đồng dữ liệu

### 4.1. Cohort và target

- Nguồn phân tích chính: `data/cell2cell_complete_cases.csv`.
- Đơn vị quan sát: một khách hàng/thuê bao trong snapshot.
- Target: `Churn`; quy ước nhị phân phải được xác nhận trước khi tính metric.
- `CustomerID` chỉ dùng đối soát và ghép danh sách. Không đưa vào phân tích liên hệ hoặc mô hình.
- Mọi churn rate phải kèm `n`, churn count và denominator của cùng cohort.
- Dữ liệu là snapshot quan sát. Không được tự suy ra thứ tự thời gian hoặc quan hệ nhân quả.

### 4.2. Bộ 10 base feature duy nhất

Chỉ mười cột dưới đây được xem là predictor gốc trong analytical model contract.

| # | Nhóm | Base feature | Vai trò | Hành động có thể liên hệ | Giới hạn diễn giải |
|---:|---|---|---|---|---|
| 1 | Vòng đời | `MonthsInService` | Xác định cửa sổ rủi ro theo tenure | Lifecycle check-in | Không chứng minh khách hết ưu đãi |
| 2 | Thiết bị | `CurrentEquipmentDays` | Proxy tuổi thiết bị hiện tại | Device review/upgrade pilot | Cần audit giá trị âm và outlier |
| 3 | Thiết bị | `HandsetWebCapable` | Tín hiệu về khả năng tương thích thiết bị với dịch vụ data | Kiểm tra tương thích/cấu hình hoặc hướng dẫn dịch vụ | Không phải chức năng do nhà mạng cung cấp; không đồng nghĩa chất lượng mạng hay mức sử dụng Internet |
| 4 | Giá trị | `MonthlyRevenue` | Proxy doanh thu hàng tháng | Ưu tiên value và plan review | Không phải margin hoặc CLV |
| 5 | Phí | `TotalRecurringCharge` | Mức phí định kỳ | Bill/plan review | Không phản ánh toàn bộ cấu trúc giá |
| 6 | Tín dụng | `CreditRating` | Phân khúc tín dụng trong dữ liệu | Payment support nếu được phép | Không dùng để định giá bất lợi hoặc loại hỗ trợ |
| 7 | Sử dụng | `MonthlyMinutes` | Mức độ sử dụng dịch vụ | Re-engagement hoặc right-size plan | Không tự chứng minh mức hài lòng |
| 8 | Thay đổi hành vi | `PercChangeMinutes` | Xu hướng tăng/giảm sử dụng | Usage-decline trigger | Giữ nguyên đơn vị nguồn đến khi metadata xác nhận |
| 9 | Thay đổi hành vi | `PercChangeRevenues` | Xu hướng tăng/giảm chi tiêu | Spend-decline trigger | Không tự suy ra nguyên nhân |
| 10 | Sử dụng | `PeakCallsInOut` | Cường độ gọi giờ cao điểm | Usage pattern/reason code | Không chia cho minutes nếu khác đơn vị |

### 4.3. Target, ID, derived field và external input không phải base feature

| Loại | Trường | Quy tắc sử dụng |
|---|---|---|
| Target | `Churn` | Dùng tính outcome và huấn luyện; không tính vào 10 feature |
| Identifier | `CustomerID` | Chỉ đối soát/ghép danh sách; không làm predictor |
| QA fields | Missing flags, duplicate flag, validation status | Chỉ dùng kiểm tra chất lượng dữ liệu |
| Derived EDA | `TenureBand`, `EquipmentAgeBand`, `ValueTier`, `ChargeBand`, `MinutesBand` | Dẫn xuất từ base feature để mô tả/segment; không phải feature mới |
| Derived behavior | `UsageTrendBand`, `RevenueTrendBand`, `RevenueChargeGap`, `DisengagementFlag` | Phục vụ chart/reason code; phải lưu công thức và ngưỡng |
| Model output | `RiskScore`, `RiskDecile`, reason code | Được tạo từ mô hình 10 feature trên OOF/holdout |
| Decision output | `PrioritySegment` | Kết hợp risk, value proxy và actionability |
| External policy input | Capacity, contact cost, offer cost, margin/CLV, uplift assumption | Chỉ dùng scenario/pilot; không đưa vào mô hình churn khi nguồn chưa tồn tại |
| Experiment field | Treatment, control, outcome window, contact/offer exposure | Chỉ xuất hiện ở giai đoạn thử nghiệm và đo hiệu quả |

`EquipmentAgeBand` là nhóm dẫn xuất từ `CurrentEquipmentDays`, không phải feature thứ 11. Ngưỡng phải được tạo trong BQ06, lưu rõ biên và kiểm tra độ nhạy. Mô hình chính dùng `CurrentEquipmentDays`; không đưa đồng thời biến gốc và band vào model nếu chưa chứng minh lợi ích và kiểm soát redundancy.

Riêng **BQ07 không sử dụng band**. BQ07 giữ `CurrentEquipmentDays` và `MonthsInService` dạng liên tục, dùng spline/GAM để kiểm tra `HandsetWebCapable` còn tạo khác biệt churn sau điều chỉnh hay không. Biến này chỉ được nối với chính sách tương thích/cấu hình dịch vụ data khi adjusted effect ổn định; không tự động dẫn tới chính sách đổi điện thoại.

### 4.4. Biến loại khỏi mô hình chính

- `ServiceArea`: cardinality cao và có thể là proxy địa lý khó quản trị.
- `RetentionCalls`, `RetentionOffersAccepted`, `MadeCallToRetentionTeam`: có rủi ro timing leakage/reverse causality.
- Các biến nhân khẩu/lifestyle khác: ngoài feature contract; chỉ dùng trong sensitivity/fairness review khi có lý do và phê duyệt rõ.
- Promotion, contract expiry, margin và CLV: hiện không có trong nguồn chính; chỉ nêu là dữ liệu cần bổ sung, không giả lập thành fact.

## 5. Bằng chứng hiện có và cách sử dụng

| Bằng chứng | Kết quả đã quan sát | Cách dùng đúng |
|---|---|---|
| Baseline | 49.752 khách; 14.245 churn; 28,63% | Mẫu tham chiếu cho mọi segment |
| Tuổi thiết bị | `CurrentEquipmentDays` có point-biserial r ≈ 0,1025 | Ưu tiên kiểm tra phi tuyến và cohort thiết bị; không kết luận nguyên nhân |
| Phí định kỳ | `TotalRecurringCharge` có r ≈ -0,0590 | Kiểm tra band/tương tác; không diễn giải dấu âm như tác động của tăng phí |
| Mức sử dụng | `MonthlyMinutes` có r ≈ -0,0502 | Kiểm tra low-engagement và thay đổi hành vi |
| Credit | `CreditRating` có Cramér's V ≈ 0,0663 | Phân tích nhóm kèm fairness/governance |
| Capability | `HandsetWebCapable` có Cramér's V ≈ 0,0623 | Chỉ là tín hiệu đơn biến; BQ07 phải kiểm tra bằng đường xác suất điều chỉnh liên tục theo tuổi thiết bị và tenure |
| Tenure | Tháng 6: 19,53%; 7–11: 24,22%; 12–18: 32,98% | Xác định cửa sổ rủi ro; không gọi là hết ưu đãi |
| Benchmark | CatBoost 10 feature AUC ≈ 0,6585; log loss ≈ 0,5663 | Dùng làm benchmark xếp hạng, không phải mức hiệu quả kinh doanh |

Mọi kết quả được gắn một trong bốn trạng thái:

- **Observed:** mô tả trực tiếp từ dữ liệu đã kiểm tra.
- **Supported:** còn ổn định sau sensitivity/đa biến phù hợp.
- **Hypothesis:** giải thích hoặc chính sách cần kiểm chứng.
- **Tested:** có bằng chứng treatment/control với outcome window đã khóa.

## 6. Kiến trúc 20 Business Questions

| Hồi | BQ | Trọng tâm | Kết quả quyết định |
|---|---|---|---|
| 1. Tin dữ liệu và quy mô | BQ01–BQ03 | Cohort, baseline, feature readiness | Mẫu số, target và 10 feature đủ điều kiện sử dụng |
| 2. Thời điểm và thiết bị | BQ04–BQ07 | Tenure, tuổi thiết bị và capability đã điều chỉnh liên tục | Cửa sổ can thiệp và quyết định giữ/hạ vai trò/loại capability khỏi chính sách |
| 3. Giá trị, phí và tín dụng | BQ08–BQ11 | Revenue, recurring charge, gap, credit | Nhóm bill/plan/payment review |
| 4. Sử dụng và thay đổi hành vi | BQ12–BQ15 | Minutes, change signals, peak pattern, disengagement | Trigger hành vi có độ phủ và lead time |
| 5. Dự đoán và ưu tiên | BQ16–BQ18 | Evidence, model selection, risk/value prioritization | Ai có khả năng churn và ai cần liên hệ trước |
| 6. Chính sách và đo hiệu quả | BQ19–BQ20 | Policy mapping, experiment, monitoring | Treatment nào nên thử và điều kiện scale/stop |

Chi tiết objective, feature, metric, phương pháp, chart, deliverable và acceptance criteria nằm trong `analysis_pipeline.md`. `timeline.xlsx` là nguồn quản lý owner, dependency, ngày thực hiện và decision gate.

## 7. Chính sách giữ chân cần kiểm chứng

| Reason-code hypothesis | Nhóm mục tiêu | Can thiệp nên thử | Primary KPI | Guardrail |
|---|---|---|---|---|
| Lifecycle risk | Tenure trong cửa sổ rủi ro và risk cao | Check-in, bill/plan explanation, conditional offer | Incremental churn reduction | Contact fatigue, offer cost |
| Device–data compatibility | BQ07 cho thấy adjusted effect ổn định và khách có risk cao | Kiểm tra tương thích/cấu hình, hướng dẫn dịch vụ data; chỉ thử đổi thiết bị nếu có chương trình thiết bị | Incremental churn reduction, issue-resolution rate | Contact burden, complaint rate, treatment cost |
| Price/plan mismatch | Phí định kỳ cao so với revenue/usage profile | Bill review, right-size plan, cap/alert | Retention và plan acceptance | Revenue dilution |
| Behavioral decline | Minutes/revenue giảm, disengagement lift cao | Re-engagement, plan review | Churn reduction, usage recovery | Opt-out, spam/contact burden |
| High risk/high value | Risk decile cao và value proxy cao | Priority care/service review | Retained value proxy | Cost per save |
| Payment support | Credit segment có disparity và đủ điều kiện | Reminder/payment flexibility theo policy | Incremental retention | Fairness gap, delinquency |

Các chính sách trên là **hypothesis to test**. Không ghi “giải pháp hiệu quả” trước BQ20.

## 8. Tiêu chuẩn phân tích

### 8.1. Thống kê mô tả

- Count, churn count, churn rate, median, IQR và distribution.
- Chênh lệch điểm phần trăm, risk ratio, confidence interval và effect size.
- Báo cả risk và reach; nhóm churn cao nhưng quá nhỏ không tự động trở thành ưu tiên.
- Ngưỡng band phải được định nghĩa trước khi đánh giá cuối hoặc kiểm tra trên validation set.
- Không chọn một ô interaction nổi bật nếu không có minimum-cell rule và stability check.

### 8.2. Mô hình dự đoán

- Mô hình chính: CatBoost vì xử lý categorical feature mà không cần manual one-hot encoding.
- Chỉ dùng 10 base feature trong model contract.
- Chọn depth theo out-of-fold/validation log loss, đồng thời xem ROC-AUC, PR-AUC và overfitting gap.
- Đánh giá calibration, lift/gain và recall/precision tại campaign capacity 5%, 10% và 20%.
- Risk score phải được tạo out-of-fold hoặc holdout; không dùng fitted probability trên training set để báo lift.
- SHAP/feature contribution dùng làm reason code, không được gọi là nguyên nhân churn.

### 8.3. Chính sách và kinh tế

- Threshold liên hệ dựa trên capacity và expected incremental value, không mặc định 0,5.
- Nếu thiếu margin, cost và uplift, báo `n.a.` và xây dựng framework scenario; không tự tạo ROI.
- Mỗi policy cần eligibility, exclusion, treatment, control, channel, timing, primary KPI, guardrail và stop rule.
- Credit-sensitive policy phải được fairness review trước pilot.

## 9. Timeline và decision gates

Dự án thực hiện trong **15 ngày làm việc**, hai analyst làm song song, với 20 BQ và các cổng quyết định:

| Gate | Thời điểm | Điều kiện qua gate |
|---|---|---|
| G1 — Data lock | Day 2 | Cohort, target, denominator và feature dictionary được khóa |
| G2 — Descriptive evidence | Day 6 | Lifecycle/device/usage signal có count, CI và sensitivity |
| G3 — Segment logic | Day 8 | Financial và behavioral reason-code hypothesis được định nghĩa |
| G4 — Model acceptance | Day 11 | 10-feature model có validation loss, calibration và lift@capacity |
| G5 — Policy readiness | Day 13 | Priority segment, treatment, exclusion và economic assumptions rõ |
| G6 — Pilot readiness | Day 15 | Experiment, monitoring, data capture và owner được phê duyệt |

## 10. Deliverables

- `project_context.md`: mục tiêu, storytelling, feature contract và governance.
- `analysis_pipeline.md`: 20 BQ chi tiết và tiêu chuẩn bằng chứng.
- `timeline.xlsx`: roadmap 15 ngày, BQ register, Gantt và progress tracker.
- `notebooks/preprocessing.ipynb`: cohort/missingness audit và complete-case export.
- `notebooks/feature_engineering.ipynb`: bằng chứng chọn feature và benchmark.
- Notebook phân tích BQ: thực thi theo đúng thứ tự BQ01–BQ20.
- Model card, priority segment dictionary, policy matrix và experiment brief.

## 11. Success criteria

- 20/20 BQ có decision objective, owner, base feature, derived/support field, metric, method, chart, deliverable và acceptance criteria.
- Không xuất hiện raw predictor ngoài bộ 10 trong mô hình chính.
- Mọi derived field truy ngược được về base feature và không bị tính thành feature mới.
- Mọi tỷ lệ churn có `n`, churn count và denominator.
- Model reporting có ROC-AUC, PR-AUC, log loss, calibration và lift@capacity.
- Danh sách ưu tiên có risk decile, value proxy, reason code, eligibility và exclusion.
- Mọi chính sách có control group và decision rule scale/stop.
- Không biến correlation, SHAP hoặc khác biệt nhóm thành kết luận nhân quả.

## 12. Giới hạn và governance

- Snapshot không đủ để chứng minh biến xuất hiện trước churn trong mọi trường hợp.
- Không có promotion/contract-expiry nên không khẳng định churn tăng do hết ưu đãi.
- Không có margin/CLV/cost chuẩn nên không báo ROI thật trước khi bổ sung dữ liệu.
- `MonthlyRevenue` chỉ là value proxy.
- `CreditRating` là trường nhạy cảm về fairness; không dùng để từ chối hỗ trợ hoặc áp giá bất lợi.
- Benchmark AUC ở mức vừa phải; mô hình dùng để xếp hạng ưu tiên, không tự động đưa ra quyết định bất lợi.
- Mọi lần scoring mới phải kiểm tra schema, missingness, mapping categorical, drift và model version.

## 13. Nguồn bằng chứng trong repository

- [`notebooks/preprocessing.ipynb`](notebooks/preprocessing.ipynb): missingness, churn trong nhóm thiếu và complete-case cohort.
- [`notebooks/feature_engineering.ipynb`](notebooks/feature_engineering.ipynb): feature evidence, heatmap, CatBoost benchmark và tenure cohorts.
- [`data/cell2cell_complete_cases.csv`](data/cell2cell_complete_cases.csv): cohort phân tích chính.

Trạng thái mặc định của policy insight là **Hypothesis** cho tới khi BQ20 cung cấp bằng chứng thử nghiệm.
