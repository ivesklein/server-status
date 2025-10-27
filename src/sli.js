const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    try {
        // Get all servers
        const servers = await dynamodb.send(new ScanCommand({
            TableName: process.env.SERVERS_TABLE
        }));

        const now = Date.now();
        const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago

        for (const server of servers.Items) {
            // Get last month's status records
            const statusRecords = await dynamodb.send(new QueryCommand({
                TableName: process.env.STATUS_TABLE,
                KeyConditionExpression: 'serverId = :serverId AND #ts BETWEEN :start AND :end',
                ExpressionAttributeNames: { '#ts': 'timestamp' },
                ExpressionAttributeValues: {
                    ':serverId': server.id,
                    ':start': oneMonthAgo,
                    ':end': now
                }
            }));

            if (statusRecords.Items.length === 0) continue;

            // Calculate expected checks (5 minutes = 300000ms)
            const expectedChecks = Math.floor((now - oneMonthAgo) / 300000);
            const actualChecks = statusRecords.Items.length;
            const missingChecks = Math.max(0, expectedChecks - actualChecks);
            
            // Calculate SLI considering missing checks as failures
            const successfulChecks = statusRecords.Items.filter(item => item.status === true).length;
            const totalPossibleChecks = expectedChecks;
            const sli = (successfulChecks / totalPossibleChecks) * 100;

            // Calculate average response time for successful checks
            const successfulResponseTimes = statusRecords.Items
                .filter(item => item.status === true && item.responseTime)
                .map(item => item.responseTime);
            
            const avgResponseTime = successfulResponseTimes.length > 0 
                ? successfulResponseTimes.reduce((a, b) => a + b, 0) / successfulResponseTimes.length 
                : 0;


            const parameters = {
                TableName: process.env.SLI_TABLE,
                Item: {
                    serverId: server.id,
                    serverName: server.name,
                    timestamp: now,
                    period: '30days',
                    sli: Number(sli.toFixed(2)),
                    expectedChecks,
                    actualChecks,
                    missingChecks,
                    successfulChecks,
                    avgResponseTime: Number(avgResponseTime.toFixed(2))
                }
            }

            console.log(parameters)

            // Save SLI to new table
            await dynamodb.send(new PutCommand(parameters));
        }

        return { statusCode: 200, body: 'SLI calculation completed' };
    } catch (error) {
        console.error('Error calculating SLI:', error);
        return { statusCode: 500, body: 'Error calculating SLI' };
    }
};