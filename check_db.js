const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// Load from environment or use defaults
const REGION = "ap-southeast-2";
const TABLE = "JobRoles";

async function checkDB() {
    const client = new DynamoDBClient({ region: REGION });
    const docClient = DynamoDBDocumentClient.from(client);

    try {
        console.log(`Scanning table: ${TABLE}...`);
        const result = await docClient.send(new ScanCommand({ TableName: TABLE }));
        console.log(`Found ${result.Items.length} items.`);
        if (result.Items.length > 0) {
            console.log("First item sample:", JSON.stringify(result.Items[0], null, 2));
        } else {
            console.log("TABLE IS EMPTY!");
        }
    } catch (err) {
        console.error("Error scanning DynamoDB:", err.message);
    }
}

checkDB();
