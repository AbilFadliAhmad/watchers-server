// --- TOAST NOTIFICATION HELPER ---
function showToast(message, type = 'success') {
    const isSuccess = type === 'success';
    Toastify({
        text: message,
        duration: 3500,
        gravity: "top",
        position: "right",
        style: {
            background: isSuccess ? "#064e3b" : "#881337",
            color: isSuccess ? "#6ee7b7" : "#fda4af",
            border: `1px solid ${isSuccess ? "#047857" : "#be123c"}`,
            borderRadius: "0.75rem",
            fontSize: "12px",
            fontWeight: "600"
        }
    }).showToast();
}