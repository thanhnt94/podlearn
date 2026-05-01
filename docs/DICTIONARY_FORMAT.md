# Dictionary Management & Import Guide

This document describes how to manage and import vocabulary into the PodLearn system dictionaries using the **DictManager**.

## Entry Point
The **DictManager** is accessible via the **Vocab Panel** in the video player sidebar.
1. Open any video.
2. Open the **Vocabulary Tab** (Activity/Book icon).
3. Select the **DictManager** tab from the top navigation bar.

## Dictionary Structure
Dictionaries are categorized by language pairs (Source → Target).
- **Source (src)**: The language of the word you are searching (e.g., `ja` for Japanese).
- **Target (target)**: The language of the definition (e.g., `vi` for Vietnamese).

### System Dictionaries
Pre-created system dictionaries are prefixed with `1.` to ensure they have the highest priority during lookup:
- `1. Japanese-Vietnamese`
- `1. Japanese-English`
- `1. Chinese-Vietnamese`
- `1. English-Vietnamese`

## Import Format (JSON)
To import vocabulary incrementally, use a JSON array of objects. The fields are defined as follows:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `term` | String | **Yes** | The base word or lemma (e.g., `食べる`). |
| `meaning` | String | **Yes** | The translation or definition. |
| `reading` | String | No | The phonetic reading (e.g., `たべる`). |

### Example JSON
```json
[
  {
    "term": "言葉",
    "reading": "ことば",
    "meaning": "từ vựng, ngôn từ"
  },
  {
    "term": "勉強",
    "reading": "べんきょう",
    "meaning": "học tập"
  }
]
```

## How to Import
1. In **DictManager**, select the target dictionary from the left sidebar.
2. Click the **FileJson** icon (top right of the content area) to open the import panel.
3. Paste your JSON array into the text area.
4. Click **START IMPORT**.
   - If a `term` already exists in that dictionary, its `meaning` and `reading` will be updated (Incremental Update).
   - If it doesn't exist, a new entry will be created.

## Best Practices
1. **Naming**: Use the `1.` prefix for dictionaries you want to be "authoritative".
2. **Granularity**: You can paste small snippets of JSON (e.g., 5-10 words at a time) to gradually build your master list.
3. **Consistency**: Ensure the `src` and `target` languages of the dictionary match your data.
