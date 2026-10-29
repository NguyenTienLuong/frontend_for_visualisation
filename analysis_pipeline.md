# Analysis Pipeline — Cell2Cell Churn & Retention

## 0. Analytical contract

### 0.1. Mục tiêu xuyên suốt

Pipeline phải dẫn tới một quyết định vận hành hoàn chỉnh:

> **Dữ liệu đáng tin không? → churn lớn đến đâu? → rủi ro xuất hiện khi nào? → tín hiệu nào liên quan? → ai có khả năng churn? → ai cần ưu tiên? → chính sách nào nên thử? → hiệu quả được đo thế nào?**

Đích cuối không phải một mô hình có accuracy cao nhất. Đích cuối là danh sách khách hàng/segment có thứ tự ưu tiên, reason code có thể giải thích, chính sách phù hợp và thiết kế đo incremental impact.

### 0.2. Cohort và metric chuẩn

- Analysis cohort: `data/cell2cell_complete_cases.csv` sau khi BQ01 xác nhận tính đại diện.
- Đơn vị: một khách hàng/thuê bao tại thời điểm snapshot.
- Target: `Churn`; quy ước 0/1 hoặc Yes/No phải được chuẩn hóa và đối soát.
- Baseline hiện có: 49.752 khách, 14.245 churner, churn rate 28,63%.
- Churn count: tổng `Churn = 1` trong đúng denominator.
- Churn rate: churn count / eligible customers của cùng nhóm.
- Lift: churn rate nhóm / baseline churn của cùng cohort.
- Difference pp: churn rate nhóm trừ baseline, tính theo điểm phần trăm.
- Mọi rate phải kèm `n`, churn count và confidence interval khi so sánh nhóm.

### 0.3. Feature contract

Mô hình chính chỉ sử dụng 10 base feature:

`MonthsInService`, `CurrentEquipmentDays`, `HandsetWebCapable`, `MonthlyRevenue`, `TotalRecurringCharge`, `CreditRating`, `MonthlyMinutes`, `PercChangeMinutes`, `PercChangeRevenues`, `PeakCallsInOut`.

Các loại trường phải ghi riêng:

| Loại | Ví dụ | Có tính vào 10 feature không? | Vai trò |
|---|---|---:|---|
| Base feature | `CurrentEquipmentDays` | Có | Predictor gốc |
| Target | `Churn` | Không | Outcome |
| Identifier | `CustomerID` | Không | Đối soát/ghép danh sách |
| QA field | Missing/duplicate/schema flags | Không | Kiểm tra dữ liệu |
| Derived field | `EquipmentAgeBand`, `RiskDecile` | Không | EDA, segmentation hoặc model output |
| External input | Capacity, offer cost, uplift | Không | Scenario/pilot design |
| Experiment field | Treatment/control/outcome | Không | Đo incremental impact |

Derived field được phép: `TenureBand`, `EquipmentAgeBand`, `ValueTier`, `ChargeBand`, `MinutesBand`, `RevenueChargeGap`, `UsageTrendBand`, `RevenueTrendBand`, `DisengagementFlag`, `RiskScore`, `RiskDecile`, `PrioritySegment`, reason code.

Mỗi derived field phải có data dictionary gồm source feature, công thức, ngưỡng, ngày/version và mục đích sử dụng. Không đưa đồng thời biến liên tục và band của chính nó vào model chính nếu không có lý do và redundancy check.

### 0.4. Quy tắc bằng chứng

Mỗi insight được gắn trạng thái:

- **Observed:** mô tả trực tiếp từ dữ liệu đã kiểm tra.
- **Supported:** ổn định sau sensitivity, stratification hoặc kiểm tra đa biến phù hợp.
- **Hypothesis:** lời giải thích/chính sách chưa có bằng chứng nhân quả.
- **Tested:** có kết quả treatment/control trong outcome window đã khóa.

Một BQ chỉ được đóng khi trả lời được quyết định kinh doanh, không phải khi vẽ xong chart.

### 0.5. Ranh giới nhân quả và leakage

- Snapshot không chứng minh nguyên nhân hoặc thứ tự thời gian.
- Không kết luận “hết ưu đãi” nếu chưa có promotion/contract-expiry data.
- Không dùng retention-contact fields trong mô hình cảnh báo sớm khi thời điểm ghi nhận chưa được xác minh.
- Không chọn band/threshold trên toàn bộ dữ liệu rồi báo hiệu quả trên chính dữ liệu đó.
- SHAP và feature importance giải thích dự đoán, không giải thích nguyên nhân churn.
- Risk score dùng để ưu tiên liên hệ, không tự động từ chối dịch vụ hoặc áp điều kiện bất lợi.

## 1. Storyboard và danh mục 20 BQ

