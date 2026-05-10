

Vai trò: Bạn là một chuyên gia ngôn ngữ học tiếng Nhật và là một giáo viên biên soạn tài liệu học tập.

Nhiệm vụ: Hãy đọc nội dung bài (transcript/SRT) vừa rồi và viết một đoạn tổng quan tóm tắt nội dung chính dưới dạng "Dàn ý học tập" (Study Guide).

Yêu cầu nghiêm ngặt:
1. Trình bày mạch lạc, chia thành các phần rõ ràng (Ví dụ: Chủ đề chính, Vấn đề 1, Vấn đề 2, Lời kết...).
2. Lồng ghép từ vựng tiếng Nhật bằng cách sử dụng các cụm từ/từ khóa quan trọng được trích xuất trực tiếp từ bài gốc làm TIÊU ĐỀ PHỤ cho mỗi ý, thay vì chèn ép chúng vào giữa câu tiếng Việt.
3. CHÈN FURIGANA TRÊN ĐẦU KANJI: Phải sử dụng thẻ HTML `<ruby>` để hiển thị Furigana trên đầu các chữ Hán (Kanji). 
   * Ví dụ ĐÚNG: `<ruby>日本<rt>にほん</rt></ruby>`
   * Tuyệt đối KHÔNG gộp phần đuôi chữ mềm (Okurigana) vào trong thẻ `<ruby>`.
4. TUYỆT ĐỐI tuân thủ cấu trúc của mỗi ý như sau:
   * **[Từ khóa tiếng Nhật có chứa thẻ ruby] (Nghĩa tiếng Việt):** [Diễn giải chi tiết nội dung ngữ cảnh bằng tiếng Việt một cách tự nhiên, trôi chảy].
5. Đặt TOÀN BỘ nội dung tổng quan vào bên trong một code block Markdown để tôi dễ dàng copy.

---
Ví dụ về định dạng mong muốn:
* **Vấn đề 1: Quy tắc xử lý rác (ゴミ<ruby>捨<rt>す</rt></ruby>て)**
   * **ゴミ<ruby>箱<rt>ばこ</rt></ruby>がない (Không có thùng rác):** Rất khó tìm thấy thùng rác công cộng trên phố, buộc người dân phải tự cầm rác theo người.
   * **ゴミの<ruby>分別<rt>ぶんべつ</rt></ruby> (Phân loại rác):** Quy định cực kỳ khắt khe và phải vứt rác theo đúng ngày đã định. 
---


------------------------------------------------------------------------------------------------------

Vai trò: Bạn là một chuyên gia ngôn ngữ học tiếng Nhật kiêm biên tập viên giáo trình học thuật.

Nhiệm vụ: Dựa vào nội dung bài (transcript/SRT) vừa rồi , hãy trích xuất TOÀN BỘ các cấu trúc ngữ pháp quan trọng (tối thiểu 20 mẫu) được sử dụng trong bài.

Yêu cầu trình bày:
1. Định dạng: Trình bày theo dạng danh sách từ trên xuống dưới (KHÔNG dùng bảng). Mỗi cấu trúc là một mục riêng biệt, ngăn cách nhau bởi đường kẻ ngang (---).
2. Nội dung mỗi mục bắt buộc bao gồm:
   - ### [Số thứ tự]. [Tên ngữ pháp] [Cấp độ N..]
   - *   **Cách kết hợp:** [Ghi rõ cách chia với Danh từ (N), Động từ (V), Tính từ (Adj-i/na) theo ký hiệu chuẩn quốc tế].
   - *   **Ý nghĩa:** [Giải thích ngắn gọn, dễ hiểu].
   - *   **Ví dụ:** [Câu tiếng Nhật trích nguyên văn từ bài].
   - *   **Dịch tiếng Việt:** [Nghĩa của câu ví dụ đó].

Yêu cầu định dạng nghiêm ngặt:
1. FURIGANA CHUẨN HTML: Toàn bộ chữ Hán (Kanji) trong phần "Ví dụ" phải có Furigana trên đầu bằng thẻ `<ruby>`, định dạng: `<ruby>漢字<rt>かんじ</rt></ruby>`. TUYỆT ĐỐI không gộp phần chữ mềm (Okurigana) vào thẻ ruby.
2. NHẤN MẠNH NGỮ PHÁP: Trong phần "Ví dụ" và "Dịch tiếng Việt", BẮT BUỘC bôi vàng và in đậm phần chứa cấu trúc ngữ pháp đó bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
3. Đặt toàn bộ kết quả vào trong một code block Markdown (```markdown ... ```).

---
Ví dụ mẫu về định dạng mong muốn:
### 1. Cấu trúc: ～ないといけない
*   **Cách kết hợp:** V-ない (bỏ ない) + ないといけない
*   **Ý nghĩa:** Phải làm gì đó (nghĩa vụ).
*   **Ví dụ:** ゴミを<ruby>持<rt>も</rt></ruby>ち<ruby>歩<rt>ある</rt></ruby>か<span style="color: yellow; font-weight: bold;">ないといけない</span>
*   **Dịch tiếng Việt:** <span style="color: yellow; font-weight: bold;">Phải</span> mang rác theo bên mình.
---


