const https = require('https');

const payloads = [
    { action: "generateUploadUrl" },
    { action: "analyzeResume" },
    { action: "getUploadUrl" },
    { action: "uploadResume" },
    { action: "analyze" },
    { action: "GET_UPLOAD_URL" },
    { action: "ANALYZE_RESUME" },
    { action: "generate_upload_url" },
    { action: "analyze_resume" },
    { cmd: "generateUploadUrl" },
    { method: "generateUploadUrl" },
    { op: "generateUploadUrl" },
    { operation: "generateUploadUrl" },
    { action: "test" }
];

async function test(payload) {
    return new Promise((resolve) => {
        const data = JSON.stringify(payload);
        const options = {
            hostname: '8zse71llo4.execute-api.ap-southeast-2.amazonaws.com',
            port: 443,
            path: '/default/resume-analyzer-function',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': btoa(data).length // Rough length check
            }
        };
        // Fix Content-Length
        options.headers['Content-Length'] = Buffer.byteLength(data);

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                resolve({ status: res.statusCode, body });
            });
        });

        req.on('error', (e) => resolve({ error: e.message }));
        req.write(data);
        req.end();
    });
}

async function run() {
    for (const p of payloads) {
        const res = await test(p);
        console.log(`Payload: ${JSON.stringify(p)} => Status: ${res.status}, Body: ${res.body}`);
    }
}

run();
