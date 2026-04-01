# AuraFlow Sentence JSON Standard (v1.0)

Tài liệu này quy định cấu trúc dữ liệu JSON để nạp vào hệ thống AuraFlow cho luồng **Phản Xạ (Reflexive Track)**.

## Cấu trúc Tổng quát

Dữ liệu JSON bao gồm 3 khối (block) chính:

1.  `core_sentence`: Chứa nội dung văn bản chính và bản dịch.
2.  `grammar_formula`: Chứa công thức ngữ pháp cốt lõi và ý nghĩa của mẫu câu.
3.  `color_mapped_tokens`: Mảng chứa các từ vựng đã được bóc tách, có kèm cách đọc (reading) và nhóm màu (color_group) để hiển thị đồng bộ trên UI.

---

## Chi tiết các Block

### 1. core_sentence
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `original_text` | String | (Bắt buộc) Câu gốc bằng ngôn ngữ đích (vd: tiếng Nhật). |
| `translated_text` | String | (Bắt buộc) Bản dịch nghĩa sang tiếng Việt. |
| `source_lang` | String | Mã ngôn ngữ nguồn (vd: "ja"). |
| `target_lang` | String | Mã ngôn ngữ nội dung (vd: "vi"). |

### 2. grammar_formula
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `pattern` | String | Công thức ngữ pháp (vd: "[A] にもかかわらず [B]"). |
| `meaning` | String | Giải thích ý nghĩa của mẫu câu này. |
| `example` | String | Cách đọc Romaji hoặc ví dụ bổ sung. |

### 3. color_mapped_tokens (Mảng)
Mỗi phần tử trong mảng đại diện cho một Token (Từ/Cụm từ):
- `source_word`: Từ gốc.
- `reading`: Cách đọc (Furigana/Pinyin).
- `target_word`: Nghĩa của từ đó trong ngữ cảnh câu này (có thể là `null` nếu là trợ từ).
- `color_group`: ID nhóm màu (1, 2, 3...). Các Token cùng nhóm màu sẽ hiển thị cùng màu trên giao diện.
- `note`: Ghi chú thêm (vd: "Trợ từ chỉ chủ ngữ").

---

## Ví dụ mẫu (Mẫu chuẩn)

```json
{
  "core_sentence": {
    "original_text": "雨が降っているにもかかわらず、彼は出かけていった。",
    "translated_text": "Mặc dù trời đang mưa, anh ấy vẫn đi ra ngoài.",
    "source_lang": "ja",
    "target_lang": "vi"
  },
  "grammar_formula": {
    "pattern": "[A] にもかかわらず [B]",
    "meaning": "Mặc dù trạng thái [A] đang diễn ra, nhưng thực tế lại xảy ra hành động [B] trái ngược hoàn toàn với dự đoán thông thường.",
    "example": "Ame ga futte iru ni mo kakawarazu, kare wa dekakete itta."
  },
  "color_mapped_tokens": [
    {
      "source_word": "雨",
      "reading": "あめ",
      "target_word": "trời mưa",
      "color_group": 1
    },
    {
      "source_word": "が",
      "reading": "が",
      "target_word": null,
      "color_group": 0,
      "note": "Trợ từ chỉ chủ ngữ phụ"
    },
    {
      "source_word": "降っている",
      "reading": "ふっている",
      "target_word": "đang",
      "color_group": 2
    },
    {
      "source_word": "にもかかわらず",
      "reading": "にもかかわらず",
      "target_word": "Mặc dù",
      "color_group": 3
    }
  ]
}
```