| Hồi | BQ | Business question | Decision objective | Chart |
|---|---|---|---|---|
| 1. Tin dữ liệu và quy mô | BQ01 | Cohort phân tích có đại diện và đối soát được không? | Khóa analysis cohort | C01 |
| 1. Tin dữ liệu và quy mô | BQ02 | Churn lớn đến đâu và baseline có chắc chắn không? | Khóa baseline duy nhất | C02 |
| 1. Tin dữ liệu và quy mô | BQ03 | Mười feature có hợp lệ và sẵn có tại thời điểm scoring không? | Khóa feature/data contract | C03 |
| 2. Thời điểm và thiết bị | BQ04 | Churn thay đổi thế nào theo tenure? | Tìm cửa sổ can thiệp | C04 |
| 2. Thời điểm và thiết bị | BQ05 | Điểm gãy tenure có ổn định hay do cách chia nhóm? | Chọn lifecycle trigger đáng tin | C05 |
| 2. Thời điểm và thiết bị | BQ06 | Tuổi thiết bị liên quan thế nào đến churn? | Xác định device-review cohort | C06 |
| 2. Thời điểm và thiết bị | BQ07 | Khả năng tương thích dịch vụ data của thiết bị còn liên quan đến churn sau khi kiểm soát tuổi thiết bị và tenure liên tục không? | Giữ, hạ vai trò hoặc loại tín hiệu capability khỏi câu chuyện chính sách | C07 |
| 3. Giá trị, phí và tín dụng | BQ08 | Monthly revenue liên quan thế nào đến risk và value? | Định nghĩa value proxy | C08 |
| 3. Giá trị, phí và tín dụng | BQ09 | Phí định kỳ có quan hệ phi tuyến với churn không? | Tìm nhóm cần bill/plan review | C09 |
| 3. Giá trị, phí và tín dụng | BQ10 | Revenue–charge gap có tạo price/plan mismatch candidate không? | Xác định mismatch cohort | C10 |
| 3. Giá trị, phí và tín dụng | BQ11 | Credit segment có khác biệt churn sau khi xét revenue/charge không? | Thiết kế payment support có fairness guardrail | C11 |
| 4. Sử dụng và hành vi | BQ12 | Mức sử dụng hàng tháng liên quan thế nào đến churn? | Xác định low-engagement cohort | C12 |
| 4. Sử dụng và hành vi | BQ13 | Giảm minutes có tạo trigger đủ risk, reach và lead time không? | Khóa usage-decline trigger | C13 |
| 4. Sử dụng và hành vi | BQ14 | Giảm revenue có thêm thông tin ngoài value hiện tại không? | Khóa spend-decline trigger | C14 |
| 4. Sử dụng và hành vi | BQ15 | Kết hợp usage, change signals và peak pattern có tạo reason code ổn định không? | Khóa disengagement rule | C15 |
| 5. Dự đoán và ưu tiên | BQ16 | Feature nào có bằng chứng ổn định và còn giá trị khi xem đồng thời? | Khóa 10-feature evidence register | C16 |
| 5. Dự đoán và ưu tiên | BQ17 | CatBoost depth nào tối ưu validation loss và xếp hạng có đáng tin không? | Khóa model card và risk score | C17 |
| 5. Dự đoán và ưu tiên | BQ18 | Ai cần ưu tiên khi campaign capacity hữu hạn? | Tạo risk × value × actionability segments | C18 |
| 6. Chính sách và đo hiệu quả | BQ19 | Chính sách nào phù hợp với từng reason code và threshold nào khả thi? | Khóa policy/capacity framework | C19 |
| 6. Chính sách và đo hiệu quả | BQ20 | Thử nghiệm và giám sát thế nào để quyết định scale, sửa hoặc dừng? | Khóa experiment và monitoring plan | C20 |

## 2. Hồi 1 — Tin dữ liệu và định lượng vấn đề

### BQ01 — Cohort phân tích có đại diện và đối soát được không?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** quyết định có thể dùng complete-case cohort làm nguồn phân tích chính hay phải thay đổi xử lý missingness.
- **Base feature:** không dùng predictor để ra quyết định này.
- **Target / QA fields:** `Churn`, `CustomerID`, missing flag của toàn bộ cột nguồn.
- **Population:** dữ liệu raw, các dòng bị loại và complete-case cohort.
- **Metrics:** raw/retained/dropped; tỷ lệ mất dữ liệu; churn count/rate của nhóm thiếu và nhóm đủ; duplicate ID; invalid target; standardized difference khi phù hợp.
- **Method / evidence:** missingness audit theo cột và theo target; cohort reconciliation; so sánh raw với complete-case; liệt kê cột gây loại nhiều dòng nhất.
- **Visual C01:** waterfall raw → dropped → retained và heatmap missing rate theo churn status.
- **Retention link:** tránh xây chính sách trên cohort đã mất một nhóm khách hàng có hệ thống.
- **Acceptance:** retained + dropped = raw; CustomerID/target đối soát; mọi nguyên nhân loại có count; churn mix chênh lệch phải được giải thích.
- **Nếu không đạt:** dừng các BQ sau, đánh giá imputation/indicator hoặc đổi cohort definition.

