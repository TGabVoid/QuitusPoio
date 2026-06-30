#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use base64::{Engine as _, engine::general_purpose};
use std::env;

#[tauri::command]
async fn list_flyers(handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    let mut flyers = Vec::new();
    let mut found_path = None;

    // --- ESTRATEGIA DE BÚSQUEDA AGRESIVA ---
    let mut candidates = Vec::new();

    // 1. Ruta oficial de recursos de Tauri (funciona en .exe con resources incluidos)
    if let Some(p) = handle.path_resolver().resolve_resource("bundle-resources/flyers") {
        candidates.push(p);
    }

    // 2. Ruta relativa al directorio de ejecución actual
    candidates.push(PathBuf::from("bundle-resources/flyers"));

    // 3. Ruta relativa un nivel arriba (dev desde src-tauri)
    candidates.push(PathBuf::from("src-tauri/bundle-resources/flyers"));

    // 4. Ruta basada en el ejecutable actual
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("bundle-resources/flyers"));
            candidates.push(exe_dir.join("_up_/bundle-resources/flyers"));
        }
    }

    // 5. Ruta basada en el directorio de trabajo actual
    if let Ok(cwd) = env::current_dir() {
        candidates.push(cwd.join("bundle-resources/flyers"));
        candidates.push(cwd.join("src-tauri/bundle-resources/flyers"));
    }

    for path in candidates {
        println!("Rust: [DEBUG] Probando ruta: {:?}", path);
        if path.exists() && path.is_dir() {
            println!("Rust: [DEBUG] ¡CARPETA ENCONTRADA EN: {:?}!", path);
            found_path = Some(path);
            break;
        }
    }

    if let Some(resource_path) = found_path {
        if let Ok(entries) = fs::read_dir(resource_path) {
            let mut paths: Vec<_> = entries.flatten().map(|e| e.path()).collect();

            paths.sort_by(|a, b| {
                let a_s = a.file_name().and_then(|s| s.to_str()).unwrap_or("");
                let b_s = b.file_name().and_then(|s| s.to_str()).unwrap_or("");
                let get_n = |s: &str| s.chars().filter(|c| c.is_digit(10)).collect::<String>().parse::<u32>().unwrap_or(0);
                get_n(a_s).cmp(&get_n(b_s))
            });

            for path in paths {
                let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                let fname_lower = filename.to_lowercase();
                let is_image = fname_lower.ends_with(".jpeg") || fname_lower.ends_with(".jpg");
                if fname_lower.contains("flyer") && is_image {
                    if let Ok(bytes) = fs::read(&path) {
                        let b64 = general_purpose::STANDARD.encode(bytes);
                        flyers.push(format!("data:image/jpeg;base64,{}", b64));
                        println!("Rust: [DEBUG] Cargado flyer: {}", filename);
                    }
                }
            }
        }
    }

    println!("Rust: [DEBUG] Total flyers cargados: {}", flyers.len());
    Ok(flyers)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_flyers])
        .run(tauri::generate_context!())
        .expect("error");
}
