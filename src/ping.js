const AWS = require('aws-sdk');
const https = require('https');
const http = require('http');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

exports.handler = async (event) => {
    try {
        // Get all servers from DynamoDB
        const servers = await dynamodb.scan({
            TableName: process.env.SERVERS_TABLE
        }).promise();

        for (const server of servers.Items) {
            const status = await pingServer(server.url);
            const timestamp = Date.now();
            
            // Store status in DynamoDB
            await dynamodb.put({
                TableName: process.env.STATUS_TABLE,
                Item: {
                    serverId: server.id,
                    timestamp,
                    status: status.isUp,
                    responseTime: status.responseTime,
                    statusCode: status.statusCode
                }
            }).promise();

            // Check if status changed
            const lastStatus = await getLastStatus(server.id);
            if (lastStatus && lastStatus.status !== status.isUp) {
                await sendAlert(server, status.isUp);
            }
        }

        return { statusCode: 200, body: 'Ping completed' };
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: 'Error pinging servers' };
    }
};

async function pingServer(url) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const client = url.startsWith('https') ? https : http;
        
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.3'
            }
        }, (res) => {
            const responseTime = Date.now() - startTime;
            resolve({
                isUp: res.statusCode < 400,
                responseTime,
                statusCode: res.statusCode
            });
        });

        req.on('error', () => {
            resolve({
                isUp: false,
                responseTime: Date.now() - startTime,
                statusCode: 0
            });
        });

        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                isUp: false,
                responseTime: 10000,
                statusCode: 0
            });
        });
    });
}

async function getLastStatus(serverId) {
    try {
        const result = await dynamodb.query({
            TableName: process.env.STATUS_TABLE,
            KeyConditionExpression: 'serverId = :serverId',
            ExpressionAttributeValues: { ':serverId': serverId },
            ScanIndexForward: false,
            Limit: 2
        }).promise();
        
        return result.Items[1]; // Second most recent
    } catch (error) {
        return null;
    }
}

async function sendAlert(server, isUp) {
    const message = `Server ${server.name} (${server.url}) is now ${isUp ? 'UP' : 'DOWN'}`;
    
    await sns.publish({
        TopicArn: process.env.SNS_TOPIC,
        Message: message,
        Subject: `Server Alert: ${server.name}`
    }).promise();
}