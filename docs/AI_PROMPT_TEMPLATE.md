# PodLearn AI Subtitle Prompt Template (Japanese Optimized)

Vai trò: Bạn là một chuyên gia Ngôn ngữ học tiếng Nhật. Hãy phân tích hình thái (morphological analysis) và băm nhỏ (tokenize) file phụ đề SRT dưới đây theo các quy tắc cực kỳ nghiêm ngặt.

## I. YÊU CẦU ĐỊNH DẠNG:
1. Giữ nguyên vẹn định dạng, số thứ tự và cấu trúc thời gian (timestamps) của file SRT.
2. Băm nhỏ câu thành các phần, ngăn cách bởi dấu gạch đứng `|` (TUYỆT ĐỐI không có khoảng trắng xung quanh). TUYỆT ĐỐI không sử dụng dấu gạch chéo `/` làm dấu phân cách.
3. Các nhãn phụ trợ như `[-]` hoặc `[lemma]` phải viết DÍNH LIỀN ngay sau từ (TUYỆT ĐỐI không có khoảng trắng).

## II. QUY TẮC LỌC TỪ VỰNG:
1. **Từ vựng GIỮ LẠI**:
   - Danh từ chung, Tên quốc gia/địa danh (VD: 日本{にほん}, ベトナム).
   - Từ mượn Katakana tiếng Nhật (VD: ポッドキャスト, ガソリン).
   - Động từ / Tính từ / Phó từ.
   - **Furigana (QUAN TRỌNG)**: 
     * Với **Chữ Hán (Kanji)**: Thêm Hiragana vào dấu ngoặc nhọn `{ }` (VD: 日本{にほん}).
     * Với **Từ mượn (Katakana)**: Thêm **Từ ngoại ngữ gốc** vào dấu ngoặc nhọn `{ }` (VD: ポッドキャスト{Podcast}).
   - **Từ gốc (Lemma)**: Với Động từ/Tính từ, khôi phục về thể từ điển trong ngoặc vuông `[ ]`. (VD: 話{はな}したい[話す]). **Lưu ý: Không thêm Furigana vào trong [lemma].**

2. **Gán nhãn [-]**:
   - TẤT CẢ thành phần không thuộc mục 1 (Trợ từ, đuôi câu ます/です, dấu câu, số đếm, tên riêng người, từ tiếng Anh).
   - **QUY TẮC GỘP CỤM (QUAN TRỌNG)**: Nếu nhiều phần `[-]` đứng cạnh nhau, hãy gộp lại thành 1 cụm duy nhất rồi mới gán nhãn `[-]`.

## III. VÍ DỤ CHUẨN ĐẦU RA:
**Gốc**: 日本で生きてきたレイラさんは、Bite Size Japaneseのポッドキャスト について 話したい です。

**Kết quả**:
```text
日本{にほん}|で[-]|生{い}きてきた[生きる]|レイラさんは、[-]Bite Size Japaneseの[-]ポッドキャスト{Podcast}|について[-]|話{はな}したい[話す]|です。[-]
```

## IV. NỘI DUNG CẦN XỬ LÝ:
[Dán nội dung SRT vào đây]

TỔNG QUAN
----------------------------------
Vai trò: Bạn là một chuyên gia ngôn ngữ học tiếng Nhật. Hãy đọc nội dung bài (transcript/SRT) dưới đây và viết một đoạn tổng quan tóm tắt nội dung chính.
Yêu cầu:
1. Trình bày mạch lạc, chia thành các gạch đầu dòng rõ ràng (ví dụ: Vấn đề, Thông điệp chính, Phương pháp thực hành).
2. Đặt TOÀN BỘ nội dung tổng quan vào bên trong một code block Markdown để tôi dễ dàng copy.


NGỮ PHÁP
----------------------------------
Dựa vào nội dung bài (transcript/SRT) đã cung cấp, hãy trích xuất các cấu trúc ngữ pháp được sử dụng trong bài và trình bày dưới dạng bảng Markdown.
YÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT:
1. Bảng gồm 4 cột: [Cấu trúc ngữ pháp] | [Ý nghĩa] | [Ví dụ trong bài (Tiếng Nhật)] | [Dịch tiếng Việt].
2. Trong cột "Ví dụ" và "Dịch tiếng Việt", BẮT BUỘC bôi vàng và in đậm phần chứa ngữ pháp bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
3. BẮT BUỘC thêm Furigana cho toàn bộ chữ Hán (Kanji) trong cột "Ví dụ" bằng thẻ HTML `<ruby>`, định dạng chuẩn: `<ruby>漢字<rt>かんじ</rt></ruby>`. Không dùng ngoặc đơn thường.
4. Đặt toàn bộ bảng vào trong một code block Markdown.

