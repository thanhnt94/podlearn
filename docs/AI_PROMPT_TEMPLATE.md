# 🤖 Mẫu Prompt AI cho PodLearn (Quy tắc Băm Sub SRT Siết Chặt)

Tài liệu này chứa mẫu Prompt được thiết kế cực kỳ chi tiết để AI tạo ra file SRT chuẩn nhất, giúp bạn học từ vựng tập trung và không bị rối.

---

## 📝 Prompt Phân Tích & Băm Từ Siêu Chuẩn

**Mục tiêu:** Tạo file .srt băm nhỏ bằng `|`, gán từ gốc `[]` và loại bỏ các từ rác bằng `[skip]`.

### 🚩 QUY TẮC BẮT BUỘC (PHẢI TUÂN THỦ):

1.  **Từ gốc (Lemma)**:
    *   **Động từ/Tính từ đuôi i**: Đưa về dạng nguyên mẫu (ví dụ: `感じる`, `楽しい`).
    *   **Tính từ đuôi na**: **KHÔNG** được thêm `だ` vào cuối (ví dụ: `きれい [きれい]`, không được để `きれい [きれいだ]`).
2.  **Danh sách từ phải [skip] (Bỏ qua)**:
    *   **Trợ từ vô nghĩa**: `を`, `で`, `に`, `は`, `が`, `も`, `と`, `へ`... (ví dụ: `で [skip]`).
    *   **Đuôi lịch sự**: `ます`, `です`, `でした`, `でしょう`... nếu đứng riêng lẻ hoặc là phần bổ trợ không mang nghĩa gốc.
    *   **Dấu câu**: `、`, `。`, `！`, `？`, `「`, `」`... -> `[skip]`.
    *   **Tên riêng & Tiếng nước ngoài & Số đếm,...**: Tên người, địa danh, hoặc từ không phải tiếng Nhật -> `[skip]`.
3.  **Dấu phân cách**: Dùng `|` để tách các từ/cụm từ.

### Mẫu Prompt (Hãy copy đoạn này):
```text
Bạn là một chuyên gia ngôn ngữ học tiếng Nhật. Hãy phân tích và băm nhỏ file phụ đề SRT sau đây theo các quy tắc cực kỳ nghiêm ngặt:

YÊU CẦU CHUNG:

Giữ nguyên định dạng và cấu trúc thời gian của file SRT.

Băm nhỏ mỗi câu bằng dấu gạch đứng |.

QUY TẮC XỬ LÝ TỪ VỰNG:
3. Động từ / Tính từ: Đưa về dạng từ điển (thể nguyên dạng) và đặt trong ngoặc vuông [ ] ngay sau từ đó. Lưu ý: Riêng tính từ đuôi na KHÔNG được thêm "da".
4. Gán nhãn [skip] cho các trường hợp sau:

Trợ từ đơn cơ bản (wa, ga, wo, ni, de, mo, to, he, ya...).

Đuôi câu lịch sự (masu, desu, mashita, deshita...).

Dấu câu (chấm, phẩy, ngoặc, dấu hỏi...).

Số đếm cơ bản.

Tên riêng chỉ người, thương hiệu, tên ứng dụng cụ thể (VD: レイラ, Bite Size Japanese, Patreon, YouTube).

Từ ngoại ngữ viết bằng Romaji/chữ cái Latinh/Tiếng Anh (VD: OK, CC, km, AI, ETC).

🚨 QUY TẮC NGOẠI LỆ (TUYỆT ĐỐI KHÔNG GÁN [skip], PHẢI GIỮ LẠI):

Tên quốc gia / Địa danh: Phải giữ nguyên (VD: 日本, アメリカ, イラン, フィリピン, オーストラリア...).

Từ mượn Katakana thông dụng: Phải giữ nguyên, không được coi là từ ngoại ngữ (VD: ポッドキャスト, エピソード, ガソリン, ルール, マナー...).

Cấu trúc ngữ pháp / Trợ từ phức hợp / Phó từ chỉ mức độ: Phải giữ nguyên (VD: について, とか, みたい, って, くらい/ぐらい, だけ, しか, だったら, なんで...).

VÍ DỤ MẪU:
Gốc: 日本で生きてきたレイラさんは、Bite Size Japaneseのポッドキャストについて話したいです。
Kết quả: 日本 | で [skip] | 生きてきた [生きる] | レイラ [skip] | さん [skip] | は [skip] | 、 [skip] | Bite [skip] | Size [skip] | Japanese [skip] | の [skip] | ポッドキャスト | について | 話したい [話す] | です [skip] | 。 [skip]

NỘI DUNG CẦN XỬ LÝ:
[Dán file SRT vào đây]

KẾT THÚC COPY

## 💡 Lưu ý cho người dùng:
- Khi AI trả về, bạn chỉ cần nạp vào máy.
- Các từ có `[skip]` sẽ mờ đi, giúp bạn chỉ tập trung vào các từ "xịn" (động từ, tính từ, danh từ quan trọng).
- Việc bỏ `da` sau tính từ đuôi na giúp phần mềm tra từ điển Offline chính xác 100%.
