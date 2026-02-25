async function testLocal() {
    try {
        const res = await fetch('http://localhost:3000/api/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "generateUploadUrl" })
        });
        const data = await res.json();
        console.log("Local API status:", res.status);
        console.log("Local API body:", data);
    } catch (err) {
        console.error("Local API error:", err.message);
    }
}

testLocal();
