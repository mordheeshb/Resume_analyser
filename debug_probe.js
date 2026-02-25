const https = require('https');

const payloads = [
    { action: "generateUploadUrl" },
    { action: "analyzeResume" },
    { Action: "generateUploadUrl" },
    { type: "generateUploadUrl" },
    { body: JSON.stringify({ action: "generateUploadUrl" }) },
    { body: { action: "generateUploadUrl" } },
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
                'Content-Type': 'application/json'
            }
        };

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
    console.log("Starting probe...");
    for (const p of payloads) {
        const res = await test(p);
        console.log(`Payload: ${JSON.stringify(p)} => Status: ${res.status}, Body: ${res.body}`);
    }
}

run();
