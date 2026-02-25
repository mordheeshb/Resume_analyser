async function testAnalyze() {
    try {
        const res = await fetch('http://localhost:3000/api/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "analyzeResume", fileKey: "resumes/test.pdf" })
        });
        const data = await res.json();
        console.log("Analyze status:", res.status);
        console.log("Analyze body:", data);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

testAnalyze();
