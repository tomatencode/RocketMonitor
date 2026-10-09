use std::fs::OpenOptions;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

/// Treat firmware filenames as labels, never as paths, and never overwrite a download.
pub fn save_log(directory: &Path, filename: &str, data: &[u8]) -> io::Result<PathBuf> {
    let sanitized: String = filename
        .chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '-' | '_' | '.') { c } else { '_' })
        .collect();
    let stem = sanitized.trim_matches('.');
    let stem = stem.strip_suffix(".rcktlog").unwrap_or(stem);
    let stem = if stem.is_empty() { "rocket-log" } else { stem };
    std::fs::create_dir_all(directory)?;
    for index in 0..10000 {
        let name = if index == 0 {
            format!("{stem}.rcktlog")
        } else {
            format!("{stem}-{index}.rcktlog")
        };
        let path = directory.join(name);
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                if let Err(error) = file.write_all(data).and_then(|_| file.sync_all()) {
                    drop(file);
                    let _ = std::fs::remove_file(&path);
                    return Err(error);
                }
                return Ok(path);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }
    Err(io::Error::new(io::ErrorKind::AlreadyExists, "Too many downloads with the same filename"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn saves_exact_bytes_without_overwriting_or_traversing_paths() {
        let directory = std::env::temp_dir().join(format!("rocket-log-test-{}-{}",
            std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        let bytes = [0, 255, 0, 128, 10, 13];
        let first = save_log(&directory, "flight.rcktlog", &bytes).unwrap();
        let second = save_log(&directory, "flight.rcktlog", &[42]).unwrap();
        assert_eq!(first.file_name().unwrap(), "flight.rcktlog");
        assert_eq!(second.file_name().unwrap(), "flight-1.rcktlog");
        assert_eq!(std::fs::read(first).unwrap(), bytes);
        assert_eq!(std::fs::read(second).unwrap(), [42]);
        let unsafe_name = save_log(&directory, "../../escape", &[]).unwrap();
        assert_eq!(unsafe_name.parent().unwrap(), directory);
        assert_eq!(unsafe_name.extension().unwrap(), "rcktlog");
        let empty_name = save_log(&directory, "..", &[1]).unwrap();
        assert_eq!(empty_name.file_name().unwrap(), "rocket-log.rcktlog");
        std::fs::remove_dir_all(directory).unwrap();
    }
}