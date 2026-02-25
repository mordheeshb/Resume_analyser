const https = require('https');

const actions = [
    { action: "generateUploadUrl" },
    { action: "analyzeResume" },
    { action: "GET_UPLOAD_URL" },
    { action: "ANALYZE" },
    { type: "generateUploadUrl" },
    { operation: "generateUploadUrl" },
    { body: JSON.stringify({ action: "generateUploadUrl" }) }
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
                'Content-Length': data.length
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
    for (const a of actions) {
        const res = await test(a);
        console.log(`Payload: ${JSON.stringify(a)} => Status: ${res.status}, Body: ${res.body}`);
    }
}

run();