### BQ02 — Churn lớn đến đâu và baseline có chắc chắn không?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** khóa một baseline duy nhất để định cỡ vấn đề và làm mẫu tham chiếu cho mọi segment.
- **Base feature:** không có.
- **Target:** `Churn`.
- **Population:** eligible customers từ BQ01.
- **Metrics:** eligible customers, churners, non-churners, churn rate, Wilson 95% CI.
- **Method / evidence:** descriptive QA; đối soát `churners + non_churners = eligible`; kiểm tra target mapping.
- **Visual C02:** KPI strip và waffle chart 10×10; tỷ lệ chính xác ghi trong tiêu đề/chú thích.
- **Retention link:** định cỡ cơ hội và chuẩn so sánh lift/difference pp.
- **Acceptance:** count/rate khớp tuyệt đối; baseline được tái sử dụng nhất quán ở BQ04–BQ20.
- **Observed benchmark:** 49.752 khách; 14.245 churn; 28,63%.

### BQ03 — Mười feature có hợp lệ và sẵn có tại thời điểm scoring không?

- **Owner / Priority:** Analyst B / Must-have.
- **Decision objective:** khóa data dictionary và xác nhận không có timing leakage trong bộ 10.
- **Base features:** toàn bộ 10 feature.
- **QA fields:** dtype, missingness, unique count, range, outlier flag, source system, refresh frequency, available-at-scoring flag.
- **Metrics:** coverage; invalid/out-of-range count; category mapping coverage; outlier rate; availability/timing status.
- **Method / evidence:** schema profile; domain/range audit; category normalization review; so sánh train/scoring availability; xác minh đơn vị của hai `PercChange*`.
- **Visual C03:** feature-readiness matrix với các cột Quality, Timing, Actionability và Governance.
- **Retention link:** chỉ các feature có mặt trước quyết định mới được dùng để gọi khách hàng.
- **Acceptance:** 10/10 feature có owner, dtype, đơn vị, phạm vi, missing policy và scoring-time availability; issue chưa giải quyết phải có blocker/mitigation.
- **Không được làm:** thêm raw feature ngoài contract chỉ vì có correlation cao.

## 3. Hồi 2 — Thời điểm và thiết bị

### BQ04 — Churn thay đổi thế nào theo tenure?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** tìm cửa sổ vòng đời cần can thiệp trước khi rủi ro tăng mạnh.
- **Base feature:** `MonthsInService`.
- **Derived / target:** `TenureBand`, `Churn`.
- **Metrics:** `n`, churn count/rate, Wilson CI, difference pp, risk ratio theo tháng/band.
- **Method / evidence:** monthly curve; ordered bands; minimum sample rule; kiểm tra phi tuyến thay vì chỉ correlation.
- **Visual C04:** đường churn rate theo tháng có volume và CI; band được đánh dấu bằng vùng nền nhẹ.
- **Retention link:** xác định thời điểm check-in/onboarding/loyalty review.
- **Acceptance:** band phủ mỗi khách đúng một lần; tháng/band nhỏ được gắn cảnh báo; không gọi pattern là promotion effect.
- **Observed clue:** rủi ro tăng từ 7–11 lên 12–18 tháng; cần kiểm chứng độ ổn định ở BQ05.

### BQ05 — Điểm gãy tenure có ổn định hay do cách chia nhóm?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** chọn lifecycle trigger tái lập được, không cherry-pick một ngưỡng cho churn cao nhất.
- **Base feature:** `MonthsInService`.
- **Derived / target:** alternate `TenureBand`, `Churn`.
- **Metrics:** pairwise difference pp; risk ratio; bootstrap CI; sample size; threshold stability.
- **Method / evidence:** alternate bands; rolling/monthly smoothing; bootstrap; placebo cut points; stratify theo value/usage khi đủ mẫu.
- **Visual C05:** threshold-sensitivity plot cho các cut point 6, 9, 12, 18 và 24 tháng.
- **Retention link:** quyết định trigger trước cửa sổ rủi ro, không sau khi churn đã xảy ra.
- **Acceptance:** trigger giữ hướng và có effect/reach hợp lý qua nhiều cách chia; lời giải thích “hết ưu đãi” chỉ được ghi là hypothesis cần dữ liệu bổ sung.
- **Nếu không ổn định:** dùng tenure liên tục trong model và chỉ báo cáo các cohort mô tả rộng.

