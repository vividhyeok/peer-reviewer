use std::fs;
use std::path::PathBuf;
use base64::{Engine as _, engine::general_purpose};

/// Get the app's data directory (AppData/Local/{bundle_id}/paper-reader-data on Windows)
fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let data_dir = base.join("paper-reader-data");
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data dir: {}", e))?;
    }
    Ok(data_dir)
}

#[tauri::command]
fn copy_file_to_data(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();
    let data_dir = get_data_dir(&app)?;
    let dest = data_dir.join(&filename);
    fs::copy(&source, &dest)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(filename)
}

#[tauri::command]
fn read_data_file(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let data_dir = get_data_dir(&app)?;
    let path = data_dir.join(&filename);
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", filename, e))
}

#[tauri::command]
fn read_data_file_binary(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let data_dir = get_data_dir(&app)?;
    let path = data_dir.join(&filename);
    let bytes = fs::read(&path)
        .map_err(|e| format!("Failed to read binary file '{}': {}", filename, e))?;
    Ok(general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
fn write_data_file(app: tauri::AppHandle, filename: String, content: String) -> Result<(), String> {
    let data_dir = get_data_dir(&app)?;
    let path = data_dir.join(&filename);
    // Ensure subdirectories exist
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file '{}': {}", filename, e))
}

#[tauri::command]
fn list_data_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let data_dir = get_data_dir(&app)?;
    let mut files = Vec::new();
    fn walk(dir: &PathBuf, base: &PathBuf, files: &mut Vec<String>) -> Result<(), String> {
        let entries = fs::read_dir(dir)
            .map_err(|e| format!("Failed to read directory: {}", e))?;
        for entry in entries {
            let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
            let path = entry.path();
            if path.is_dir() {
                walk(&path, base, files)?;
            } else if path.is_file() {
                let rel = path.strip_prefix(base)
                    .map_err(|e| format!("Path error: {}", e))?;
                files.push(rel.to_string_lossy().replace('\\', "/"));
            }
        }
        Ok(())
    }
    walk(&data_dir, &data_dir, &mut files)?;
    Ok(files)
}

#[tauri::command]
fn check_data_file_exists(app: tauri::AppHandle, filename: String) -> Result<bool, String> {
    let data_dir = get_data_dir(&app)?;
    Ok(data_dir.join(&filename).exists())
}

#[tauri::command]
fn delete_data_file(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let data_dir = get_data_dir(&app)?;
    let path = data_dir.join(&filename);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn get_data_dir_path(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = get_data_dir(&app)?;
    Ok(data_dir.to_string_lossy().to_string())
}

/// Copy an HTML file to data dir along with any images referenced via <img src="...">
#[tauri::command]
fn copy_html_with_images(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }
    let source_dir = source.parent().unwrap_or_else(|| std::path::Path::new("."));
    let filename = source
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();
    let data_dir = get_data_dir(&app)?;

    // Copy the HTML file itself
    let dest = data_dir.join(&filename);
    fs::copy(&source, &dest)
        .map_err(|e| format!("Failed to copy HTML file: {}", e))?;

    // Read HTML content and extract image references
    let content = fs::read_to_string(&source)
        .unwrap_or_default();

    // Simple regex-like scan for src="..." in img tags
    // We look for patterns like src="relative/path.png" (not http/data/blob URLs)
    let mut pos = 0;
    let content_bytes = content.as_bytes();
    let content_len = content_bytes.len();
    let mut copied_count = 0u32;

    while pos < content_len {
        // Find <img (case insensitive)
        if let Some(img_pos) = content[pos..].to_lowercase().find("<img") {
            let abs_pos = pos + img_pos;
            // Find src= within the next 1000 chars
            let search_end = (abs_pos + 1000).min(content_len);
            let tag_region = &content[abs_pos..search_end];

            // Find src attribute
            if let Some(src_offset) = tag_region.to_lowercase().find("src=") {
                let src_start = src_offset + 4; // skip "src="
                if src_start < tag_region.len() {
                    let quote_char = tag_region.as_bytes()[src_start];
                    if quote_char == b'"' || quote_char == b'\'' {
                        let value_start = src_start + 1;
                        if let Some(end_quote) = tag_region[value_start..].find(quote_char as char) {
                            let src_value = &tag_region[value_start..value_start + end_quote];

                            // Skip absolute URLs, data URIs, blob URIs
                            let trimmed = src_value.trim();
                            if !trimmed.is_empty()
                                && !trimmed.starts_with("http://")
                                && !trimmed.starts_with("https://")
                                && !trimmed.starts_with("data:")
                                && !trimmed.starts_with("blob:")
                                && !trimmed.starts_with("file:")
                                && !trimmed.starts_with('/')
                            {
                                // Decode URL encoding
                                let decoded = urlencoding_decode(trimmed);
                                let img_source = source_dir.join(&decoded);
                                if img_source.exists() {
                                    let img_dest = data_dir.join(&decoded);
                                    // Create subdirectories if needed
                                    if let Some(parent) = img_dest.parent() {
                                        if !parent.exists() {
                                            let _ = fs::create_dir_all(parent);
                                        }
                                    }
                                    if fs::copy(&img_source, &img_dest).is_ok() {
                                        copied_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            pos = abs_pos + 4;
        } else {
            break;
        }
    }

    println!("[copy_html_with_images] Copied {} images alongside '{}'", copied_count, filename);
    Ok(filename)
}

/// Simple URL decoding (handles %XX sequences)
fn urlencoding_decode(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(val) = u8::from_str_radix(
                &input[i + 1..i + 3],
                16,
            ) {
                result.push(val as char);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i] as char);
        i += 1;
    }
    result
}

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            copy_file_to_data,
            copy_html_with_images,
            read_data_file,
            read_data_file_binary,
            write_data_file,
            list_data_files,
            check_data_file_exists,
            delete_data_file,
            get_data_dir_path,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