------------------------------------------------------------------------------------------------------
Vai trò: Bạn là một chuyên gia ngôn ngữ học tiếng Nhật kiêm biên tập viên giáo trình học thuật.

Nhiệm vụ: Dựa vào nội dung bài (transcript/SRT) vừa rồi , hãy trích xuất các cụm từ đi liền nhau (tối thiểu 20 mẫu) (Collocations - ví dụ: cụm Động từ + Danh từ, cụm Tính từ + Danh từ, Quán dụng ngữ) xuất hiện trong bài.

Yêu cầu trình bày:
1. Định dạng: Trình bày theo dạng danh sách từ trên xuống dưới (KHÔNG dùng bảng). Mỗi cụm từ là một mục riêng biệt, ngăn cách nhau bởi đường kẻ ngang (---).
2. Nội dung mỗi mục bắt buộc bao gồm:
   - ### [Số thứ tự]. [Cụm từ tiếng Nhật]
   - *   **Ý nghĩa:** [Giải thích ý nghĩa của cụm từ và ngữ cảnh sử dụng].
   - *   **Ví dụ:** [Câu tiếng Nhật trích nguyên văn từ bài bài bài].
   - *   **Dịch tiếng Việt:** [Nghĩa của câu ví dụ đó].

Yêu cầu định dạng nghiêm ngặt:
1. FURIGANA CHUẨN HTML: Toàn bộ chữ Hán (Kanji) trong phần "Cụm từ" và "Ví dụ" phải có Furigana trên đầu bằng thẻ `<ruby>`, định dạng: `<ruby>漢字<rt>かんじ</rt></ruby>`. TUYỆT ĐỐI không gộp phần chữ mềm (Okurigana) vào thẻ ruby.
2. NHẤN MẠNH CỤM TỪ: Trong phần "Ví dụ" và "Dịch tiếng Việt", BẮT BUỘC bôi vàng và in đậm phần chứa cụm từ đó bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
3. Đặt toàn bộ kết quả vào trong một code block Markdown (```markdown ... ```).

---
Ví dụ mẫu về định dạng mong muốn:
### 1. Cụm từ: <ruby>空気<rt>くうき</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む
*   **Ý nghĩa:** Đọc bầu không khí (hiểu ý người khác qua ngữ cảnh).
*   **Ví dụ:** <span style="color: yellow; font-weight: bold;"><ruby>空気<rt>くうき</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む</span><ruby>文化<rt>ぶんか</rt></ruby>です。
*   **Dịch tiếng Việt:** Đó là văn hóa <span style="color: yellow; font-weight: bold;">đọc bầu không khí</span>.
---


------------------------------------------------------------------------------------------------------
Vai trò: Bạn là một chuyên gia ngôn ngữ học tiếng Nhật kiêm biên tập viên giáo trình học thuật.

Nhiệm vụ: Dựa vào nội dung bài (transcript/SRT) vừa rồi , hãy trích xuất các TRẠNG TỪ (Adverbs/Phó từ) quan trọng. Ưu tiên các trạng từ chỉ mức độ, cách thức, trạng thái hoặc thái độ người nói.

Yêu cầu trình bày:
1. Định dạng: Trình bày theo dạng danh sách từ trên xuống dưới (KHÔNG dùng bảng). Mỗi trạng từ là một mục riêng biệt, ngăn cách nhau bởi đường kẻ ngang (---).
2. Nội dung mỗi mục bắt buộc bao gồm:
   - ### [Số thứ tự]. [Trạng từ tiếng Nhật] + [Động từ/Tính từ mà nó bổ nghĩa]
   - *   **Ý nghĩa:** [Giải thích ý nghĩa của trạng từ và sắc thái mà nó thêm vào cho câu].
   - *   **Ví dụ:** [Câu tiếng Nhật trích nguyên văn từ bài].
   - *   **Dịch tiếng Việt:** [Nghĩa của câu ví dụ đó, bôi đậm phần thể hiện trạng từ].

Yêu cầu định dạng nghiêm ngặt:
1. FURIGANA CHUẨN HTML: Toàn bộ chữ Hán (Kanji) trong phần "Trạng từ" và "Ví dụ" phải có Furigana trên đầu bằng thẻ `<ruby>`, định dạng: `<ruby>漢字<rt>かんじ</rt></ruby>`. TUYỆT ĐỐI không gộp phần chữ mềm (Okurigana) vào thẻ ruby.
2. NHẤN MẠNH TRẠNG TỪ: Trong phần "Ví dụ" và "Dịch tiếng Việt", BẮT BUỘC bôi vàng và in đậm phần chứa TRẠNG TỪ (bao gồm cả từ đi kèm nếu cần thiết) bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
3. Đặt toàn bộ kết quả vào trong một code block Markdown (```markdown ... ```).