### BQ06 — Tuổi thiết bị liên quan thế nào đến churn?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** xác định cohort đủ lớn để thử device review/upgrade.
- **Base feature:** `CurrentEquipmentDays`.
- **Derived / target:** `EquipmentAgeBand`, `Churn`.
- **Metrics:** min/max/quantiles; negative/outlier count; churn rate/lift/CI và `n` theo band; monotonicity/sensitivity.
- **Method / evidence:** audit giá trị âm; quantile bands và business bands; spline/partial dependence sensitivity; không khóa ngưỡng trên cùng tập đánh giá cuối.
- **Visual C06:** distribution + churn rate/volume theo equipment-age band.
- **Retention link:** tạo device-review cohort thay vì xem mọi thiết bị cũ là nguyên nhân churn.
- **Acceptance:** `EquipmentAgeBand` có công thức/biên rõ; không tính là base feature mới; effect còn hợp lý sau tenure stratification.
- **Observed clue:** `CurrentEquipmentDays` có liên hệ đơn biến mạnh nhất trong nhóm numeric hiện tại.

### BQ07 — Khả năng tương thích dịch vụ data của thiết bị còn liên quan đến churn sau khi kiểm soát tuổi thiết bị và tenure liên tục không?

- **Owner / Priority:** Analyst A / Must-have; đây là BQ quyết định `HandsetWebCapable` có đủ bằng chứng để xuất hiện trong reason code và chính sách hay chỉ nên giữ làm biến kiểm soát/dự đoán.
- **Decision objective:** tách tín hiệu capability của thiết bị khỏi ảnh hưởng của tuổi thiết bị và thời gian dùng dịch vụ. Kết quả phải dẫn tới một trong ba quyết định: **Keep as actionable signal**, **Context/prediction only** hoặc **Remove from policy story**.
- **Base features:** `CurrentEquipmentDays`, `HandsetWebCapable`, `MonthsInService`.
- **Derived / target:** `Churn`; BQ07 không tạo và không sử dụng `EquipmentAgeBand` hoặc `TenureBand`.
- **Metrics:** số khách và churn rate thô theo `HandsetWebCapable`; adjusted average marginal effect; adjusted risk difference theo điểm phần trăm; adjusted odds ratio và 95% CI; likelihood-ratio/Wald test cho interaction; bootstrap stability.
- **Method / evidence:** dùng binomial GAM hoặc logistic regression với restricted cubic spline cho `CurrentEquipmentDays` và `MonthsInService`. So sánh mô hình cộng với mô hình có `HandsetWebCapable × spline(CurrentEquipmentDays)`. Chuẩn hóa xác suất dự đoán trên phân phối tenure thực tế, kiểm tra bootstrap/validation và không ngoại suy ngoài vùng dữ liệu đủ quan sát.
- **Visual C07 — biểu đồ trọng tâm:** panel trên vẽ hai đường xác suất churn đã điều chỉnh theo `CurrentEquipmentDays` liên tục cho thiết bị hỗ trợ và không hỗ trợ web, kèm 95% CI và rug/density thể hiện vùng có dữ liệu. Panel dưới vẽ adjusted risk-difference curve; đường 0 là mốc không khác biệt. Gắn callout **Keep / Context only / Remove** ngay trên biểu đồ.
- **Retention link:** nếu chênh lệch đã điều chỉnh còn ổn định, nhà mạng thử kiểm tra tương thích thiết bị–dịch vụ data, hỗ trợ cấu hình hoặc hướng dẫn sử dụng dịch vụ. Chỉ đề xuất đổi thiết bị khi công ty thực sự có chương trình thiết bị. Nếu hiệu ứng biến mất sau điều chỉnh, không dùng `HandsetWebCapable` để tạo chính sách giữ chân.
- **Acceptance:** không chia band; báo riêng main effect và interaction cùng CI; kết quả giữ hướng qua bootstrap/validation; chỉ diễn giải trong vùng dữ liệu đủ hỗ trợ; có quyết định Keep/Context only/Remove và lý do định lượng.
- **Observed clue:** Cramér's V đơn biến của `HandsetWebCapable` chỉ là tín hiệu khởi đầu, không phải bằng chứng rằng capability hoặc thiết bị gây churn.
- **Không được làm:** diễn giải thiết bị không web-capable thành lỗi mạng.

## 4. Hồi 3 — Giá trị, phí và tín dụng

### BQ08 — Monthly revenue liên quan thế nào đến risk và value?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** tách xác suất churn khỏi value proxy để tránh chỉ chăm nhóm risk cao nhưng giá trị thấp.
- **Base feature:** `MonthlyRevenue`.
- **Derived / target:** `ValueTier`, `Churn`.
- **Metrics:** median/IQR; churn rate/lift/CI; group size; revenue-at-risk proxy.
- **Method / evidence:** distribution; quantile/value bands; winsorization sensitivity; compare risk and contribution separately.
- **Visual C08:** small multiples gồm volume, churn rate và revenue-at-risk proxy theo value tier; không dùng dual axis.
- **Retention link:** tạo value dimension cho BQ18.
- **Acceptance:** ValueTier có biên tái lập; `MonthlyRevenue` không bị gọi là CLV/margin; tail không quyết định toàn bộ insight.
- **Nếu quan hệ yếu:** vẫn giữ làm value proxy, không ép thành driver churn.