TỪ VỰNG
----------------------------------
Dựa vào nội dung bài (transcript/SRT) đã cung cấp, hãy liệt kê các từ vựng khó, từ mới hoặc đáng chú ý trong bài dưới dạng bảng Markdown.
YÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT:
1. Bảng gồm 4 cột: [Từ vựng] | [Ý nghĩa] | [Ví dụ trong bài (Tiếng Nhật)] | [Dịch tiếng Việt].
2. Trong cột "Từ vựng" và "Ví dụ", BẮT BUỘC thêm Furigana cho toàn bộ chữ Hán bằng thẻ HTML `<ruby>`, định dạng: `<ruby>漢字<rt>かんじ</rt></ruby>`.
3. Trong cột "Ví dụ" và "Dịch tiếng Việt", BẮT BUỘC bôi vàng và in đậm từ vựng đó bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
4. Đặt toàn bộ bảng vào trong một code block Markdown.


CẤU TRÚC HỘI THOẠI
----------------------------------
Dựa vào nội dung bài (transcript/SRT) đã cung cấp, hãy tổng hợp các cấu trúc ngữ pháp mang đặc trưng của văn nói (hội thoại thực tế) có trong bài dưới dạng bảng Markdown.
YÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT:
1. Bảng gồm 4 cột: [Cấu trúc văn nói] | [Ý nghĩa / Cách dùng] | [Ví dụ trong bài (Tiếng Nhật)] | [Dịch tiếng Việt].
2. Trong cột "Ví dụ" và "Dịch tiếng Việt", BẮT BUỘC bôi vàng và in đậm cấu trúc đó bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
3. BẮT BUỘC thêm Furigana cho toàn bộ chữ Hán (Kanji) trong cột "Ví dụ" bằng thẻ HTML `<ruby>`, định dạng: `<ruby>漢字<rt>かんじ</rt></ruby>`.
4. Đặt toàn bộ bảng vào trong một code block Markdown.

CỤM TỪ (COLLOCATION)
----------------------------------
Dựa vào nội dung bài (transcript/SRT) đã cung cấp, hãy liệt kê các cụm từ đi liền nhau (Collocations - ví dụ: cụm động từ + danh từ, quán dụng ngữ) xuất hiện trong bài dưới dạng bảng Markdown.
YÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT:
1. Bảng gồm 4 cột: [Cụm từ (Collocation)] | [Ý nghĩa] | [Ví dụ trong bài (Tiếng Nhật)] | [Dịch tiếng Việt].
2. Trong cột "Cụm từ" và "Ví dụ", BẮT BUỘC thêm Furigana cho toàn bộ chữ Hán bằng thẻ HTML `<ruby>`, định dạng: `<ruby>漢字<rt>かんじ</rt></ruby>`.
3. Trong cột "Ví dụ" và "Dịch tiếng Việt", BẮT BUỘC bôi vàng và in đậm cụm từ đó bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
4. Đặt toàn bộ bảng vào trong một code block Markdown.


TRẠNG TỪ (ADVERBS)
----------------------------------
Dựa vào nội dung bài (transcript/SRT) đã cung cấp, hãy trích xuất các trạng từ (phó từ) khó, các trạng từ chỉ mức độ, tần suất hoặc tình thái đáng chú ý trong bài. Đặc biệt lưu ý phân tích xem trạng từ đó đi liền với động từ/tính từ nào, sau đó trình bày dưới dạng bảng Markdown.
YÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT:
1. Bảng gồm 4 cột: [Trạng từ (+ Từ đi kèm)] | [Ý nghĩa] | [Ví dụ trong bài (Tiếng Nhật)] | [Dịch tiếng Việt].
2. Trong cột "Trạng từ" và "Ví dụ", BẮT BUỘC thêm Furigana cho toàn bộ chữ Hán bằng thẻ HTML `<ruby>`, định dạng: `<ruby>漢字<rt>かんじ</rt></ruby>`.
3. Trong cột "Ví dụ" và "Dịch tiếng Việt", BẮT BUỘC bôi vàng và in đậm cụm trạng từ đó bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
4. Đặt toàn bộ bảng vào trong một code block Markdown.