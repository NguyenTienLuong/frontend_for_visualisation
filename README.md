# Trực quan hóa sự bất định — Chương 16

Một interactive textbook bằng React, Vite và Plotly.js, chuyển thể từ notebook
`code_demo_minh_họa_.ipynb` và chương [Visualizing uncertainty](https://clauswilke.com/dataviz/visualizing-uncertainty.html)
của Claus O. Wilke.

Ứng dụng giữ cấu trúc kiến thức của chương sách, còn dữ liệu IBM Telco Customer
Churn chỉ đóng vai trò ví dụ minh họa. Các biến `Contract`, `PaymentMethod`,
`MultipleLines`, `gender` và `tenure` không phải các mục điều hướng.

## Chạy cục bộ

Yêu cầu Node.js 18 trở lên.

```bash
npm install
npm run dev
```

Vite sẽ in địa chỉ local, mặc định là `http://127.0.0.1:5173`.

Build production:

```bash
npm run build
npm run preview
```

## Cấu trúc nội dung

1. Diễn đạt xác suất dưới dạng tần suất
2. Độ bất định của ước lượng điểm
3. Độ bất định của đường xu hướng
4. Biểu đồ kết quả giả định (HOP)
5. Kết luận từ ví dụ Telco

Mỗi phần đi theo flow: khái niệm → giải thích ngắn → ví dụ dữ liệu → biểu đồ
tương tác → cách diễn giải → lý thuyết mở rộng.

## Tương tác chính

- hover, zoom, pan, reset và bật/tắt legend trong Plotly;
- chuyển 10/50 chấm phân vị và thay cỡ mẫu/số lần mô phỏng;
- chọn mức tin cậy 80/95/99%;
- so sáu cách mã hóa cùng một phân phối bất định;
- xem dải tin cậy, các fit thay thế, graded bands và fit phi tuyến;
- phát/dừng, bước khung, đổi tốc độ và kiểu chuyển cảnh của HOP;
- mục lục tự highlight bằng `IntersectionObserver`.

## Dữ liệu và tính tái lập

Các checkpoint số liệu được lấy từ output đã lưu trong notebook và ghi lại tại
`public/data/telco-summary.json`. Những mô phỏng trên web dùng bộ sinh số giả ngẫu
nhiên có seed cố định.

Notebook không lưu 48 hàng `MonthlyCharges` gốc bên ngoài figure raster. Vì vậy
strip plot của phần SD/SE/CI dùng 48 điểm đại diện đã được chuẩn hóa để khớp chính
xác mean 86,78 và sample SD 28,92; giao diện ghi rõ đây là điểm minh họa. Mọi kết
luận định lượng khác dùng trực tiếp các thống kê đã lưu.

Lưu ý: notebook mô tả prior Bayes là `Beta(1,1)`, nhưng cell thực thi dùng prior
có trung bình bằng churn toàn mẫu và strength 20. Ứng dụng theo cell thực thi để
khớp các kết quả CI/CrI đang hiển thị.

## Nguồn

- Claus O. Wilke, *Fundamentals of Data Visualization*, Chapter 16.
- IBM/Kaggle, *Telco Customer Churn*.
- Notebook đính kèm trong thư mục gốc của project.

Đây là dữ liệu quan sát. Ứng dụng mô tả liên hệ và độ bất định, không khẳng định
nguyên nhân churn hoặc tự động đưa ra quyết định kinh doanh.
