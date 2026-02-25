const https = require('https');

async function test(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: '8zse71llo4.execute-api.ap-southeast-2.amazonaws.com',
            port: 443,
            path: path,
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
        req.end();
    });
}

async function run() {
    const res = await test('/default/resume-analyzer-function?action=generateUploadUrl');
    console.log(`Query Param: action=generateUploadUrl => Status: ${res.status}, Body: ${res.body}`);
}

run();
