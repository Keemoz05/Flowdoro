use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use uuid::Uuid;

/// Copy a user-selected video file into the app's managed video library.
/// Returns the UUID-based filename so the frontend can construct an asset URL.
#[tauri::command]
fn copy_video_to_library(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    // Resolve $APPDATA/videos/
    let app_data: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {}", e))?;
    let videos_dir = app_data.join("videos");

    // Create directory if it doesn't exist
    fs::create_dir_all(&videos_dir).map_err(|e| format!("Failed to create videos dir: {}", e))?;

    // Extract extension from source path
    let source = PathBuf::from(&source_path);
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4");

    // Generate a unique filename
    let uuid_name = format!("{}.{}", Uuid::new_v4(), ext);
    let dest = videos_dir.join(&uuid_name);

    // Check file size (200MB limit)
    let metadata =
        fs::metadata(&source).map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
    if size_mb > 200.0 {
        return Err(format!(
            "File too large ({:.0}MB). Maximum size is 200MB.",
            size_mb
        ));
    }

    // Copy the file
    fs::copy(&source, &dest).map_err(|e| format!("Failed to copy video: {}", e))?;

    Ok(uuid_name)
}

/// Delete a video file from the app's managed library.
#[tauri::command]
fn delete_video_from_library(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let app_data: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {}", e))?;
    let file_path = app_data.join("videos").join(&filename);

    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| format!("Failed to delete video: {}", e))?;
    }

    Ok(())
}

/// Get the absolute path to the app's video library directory.
/// Frontend needs this to construct convertFileSrc paths.
#[tauri::command]
fn get_video_library_path(app: tauri::AppHandle) -> Result<String, String> {
    let app_data: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {}", e))?;
    let videos_dir = app_data.join("videos");
    fs::create_dir_all(&videos_dir).map_err(|e| format!("Failed to create videos dir: {}", e))?;

    videos_dir
        .to_str()
        .map(|s| s.to_string())
        .ok_or("Path contains invalid UTF-8".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            copy_video_to_library,
            delete_video_from_library,
            get_video_library_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