### BQ09 — Phí định kỳ có quan hệ phi tuyến với churn không?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** tìm nhóm có thể cần bill/plan review mà không suy diễn từ correlation tuyến tính.
- **Base features:** `TotalRecurringCharge`, `MonthlyRevenue`.
- **Derived / target:** `ChargeBand`, `ValueTier`, `Churn`.
- **Metrics:** churn rate/CI theo band; median charge/revenue; difference pp; non-linear effect.
- **Method / evidence:** distribution; quantile/business bands; spline/partial dependence; value strata.
- **Visual C09:** churn rate và volume theo charge band, tách theo value tier khi đủ mẫu.
- **Retention link:** xác định candidate cho bill explanation/right-size plan.
- **Acceptance:** báo được risk và reach; effect không chỉ do MonthlyRevenue; không khẳng định tăng/giảm phí sẽ làm churn thay đổi.
- **Observed clue:** correlation âm nhỏ cần kiểm tra phi tuyến và confounding.

### BQ10 — Revenue–charge gap có tạo price/plan mismatch candidate không?

- **Owner / Priority:** Analyst A / Should-have.
- **Decision objective:** nhận diện phần chênh giữa revenue và recurring charge có liên quan churn và đủ hành động không.
- **Base features:** `MonthlyRevenue`, `TotalRecurringCharge`.
- **Derived / target:** `RevenueChargeGap = MonthlyRevenue - TotalRecurringCharge`, `Churn`.
- **Metrics:** gap distribution; churn rate/lift; `n`; negative/positive share; tail sensitivity.
- **Method / evidence:** bins quanh 0; quantiles; outlier audit; stratify theo value/charge.
- **Visual C10:** diverging distribution quanh gap = 0 và churn-rate panel theo gap band.
- **Retention link:** bill explanation, cap/alert hoặc plan review candidate.
- **Acceptance:** không gọi gap là margin, overage hay discount; ngưỡng phải có business meaning và stability.
- **Nếu không có incremental evidence:** loại khỏi reason code dù vẫn giữ mô tả.

### BQ11 — Credit segment có khác biệt churn sau khi xét revenue/charge không?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** xác định có nhu cầu payment support đồng thời kiểm soát rủi ro fairness.
- **Base features:** `CreditRating`, `MonthlyRevenue`, `TotalRecurringCharge`.
- **Derived / target:** `ValueTier`, `ChargeBand`, `Churn`.
- **Metrics:** churn rate/lift/CI; group size; disparity ratio; within-value/charge difference.
- **Method / evidence:** category mapping audit; Cramér's V; stratification; interaction sensitivity; minimum-cell rule.
- **Visual C11:** dot plot theo credit category và heatmap credit × charge band.
- **Retention link:** payment reminder/flexibility nếu policy cho phép; không dùng credit để từ chối hỗ trợ.
- **Acceptance:** category mapping rõ; chênh lệch trước/sau stratification được báo; fairness owner và prohibited use được ghi.
- **Governance:** reason code credit-sensitive không được hiển thị cho agent nếu chưa phê duyệt.

## 5. Hồi 4 — Sử dụng và thay đổi hành vi

### BQ12 — Mức sử dụng hàng tháng liên quan thế nào đến churn?

- **Owner / Priority:** Analyst B / Must-have.
- **Decision objective:** xác định low-engagement cohort đủ lớn cho re-engagement/plan review.
- **Base features:** `MonthlyMinutes`, `MonthsInService`.
- **Derived / target:** `MinutesBand`, `TenureBand`, `Churn`.
- **Metrics:** distribution; churn rate/lift/CI; `n`; median/IQR; within-tenure rate.
- **Method / evidence:** quantile/business bands; outlier sensitivity; tenure/value strata.
- **Visual C12:** churn rate và customer volume theo minutes band, có facet tenure khi phù hợp.
- **Retention link:** phân biệt low usage cần re-engagement với high usage cần service/plan review.
- **Acceptance:** rate và volume tách riêng; band có đủ mẫu; không gọi usage thấp là không hài lòng.
- **Observed clue:** `MonthlyMinutes` có liên hệ âm nhỏ nhưng có thể phi tuyến.

### BQ13 — Giảm minutes có tạo trigger đủ risk, reach và lead time không?

