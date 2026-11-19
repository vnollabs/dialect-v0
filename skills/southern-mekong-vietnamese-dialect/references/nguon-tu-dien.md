# Nguồn làm giàu từ điển

Dùng cho đợt làm giàu từ điển (SKILL.md mục 7b). Sau mỗi đợt: ghi nguồn mới và nguồn hỏng; nguồn dùng để trích thì thêm mã vô `data/sources.yaml`.

## Mục lục

- [Nguồn web đã đọc](#nguồn-web-đã-đọc)
- [Nguồn chưa đọc được](#nguồn-chưa-đọc-được)
- [Sách tra cứu](#sách-tra-cứu)
- [Không dùng](#không-dùng)
- [Danh sách chờ nguồn thứ hai](#danh-sách-chờ-nguồn-thứ-hai)

## Nguồn web đã đọc

Cập nhật lần cuối: 2026-11-19.

| Nguồn | Loại | Ghi chú |
| :--- | :--- | :--- |
| [nghengu.vn: Từ điển tiếng miền Nam cho người ngoài tỉnh](https://nghengu.vn/chuyen-nguoi-nghe-ke/tu-dien-tieng-mien-nam-2032.html) | Danh sách ~250 mục theo vần | Nhiều mục nhất. Lẫn tiếng lóng Sài Gòn trước 1975 và từ toàn dân, phải lọc. |
| [hohyhung.blogspot.com: Từ điển miền Tây - Nam bộ](http://hohyhung.blogspot.com/p/tu-ien-mien-tay-nam-bo.html) | Bảng đối chiếu Nam – Bắc | Có ví dụ tốt. Bỏ qua các mục chỉ ghi cách phát âm (tai = tay, sáo = sáu…). |
| [mia.vn: Khám phá tiếng miền Tây](https://mia.vn/cam-nang-du-lich/kham-pha-tieng-mien-tay-18102) | Bài du lịch, ~40 mục có ví dụ | |
| [VOH: Nhức nách là gì?](https://voh.com.vn/thuong-thuc/nhuc-nach-la-gi-495793.html) | Báo | Trùng nhiều mục với mia.vn, coi hai trang là **một** nguồn. |
| [scr.vn: Tiếng miền Tây](https://scr.vn/tieng-mien-tay.html) | Bảng đối chiếu, mạnh về món ăn | Nhiều mục chép từ nghengu.vn, coi là **một** nguồn với nghengu cho các mục trùng. |
| [ngonngumientay.com: Từ điển miền Tây](https://ngonngumientay.com/tu-dien-mien-tay/) | Trang từ điển | Trang chính ít mục; các trang con chưa đọc. |
| [Tuổi Trẻ: Cưng lắm lời ăn tiếng nói miền Tây, Kỳ 1](https://tuoitre.vn/cung-lam-loi-an-tieng-noi-mien-tay-ky-1-doc-ba-co-o-xu-hoc-ba-to-20220207110129493.htm) | Báo, văn kể chuyện | Giàu từ trong ngữ cảnh. Còn các kỳ sau (Kỳ 2: "Cưng gì mà cưng mắc chết") chưa tìm ra link. |
| [SGGP: Cái giọng quê trớt](https://www.sggp.org.vn/cai-giong-que-trot-post647549.html) | Báo | Xưng hô (hia, chế, má Bảy), giọng Bến Tre. |
| [SGGP: Số chục miền Tây](https://www.sggp.org.vn/so-chuc-mien-tay-718592.html) | Báo | Cách đếm chục khi mua bán trái cây. |
| [VnExpress: Rặt giọng miền Tây](https://vnexpress.net/rat-giong-mien-tay-5041991.html) | Báo | |
| [VNU: Phạm Văn Tình, Tiếng Nam tiếng Bắc đang xích lại gần nhau](https://news.vnu.edu.vn/upload/2011/09/11627/247%20p44-p45_Tieng%20Nam%20tieng%20Bac%20dang%20xich%20lai%20gan%20nhau%20_PGS_TS%20Pham%20Van%20Tinh(1).pdf) | Bài nghiên cứu | Cặp từ Nam – Bắc (mướn, giỡn…). |
| [Vietnam Tourism: Chả giò, gỏi cuốn và nem](https://www.vietnamtourism.com/vi/cha-gio-o-viet-nam-su-khac-biet-thuc-su-giua-goi-cuon-va-nem) | Bài ẩm thực | |
| [VnExpress: Phân biệt dọc mùng và khoai nước](https://vnexpress.net/co-nen-bop-muoi-doc-mung-truoc-khi-nau-4802440.html) | Báo | Môn thơm, bạc hà. |
| [Wiktionary tiếng Anh](https://en.wiktionary.org/) (qua bản JSON của [kaikki.org](https://kaikki.org/dictionary/Vietnamese/), dump 2026-10-30) | Từ điển mở, CC BY-SA 4.0 | Đã nhập các nghĩa thuộc thể loại Southern / South Central / Mekong Delta Vietnamese ngày 2026-11-19 (`npm run import:wiktionary`). Tính là một nguồn; nghĩa nào chỉ có Wiktionary thì còn `pending`. |

## Nguồn chưa đọc được

- **tuilanguoimientay.vn** ([100+ từ địa phương](https://tuilanguoimientay.vn/100-tu-ngu-dia-phuong-mien-tay.html), [từ ngữ "rặc"](https://tuilanguoimientay.vn/kieu-tu-ngu-mien-tay.html)): chứng chỉ TLS không khớp tên miền (curl cũng báo lỗi). Không bỏ qua kiểm tra TLS; chờ trang sửa chứng chỉ.
- **Bài nghiên cứu trên vjol.info.vn** (PDF; cần `pdftotext`, cài bằng `brew install poppler`):
  - [Nguyễn Hữu Hiệp, Phương ngữ Nam Bộ về sông nước](https://vjol.info.vn/ncpt-hue/article/view/4034): từ về kinh rạch, ghe xuồng, con nước.
  - [Khẩu ngữ Nam Bộ trong văn Hồ Biểu Chánh, Phi Vân, Sơn Nam](https://vjol.info.vn/NNDS/article/download/10189/9348/)
  - [Từ địa phương trong ca dao Nam Bộ (914 từ)](https://vjol.info.vn/index.php/NNDS/article/download/15748/14159)
- **vi.wiktionary.org**: chưa tìm ra thể loại phương ngữ Nam Bộ.

## Sách tra cứu

Chưa có bản đọc được trên mạng; tra bản in khi cần kiểm chứng.

Dùng để kiểm chứng từ và nghĩa. Với sách còn bản quyền (VD. từ điển của Huỳnh Công Tín, Vương Hồng Sển; văn của Sơn Nam, Phi Vân, Nguyễn Ngọc Tư), không chép lời định nghĩa hay câu trích vô repo, vì dữ liệu repo phát hành theo CC BY-SA. Viết lại bằng lời của mình và ghi sách vô `sources`.

- Huỳnh Công Tín, *Từ điển từ ngữ Nam Bộ*, NXB Khoa học Xã hội, 2007.
- Vương Hồng Sển, *Tự vị tiếng Việt miền Nam*, NXB Văn hóa, 1993 (tái bản với tên *Tự vị tiếng nói miền Nam*).
- Huỳnh Tịnh Của, *Đại Nam quấc âm tự vị*, 1895–1896.
- Văn của Sơn Nam, Hồ Biểu Chánh, Phi Vân, Nguyễn Ngọc Tư.

## Không dùng

- Trang trả lời bằng AI (VD. ai-hay.vn): không phải nguồn độc lập.
- Tóm tắt của công cụ tìm kiếm khi nó tự ghi "theo kiến thức chung": chỉ coi là gợi ý, không tính là nguồn.

## Danh sách chờ nguồn thứ hai

Trong repo VN Dialect, danh sách chờ không ghi tay ở đây nữa. Mỗi nghĩa trong `data/entries/` có trường `sources` (mã trong `data/sources.yaml`), và trạng thái được tính từ đó: hai nguồn độc lập trở lên là `verified`, một nguồn là `pending`, chưa có nguồn là `unsourced`. Xem danh sách bằng:

```bash
npm run dict -- pending --status pending      # chờ nguồn thứ hai
npm run dict -- pending --status unsourced    # chưa có nguồn nào
```

Ghi chú còn giữ từ trước khi chuyển về repo:

- Ngày 2026-11-19 người dùng duyệt thêm trước nhóm "Từ chen & dấu hiệu diễn ngôn" ("Maybe add some for now, we will enrich later"). Đợt làm giàu sau: tìm nguồn cho từng mục, sửa nghĩa nếu nguồn nói khác, bỏ mục nào hóa ra là từ toàn dân hay miền Trung.
- Các mục chuyển từ từ điển cũ của skill ghi nguồn `skill-dictionary-v1`. Nguồn này chỉ ghi xuất xứ, không tính vô kiểm chứng, vì bản cũ không ghi nguồn cho từng mục.
