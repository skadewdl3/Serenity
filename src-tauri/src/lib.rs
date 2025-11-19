// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_display_name_from_uri(app: tauri::AppHandle, uri: String) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        use jni::objects::{JObject, JString, JValue};
        use std::sync::mpsc;
        use tauri::Manager;

        let window = app
            .get_webview_window("main")
            .expect("Failed to get main window");

        let (tx, rx) = mpsc::channel();
        let uri_clone = uri.clone();

        window.with_webview(move |webview| {
            webview.jni_handle().exec(move |env, activity, _webview| {
                // Get ContentResolver
                let content_resolver = env
                    .call_method(activity, "getContentResolver", "()Landroid/content/ContentResolver;", &[])
                    .expect("Failed to call getContentResolver")
                    .l()
                    .expect("Failed to get ContentResolver object");

                // Parse URI
                let uri_class = env.find_class("android/net/Uri").expect("Failed to find Uri class");
                let uri_string = env.new_string(&uri_clone).expect("Failed to create URI string");
                let uri_obj = env
                    .call_static_method(
                        uri_class,
                        "parse",
                        "(Ljava/lang/String;)Landroid/net/Uri;",
                        &[JValue::Object(&uri_string.into())],
                    )
                    .expect("Failed to call Uri.parse")
                    .l()
                    .expect("Failed to get Uri object");

                // Create projection array with "_display_name"
                let projection = env.new_object_array(1, "java/lang/String", JObject::null())
                    .expect("Failed to create array");
                let display_name_col = env.new_string("_display_name")
                    .expect("Failed to create string");
                env.set_object_array_element(&projection, 0, display_name_col)
                    .expect("Failed to set array element");

                // Query the ContentResolver
                let cursor = env
                    .call_method(
                        &content_resolver,
                        "query",
                        "(Landroid/net/Uri;[Ljava/lang/String;Ljava/lang/String;[Ljava/lang/String;Ljava/lang/String;)Landroid/database/Cursor;",
                        &[
                            JValue::Object(&uri_obj),
                            JValue::Object(&projection.into()),
                            JValue::Object(&JObject::null()),
                            JValue::Object(&JObject::null()),
                            JValue::Object(&JObject::null()),
                        ],
                    )
                    .expect("Query call failed")
                    .l()
                    .expect("Failed to get cursor");

                if cursor.is_null() {
                    panic!("Cursor is null");
                }

                // Move to first row
                let has_data = env
                    .call_method(&cursor, "moveToFirst", "()Z", &[])
                    .expect("moveToFirst call failed")
                    .z()
                    .expect("Failed to get boolean");

                if !has_data {
                    let _ = env.call_method(&cursor, "close", "()V", &[]);
                    panic!("No data in cursor");
                }

                // Get column index for "_display_name"
                let col_name = env.new_string("_display_name")
                    .expect("Failed to create column name");
                let col_index = env
                    .call_method(&cursor, "getColumnIndex", "(Ljava/lang/String;)I", &[JValue::Object(&col_name.into())])
                    .expect("getColumnIndex call failed")
                    .i()
                    .expect("Failed to get int");

                if col_index < 0 {
                    let _ = env.call_method(&cursor, "close", "()V", &[]);
                    panic!("Column not found");
                }

                // Get the display name string
                let display_name_obj = env
                    .call_method(&cursor, "getString", "(I)Ljava/lang/String;", &[JValue::Int(col_index)])
                    .expect("getString call failed")
                    .l()
                    .expect("Failed to get string object");

                let display_name: String = env
                    .get_string(&JString::from(display_name_obj))
                    .expect("get_string failed")
                    .into();

                // Close cursor
                let _ = env.call_method(&cursor, "close", "()V", &[]);

                tx.send(display_name).expect("Failed to send result");
            });
        }).expect("with_webview failed");

        rx.recv()
            .map_err(|e| format!("Failed to receive result: {}", e))
    }

    #[cfg(not(target_os = "android"))]
    {
        Err("Only supported on Android".to_string())
    }
}

#[derive(Serialize, Deserialize)]
struct LoadingText {
    book: String,
    quote: String,
}

struct AppState {
    quotes: Mutex<Vec<LoadingText>>,
}

#[tauri::command]
fn get_random_loading_quote(state: State<'_, AppState>) -> Result<String, String> {
    use rand::Rng;
    let quotes = state.quotes.lock().unwrap();

    if !quotes.is_empty() {
        let mut rng = rand::thread_rng();
        let random_index = rng.gen_range(0..quotes.len());
        if let Some(random_item) = quotes.get(random_index) {
            return Ok(random_item.quote.to_owned());
        }
    }

    // Fallback loading quote
    Ok("Loading...".to_string())
}

use serde::{Deserialize, Serialize};
use std::sync::{mpsc, Mutex};
use tauri::{path::BaseDirectory, Manager, State};
use tauri_plugin_fs::FsExt;
mod files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            let file_path = app_handle
                .path()
                .resolve("resources/loading.json", BaseDirectory::Resource)
                .expect("Failed to resolve loading quotes path");

            let quotes_str = app_handle
                .fs()
                .read_to_string(file_path)
                .expect("Failed to read loading quotes file");

            let quotes: Vec<LoadingText> =
                serde_json::from_str(&quotes_str).unwrap_or_else(|_| vec![]);

            app.manage(AppState {
                quotes: Mutex::new(quotes),
            });

            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_android_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_display_name_from_uri,
            files::pick_file_with_metdata,
            get_random_loading_quote
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
