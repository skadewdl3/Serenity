use serde::{Deserialize, Serialize};
use std::sync::{mpsc, Arc, Mutex};
use tauri::Manager;
use tauri_plugin_android_fs::{AndroidFsExt, ImageFormat, Size};

#[derive(Serialize, Deserialize, Debug)]
pub struct FileInfo {
    path: String,
    uri: String,
    file_type: String,
    name: String,
}

#[tauri::command]
pub fn pick_file_with_metdata(
    app: tauri::AppHandle<impl tauri::Runtime>,
) -> Result<FileInfo, String> {
    let api = app.android_fs();

    // Pick files to read and write
    let uri = api
        .file_picker()
        .pick_file(
            None,     // Initial location
            &["*/*"], // Target MIME types
        )
        .expect("Failed to pick file");

    if let None = uri {
        return Err("No files selected".into());
    }

    let uri = uri.unwrap();
    api.take_persistable_uri_permission(&uri)
        .expect("Failed to take persistable permission");

    // This is FilePath::Url(..)
    // Not FilePath::Path(..)
    let file_path: tauri_plugin_fs::FilePath = uri.clone().into();

    let file_type = api.get_mime_type(&uri).expect("Failed to get MIME type");
    let file_name = api.get_name(&uri).expect("Failed to get name");
    let file_thumbnail = api
        .get_thumbnail(
            &uri,
            Size {
                width: 200,
                height: 200,
            },
            ImageFormat::Jpeg,
        )
        .expect("Failed to get thumbnail");

    Ok(FileInfo {
        path: file_path.to_string(),
        uri: uri.to_json_string().unwrap(),
        file_type: file_type.to_string(),
        name: file_name,
        // thumbnail: file_thumbnail,
    })
}
