// Open/Close Modal OTA
function openOtaModal() {
    const modal = document.getElementById('ota-modal');
    document.getElementById('ota-file-input').value = '';
    document.getElementById('ota-status').classList.add('hidden');

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeOtaModal() {
    const modal = document.getElementById('ota-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

// Proses Upload file .exe ke Server dan Broadcast via SocketIO
async function submitOtaUpdate() {
    const fileInput = document.getElementById('ota-file-input');
    const statusContainer = document.getElementById('ota-status');
    const statusText = document.getElementById('ota-status-text');

    if (!fileInput.files || fileInput.files.length === 0) {
        alert("Harap pilih file .exe terlebih dahulu!");
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    statusContainer.classList.remove('hidden');
    statusText.innerText = "Mengunggah file .exe ke server...";

    try {
        // 1. Upload file ke endpoint HTTP server
        const response = await fetch('/upload-update', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.url) {
            statusText.innerText = "Upload berhasil! Menyiarkan perintah OTA...";

            // 2. Kirim sinyal SocketIO ota_update beserta URL file static
            socket.emit("send_command", {
                target_sid: null, // Broadcast ke semua client
                action: "ota_update",
                url: result.url
            });

            setTimeout(() => {
                closeOtaModal();
                alert("Perintah OTA Update berhasil disiarkan ke seluruh client!");
            }, 500);
        } else {
            alert("Gagal mengunggah file: " + (result.message || "Error server"));
            statusContainer.classList.add('hidden');
        }
    } catch (error) {
        alert("Terjadi kesalahan jaringan saat mengunggah file.");
        statusContainer.classList.add('hidden');
    }
}