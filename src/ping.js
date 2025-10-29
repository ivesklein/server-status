const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const https = require('https');
const http = require('http');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const sns = new SNSClient({});

exports.handler = async (event) => {
    try {
        // Get all servers from DynamoDB
        const servers = await dynamodb.send(new ScanCommand({
            TableName: process.env.SERVERS_TABLE
        }));

        for (const server of servers.Items) {
            const status = await pingServer(server.url);
            const timestamp = Date.now();
            
            // Store status in DynamoDB
            const item = {
                serverId: server.id,
                timestamp,
                status: status.isUp,
                responseTime: status.responseTime,
                statusCode: status.statusCode
            };
            
            // Add extra data if available
            if (status.activity !== undefined) item.activity = status.activity;
            if (status.activeGames !== undefined) item.activeGames = status.activeGames;
            if (status.runningMatches !== undefined) item.runningMatches = status.runningMatches;
            
            await dynamodb.send(new PutCommand({
                TableName: process.env.STATUS_TABLE,
                Item: item
            }));

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
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.3'
            }
        };
        
        // For HTTPS, check certificate validity
        if (url.startsWith('https')) {
            options.rejectUnauthorized = false; // We'll handle cert validation manually
        }
        
        const req = client.get(url, options, (res) => {
            const responseTime = Date.now() - startTime;
            let body = '';
            
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const result = {
                    isUp: res.statusCode < 400,
                    responseTime,
                    statusCode: res.statusCode
                };
                
                // Try to parse JSON and extract additional data
                try {
                    const jsonData = JSON.parse(body);
                    if (jsonData.activity !== undefined) result.activity = jsonData.activity;
                    if (jsonData.activeGames !== undefined) result.activeGames = jsonData.activeGames.length;
                    if (jsonData.running_matches !== undefined) result.runningMatches = jsonData.running_matches;
                } catch (e) {
                    // Not JSON or parsing failed, continue without extra data
                }
                
                resolve(result);
            });
        });

        req.on('error', (error) => {
            // Check if it's an SSL certificate error
            const isSslError = error.code === 'CERT_HAS_EXPIRED' || 
                              error.code === 'CERT_NOT_YET_VALID' ||
                              error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
            
            resolve({
                isUp: false,
                responseTime: Date.now() - startTime,
                statusCode: isSslError ? -1 : 0 // Use -1 to indicate SSL error
            });
        });
        
        // For HTTPS requests, check certificate expiration
        if (url.startsWith('https')) {
            req.on('socket', (socket) => {
                socket.on('secureConnect', () => {
                    const cert = socket.getPeerCertificate();
                    if (cert && cert.valid_to) {
                        const expiryDate = new Date(cert.valid_to);
                        const now = new Date();
                        
                        if (expiryDate <= now) {
                            req.destroy();
                            resolve({
                                isUp: false,
                                responseTime: Date.now() - startTime,
                                statusCode: -1 // SSL certificate expired
                            });
                        }
                    }
                });
            });
        }

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
        const result = await dynamodb.send(new QueryCommand({
            TableName: process.env.STATUS_TABLE,
            KeyConditionExpression: 'serverId = :serverId',
            ExpressionAttributeValues: { ':serverId': serverId },
            ScanIndexForward: false,
            Limit: 2
        }));
        
        return result.Items[1]; // Second most recent
    } catch (error) {
        return null;
    }
}

async function sendAlert(server, isUp) {
    const message = `Server ${server.name} (${server.url}) is now ${isUp ? 'UP' : 'DOWN'}`;
    
    await sns.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC,
        Message: message,
        Subject: `Server Alert: ${server.name}`
    }));
}