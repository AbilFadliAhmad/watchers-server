import os
import re

def get_latest_watchers_version() -> str:
    downloads_dir = os.path.join(os.getcwd(), "downloads")
    """Memeriksa folder downloads di server dan mengembalikan versi terbaru

    dari file installer WatchersClient (contoh: WatchersClient-v1.3.0-x64.exe).

    Mengembalikan '0.0.0' jika tidak ada file yang cocok.
    """
    if not os.path.exists(downloads_dir) or not os.path.isdir(downloads_dir):
        return "0.0.0"

    # Regex mencocokkan pola: WatchersClient-v<VERSION>-<ARCH>.exe
    # Contoh yang cocok: WatchersClient-v1.3.0-x64.exe, WatchersClient-v2.0.1-x86.exe
    pattern = re.compile(
        r"^WatchersClient-v(?P<version>\d+\.\d+\.\d+)(?:-[a-zA-Z0-9]+)?\.exe$",
        re.IGNORECASE,
    )

    found_versions = []

    for filename in os.listdir(downloads_dir):
        match = pattern.match(filename)
        if match:
            version_str = match.group("version")
            try:
                # Konversi ke tuple int agar perbandingan versi akurat (contoh: 1.10.0 > 1.3.0)
                version_tuple = tuple(map(int, version_str.split(".")))
                found_versions.append((version_tuple, version_str))
            except ValueError:
                continue

    if not found_versions:
        return "0.0.0"

    # Urutkan dari versi tertinggi ke terendah
    found_versions.sort(key=lambda x: x[0], reverse=True)

    # Kembalikan string versi tertinggi (misal: "1.3.0")
    return found_versions[0][1]

def parse_version(version_str: str) -> tuple:
    """Mengonversi string versi '1.3.0' menjadi tuple angka (1, 3, 0) untuk perbandingan akurat."""
    try:
        # Bersihkan karakter 'v' jika ada (contoh: 'v1.3.0' -> '1.3.0')
        clean_str = version_str.lower().replace("v", "").strip()
        return tuple(map(int, clean_str.split(".")))
    except Exception:
        return (0, 0, 0)