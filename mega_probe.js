const https = require('https');

const targetUrl = 'https://8zse71llo4.execute-api.ap-southeast-2.amazonaws.com/default/resume-analyzer-function';

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

const variations = [
    { action: "generateUploadUrl" },
    { action: "analyzeResume" },
    { Action: "generateUploadUrl" },
    { action: "upload" },
    { action: "UPLOAD" },
    { type: "generateUploadUrl" },
    { operation: "generateUploadUrl" },
    { body: JSON.stringify({ action: "generateUploadUrl" }) },
    { action: "GET_UPLOAD_URL" },
    { action: "ANALYZE" }
];

async function run() {
    for (const v of variations) {
        const res = await test(v);
        console.log(`Payload: ${JSON.stringify(v)} => ${res.status} ${res.body}`);
    }
}

run();