- **Owner / Priority:** Analyst B / Must-have.
- **Decision objective:** khóa usage-decline trigger có thể chạy trước churn.
- **Base features:** `PercChangeMinutes`, `MonthlyMinutes`.
- **Derived / target:** `UsageTrendBand`, `Churn`.
- **Metrics:** churn rate/lift/CI; coverage; precision/recall; current-usage profile; availability at scoring.
- **Method / evidence:** bins quanh 0; threshold sensitivity; current-usage strata; validation split; timing review.
- **Visual C13:** trend-band chart gồm risk, reach và CI; threshold-sensitivity panel.
- **Retention link:** kích hoạt re-engagement hoặc plan review sau tín hiệu giảm sử dụng hợp lệ.
- **Acceptance:** đơn vị `PercChangeMinutes` được xác minh; trigger có lead time; ngưỡng không tối ưu và đánh giá trên cùng tập.
- **Nếu timing không rõ:** chỉ dùng mô tả, không dùng trigger vận hành.

### BQ14 — Giảm revenue có thêm thông tin ngoài value hiện tại không?

- **Owner / Priority:** Analyst B / Must-have.
- **Decision objective:** quyết định giữ hay loại spend-decline trigger dựa trên incremental evidence.
- **Base features:** `PercChangeRevenues`, `MonthlyRevenue`.
- **Derived / target:** `RevenueTrendBand`, `ValueTier`, `Churn`.
- **Metrics:** churn rate/lift/CI; coverage; conditional lift; MI/permutation increment; overlap với usage decline.
- **Method / evidence:** trend bands; value strata; joint model comparison; threshold stability.
- **Visual C14:** revenue-trend risk/reach chart và overlap với UsageTrendBand.
- **Retention link:** bill/plan review hoặc combined disengagement trigger.
- **Acceptance:** feature chỉ làm reason code khi thêm thông tin ngoài MonthlyRevenue; đơn vị và timing được xác minh.
- **Nếu redundant:** giữ trong sensitivity register, không ép vào policy.

### BQ15 — Kết hợp usage, change signals và peak pattern có tạo reason code ổn định không?

- **Owner / Priority:** Analyst B / Must-have.
- **Decision objective:** tạo một disengagement reason code dễ giải thích, có lift và độ phủ phù hợp.
- **Base features:** `MonthlyMinutes`, `PercChangeMinutes`, `PercChangeRevenues`, `PeakCallsInOut`, `MonthsInService`.
- **Derived / target:** `DisengagementFlag`, `UsageTrendBand`, `RevenueTrendBand`, `TenureBand`, `Churn`.
- **Metrics:** coverage; churn rate/lift; precision/recall; overlap; incremental contribution của `PeakCallsInOut`; stability theo tenure.
- **Method / evidence:** prespecified rule combinations; compare single vs combined signals; validation-fold test; conditional permutation/SHAP review.
- **Visual C15:** overlap matrix/UpSet-style summary và churn lift theo rule; panel riêng cho peak pattern increment.
- **Retention link:** outbound trigger có reason “usage/spend decline”, không phải một điểm tùy ý khó giải thích.
- **Acceptance:** rule được định nghĩa trước validation; báo cả reach và risk; `PeakCallsInOut` chỉ được giữ nếu có incremental evidence.
- **Không được làm:** chia calls cho minutes khi metadata không đảm bảo cùng đơn vị.

## 6. Hồi 5 — Từ tín hiệu đến dự đoán và ưu tiên

### BQ16 — Feature nào có bằng chứng ổn định và còn giá trị khi xem đồng thời?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** chứng minh bộ 10 không được chọn ngẫu nhiên và khóa vai trò của từng feature.
- **Base features:** toàn bộ 10 feature.
- **Target:** `Churn`.
- **Metrics:** point-biserial/Spearman; Cramér's V; FDR q-value; MI; OOF permutation; SHAP stability; redundancy.
- **Method / evidence:** evidence matrix; bootstrap/fold stability; correlation/redundancy review; timing/actionability review.
- **Visual C16:** heatmap feature × evidence type với ký hiệu Selected/Context/Reason-code candidate.
- **Retention link:** feature phải có evidence và action pathway mới trở thành reason code chính.
- **Acceptance:** feature register có `Base feature`, `Evidence`, `Timing`, `Actionability`, `Governance`, `Final role`; không bổ sung raw predictor ngoài 10.
- **Known benchmark:** evidence nổi bật ở equipment age, tenure, recurring charge, credit và usage/change signals.

### BQ17 — CatBoost depth nào tối ưu validation loss và xếp hạng có đáng tin không?