---
Ví dụ mẫu về định dạng mong muốn:
### 1. Trạng từ: <ruby>全然<rt>ぜんぜん</rt></ruby> + <ruby>違<rt>ちが</rt></ruby>う
*   **Ý nghĩa:** Hoàn toàn (khác biệt). Nhấn mạnh sự khác nhau cực độ giữa hai đối tượng.
*   **Ví dụ:** <ruby>旅行<rt>りょこう</rt></ruby>に<ruby>行<rt>い</rt></ruby>くこととは<span style="color: yellow; font-weight: bold;"><ruby>全然違<rt>ぜんぜんちが</rt></ruby>います</span>
*   **Dịch tiếng Việt:** So với việc đi du lịch thì <span style="color: yellow; font-weight: bold;">hoàn toàn khác biệt</span>.
---

-------------------------------------------------------------------------------------------------
Vai trò: Bạn là một chuyên gia ngôn ngữ học tiếng Nhật kiêm biên tập viên giáo trình học thuật.

Nhiệm vụ: Dựa vào nội dung bài (transcript/SRT) vừa rồi, hãy trích xuất danh sách các TỪ VỰNG QUAN TRỌNG VÀ KHÓ xuất hiện trong bài (ưu tiên các từ vựng từ N3 trở lên, ít nhất 20 từ). Trình bày toàn bộ kết quả dưới dạng một BẢNG duy nhất.

Yêu cầu trình bày:
1. Định dạng: Bắt buộc trình bày bằng BẢNG Markdown.
2. Bảng phải bao gồm 6 cột chính với nội dung như sau:
   - **Từ vựng**: Từ vựng tiếng Nhật nguyên bản.
   - **Loại từ**: Phân loại từ (Ví dụ: Danh từ, Động từ nhóm 1, Tính từ đuôi na, Trạng từ...).
   - **Hán Việt / Từ mượn**: Âm Hán Việt (đối với Kanji) hoặc từ vựng gốc ngoại ngữ (đối với Katakana). Nếu là từ thuần Nhật không có Hán Việt/Từ mượn thì ghi "-".
   - **Nghĩa**: Giải nghĩa tiếng Việt sát với ngữ cảnh được sử dụng trong bài.
   - **Câu trong bài**: Trích dẫn nguyên văn câu chứa từ vựng đó từ bài đọc.
   - **Dịch câu trong bài**: Bản dịch tiếng Việt tự nhiên của câu ví dụ đó.

Yêu cầu định dạng nghiêm ngặt:
1. FURIGANA CHUẨN HTML: Toàn bộ chữ Hán (Kanji) trong cột "Từ vựng" và cột "Câu trong bài" BẮT BUỘC phải có Furigana trên đầu bằng thẻ `<ruby>`, định dạng: `<ruby>漢字<rt>かんじ</rt></ruby>`. TUYỆT ĐỐI không gộp phần chữ mềm (Okurigana) vào thẻ ruby.
2. NHẤN MẠNH TỪ VỰNG: Trong cột "Câu trong bài" và "Dịch câu trong bài", BẮT BUỘC bôi vàng và in đậm từ vựng/cụm từ tương ứng bằng thẻ HTML: `<span style="color: yellow; font-weight: bold;">nội dung</span>`.
3. Đặt toàn bộ BẢNG kết quả vào trong một code block Markdown (```markdown ... 
```) để tôi dễ dàng copy.

---
Ví dụ mẫu về định dạng bảng mong muốn:
| Từ vựng | Loại từ | Hán Việt / Từ mượn | Nghĩa | Câu trong bài | Dịch câu trong bài |
|---|---|---|---|---|---|
| <ruby>飲<rt>いん</rt></ruby><ruby>食<rt>しょく</rt></ruby><ruby>店<rt>てん</rt></ruby> | Danh từ | ẨM THỰC ĐIẾM | Quán ăn, nhà hàng | <span style="color: yellow; font-weight: bold;"><ruby>飲<rt>いん</rt></ruby><ruby>食<rt>しょく</rt></ruby><ruby>店<rt>てん</rt></ruby></span>での<ruby>撮<rt>さつ</rt></ruby><ruby>影<rt>えい</rt></ruby>はしないと<ruby>思<rt>おも</rt></ruby>います | Tôi nghĩ mình sẽ không quay phim ở <span style="color: yellow; font-weight: bold;">quán ăn</span>. |
| ジョギング | Danh từ / Động từ (nhóm 3) | Jogging (Tiếng Anh) | Chạy bộ | ここは<span style="color: yellow; font-weight: bold;">ジョギング</span>のコースにもなっているし | Chỗ này cũng là đường chạy dành cho việc <span style="color: yellow; font-weight: bold;">chạy bộ</span>. |
---