- **Owner / Priority:** Analyst B / Must-have.
- **Decision objective:** chọn mô hình 10 feature không cần manual encoding, có calibration và lift đủ dùng cho campaign.
- **Base features:** toàn bộ 10 feature.
- **Target / model outputs:** `Churn`, `RiskScore`, OOF predictions.
- **Candidate model:** CatBoost với categorical feature truyền qua `cat_features`; không one-hot encode thủ công.
- **Metrics:** train/validation log loss theo depth; ROC-AUC; PR-AUC; calibration/Brier; lift/gain ở 5/10/20%; overfitting gap; runtime.
- **Method / evidence:** stratified CV hoặc train/validation/holdout; depth grid pre-specified; early stopping; fixed seed; compare mean và dispersion qua folds.
- **Visual C17:** validation log loss theo depth (kèm train loss để thấy overfit), ROC/PR, calibration và decile lift.
- **Retention link:** chọn model theo validation loss/ranking/calibration, không theo accuracy hoặc training loss.
- **Acceptance:** depth được chọn từ validation/OOF; mọi metric từ unseen predictions; model card ghi cohort, feature version, seed, split và limitation.
- **Known benchmark:** CatBoost 10 feature AUC ≈ 0,6585; log loss ≈ 0,5663. Kết quả mới phải giải thích nếu lệch đáng kể.

### BQ18 — Ai cần ưu tiên khi campaign capacity hữu hạn?

- **Owner / Priority:** Analyst A / Must-have.
- **Decision objective:** ưu tiên đúng khách trong giới hạn capacity bằng cách tách xác suất churn khỏi value proxy, sau đó kết hợp hai chiều bằng quy tắc có thể vận hành trong CRM.
- **Base feature dùng cho value:** `MonthlyRevenue`; dùng biên `ValueTier` đã khóa tại BQ08.
- **Model / supporting inputs:** calibrated `RiskScore` từ BQ17; reason code từ evidence register BQ16; eligibility/exclusion từ chính sách campaign.
- **Derived outputs:** `RiskTier`, `ValueTier`, `ExpectedRevenueExposure = RiskScore × MonthlyRevenue`, `PrioritySegment`, customer rank.
- **Ý nghĩa của tích risk × value:** chỉ là expected monthly revenue exposure proxy để xếp hạng trong cùng tập eligible; không phải CLV, margin, ROI hay tổn thất chắc chắn.
- **Metrics:** eligible size; OOF/holdout churn rate và lift; expected churners reached; recall/precision tại capacity 5/10/20%; monthly revenue exposure; expected revenue exposure; reason-code coverage.
- **Method / evidence:** kiểm tra calibration trước; cố định value tier BQ08; ma trận 2×2 risk × value; xếp hạng eligible theo `RiskScore × MonthlyRevenue`; so sánh với risk-only ở cùng capacity; sensitivity và fairness review.
- **Visual C18:** cumulative gain/lift theo capacity và ma trận risk × value có volume, mean risk, expected churners và expected revenue exposure.
- **Retention link:** P1 high risk/high value liên hệ trước; P2 high risk/lower value dùng can thiệp chi phí thấp; P3 lower risk/high value theo dõi/service assurance; P4 lower risk/lower value giữ BAU.
- **Acceptance:** P1–P4 mutually exclusive/exhaustive; chỉ dùng OOF/holdout score; threshold gắn với capacity thay vì mặc định 0,5; so sánh được risk × value với risk-only; mỗi khách eligible có reason code hoặc fallback; value thiếu/âm hiển thị unavailable thay vì đổi thành 0.
- **Governance:** không ưu đãi chỉ vì doanh thu cao; không dùng `CreditRating` đơn lẻ để xếp khách vào nhóm bất lợi; không báo expected exposure thành ROI khi chưa có margin, cost và uplift.

## 7. Hồi 6 — Chính sách và đo hiệu quả

### BQ19 — Chính sách nào phù hợp với từng reason code và threshold nào khả thi?

- **Owner / Priority:** Shared / Must-have.
- **Decision objective:** khóa policy matrix và campaign threshold trong giới hạn capacity/chi phí.
- **Base feature:** không thêm predictor mới; sử dụng output đã phê duyệt từ BQ18.
- **Derived / external inputs:** `PrioritySegment`, reason code, eligibility/exclusion, capacity, contact cost, offer cost, margin/CLV và uplift assumption nếu có.
- **Metrics:** eligible size; reach; expected churners contacted; cost per contact; break-even uplift; expected incremental value khi đủ input.
- **Method / evidence:** evidence-to-policy mapping; Base/Downside/Upside scenarios; capacity sensitivity; prohibited-use review.
- **Visual C19:** policy matrix reason → treatment → KPI/guardrail và capacity curve theo percentile.
- **Retention link:** lifecycle check-in, device upgrade, plan review, re-engagement, priority care hoặc payment support.
- **Acceptance:** mỗi segment có treatment, control, channel, timing, exclusion, KPI, guardrail, owner và fallback; input thiếu hiển thị `n.a.`.
- **Không được làm:** tự đặt margin, CLV, offer cost hoặc uplift rồi báo ROI như fact.

### BQ20 — Thử nghiệm và giám sát thế nào để quyết định scale, sửa hoặc dừng?

- **Owner / Priority:** Shared / Must-have.
- **Decision objective:** thiết kế bằng chứng incremental và cơ chế vận hành sau pilot.
- **Base feature:** không thêm predictor mới.
- **Experiment / monitoring fields:** eligible segment, randomization unit, treatment/control, contact/offer exposure, outcome window, churn outcome, guardrails, model/version timestamps.
- **Metrics:** ITT incremental churn reduction; CI; MDE/power; contact/take-up; cost per incremental save; complaints/opt-out; fairness gap; calibration/lift; feature/score drift.
- **Method / evidence:** randomized controlled pilot; pre-specified primary KPI/window; intent-to-treat; stop rule; drift/fairness monitoring; retraining trigger.
- **Visual C20:** experiment flow, KPI scorecard và monitoring dashboard specification.
- **Retention link:** chỉ scale chính sách khi có incremental lift và economics/guardrail chấp nhận được.
- **Acceptance:** sample size/data capture/owner rõ; treatment/control cùng eligibility; outcome định nghĩa trước; decision rule scale/iterate/stop được phê duyệt.
- **Nếu không randomize được:** dùng quasi-experiment phù hợp và ghi rõ limitation; không dùng before/after đơn thuần làm bằng chứng cuối.

## 8. Policy matrix tối thiểu

| Reason code | Eligibility | Treatment hypothesis | Control | Primary KPI | Guardrail |
|---|---|---|---|---|---|
| Lifecycle risk | Tenure window + risk cao | Check-in, bill/plan explanation, conditional offer | Eligible BAU | Incremental churn reduction | Contact fatigue, offer cost |
| Device–data compatibility | BQ07 có adjusted effect ổn định + risk cao | Kiểm tra tương thích/cấu hình; hướng dẫn dịch vụ data; chỉ thử đổi thiết bị nếu có chương trình thiết bị | Eligible BAU | Incremental churn reduction; issue-resolution rate | Contact burden, complaints, treatment cost |
| Price/plan mismatch | Charge/revenue/usage profile + risk cao | Bill review, right-size plan, cap/alert | Eligible BAU | Retention + plan acceptance | Revenue dilution |
| Behavioral decline | DisengagementFlag + risk cao | Re-engagement/plan review | Eligible BAU | Retention + usage recovery | Opt-out, spam |
| High risk/high value | Top risk × value segment | Priority care/service review | Same-value BAU | Retained value proxy | Cost per save |
| Payment support | Approved credit-sensitive cohort | Reminder/payment flexibility | Eligible BAU | Incremental retention | Fairness gap, delinquency |

## 9. Dashboard/report storyline

1. **Data trust:** C01–C03, cohort và feature readiness.
2. **Problem size:** C02, baseline churn.
3. **When risk emerges:** C04–C07, tenure và device.
4. **Why risk may rise:** C08–C15, value/price/usage/behavior signals.
5. **Who is most at risk:** C16–C18, evidence, model và priority segment.
6. **What to do:** C19, policy/capacity.
7. **How to know:** C20, experiment và monitoring.

Mỗi chart phải có một tiêu đề kết luận trung tính, một subtitle nêu cohort/định nghĩa và một note nêu limitation quan trọng nhất.

## 10. Quality gates

### G1 — Data lock

- [ ] Cohort, target và denominator đối soát.
- [ ] 10 base feature có data dictionary và timing status.
- [ ] Missing/outlier policy được ghi.

### G2 — Descriptive evidence

- [ ] BQ04–BQ15 có `n`, churn count/rate, CI và sensitivity.
- [ ] Derived bands có biên/version rõ.
- [ ] Không có causal wording vượt quá bằng chứng.

### G3 — Feature/model contract

- [ ] Chỉ 10 base feature trong model chính.
- [ ] Feature evidence và redundancy được ghi.
- [ ] Không có retention/timing leakage.

### G4 — Model acceptance

- [ ] Depth chọn theo validation/OOF log loss.
- [ ] Có ROC-AUC, PR-AUC, log loss, calibration và lift@capacity.
- [ ] Risk score và decile từ unseen predictions.

### G5 — Policy readiness

- [ ] Priority segment, reason code, eligibility và exclusion rõ.
- [ ] Mỗi treatment có control, KPI, guardrail và owner.
- [ ] Economics thiếu input được ghi `n.a.`, không tự tạo ROI.

### G6 — Pilot readiness

- [ ] Outcome window, randomization, sample size và data capture đã khóa.
- [ ] Có scale/iterate/stop rule.
- [ ] Có drift, calibration, lift và fairness monitoring.

## 11. Insight record template

Mỗi insight khi đưa vào báo cáo phải có:

1. BQ ID và decision objective.
2. Cohort/denominator.
3. Base feature và derived field nếu có.
4. Count, churn count/rate và effect/uncertainty.
5. Stability/sensitivity evidence.
6. Evidence status: Observed, Supported, Hypothesis hoặc Tested.
7. Retention implication.
8. Limitation và dữ liệu bổ sung cần có.
9. Owner và next action.
