const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const { httpMethod, path, pathParameters, body } = event;
    
    try {
        switch (`${httpMethod} ${path}`) {
            case 'GET /servers':
                return await getServers();
            case 'POST /servers':
                return await addServer(JSON.parse(body));
            case 'DELETE /servers/{id}':
                return await deleteServer(pathParameters.id);
            case 'GET /status':
                return await getStatus();
            case 'GET /history/{id}':
                return await getHistory(pathParameters.id);
            default:
                return { statusCode: 404, body: 'Not found' };
        }
    } catch (error) {
        console.error('Error:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Internal server error' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};

async function getServers() {
    const result = await dynamodb.scan({
        TableName: process.env.SERVERS_TABLE
    }).promise();
    
    return {
        statusCode: 200,
        body: JSON.stringify(result.Items),
        headers: { 'Content-Type': 'application/json' }
    };
}

async function addServer(server) {
    const item = {
        id: uuidv4(),
        name: server.name,
        url: server.url,
        createdAt: Date.now()
    };
    
    await dynamodb.put({
        TableName: process.env.SERVERS_TABLE,
        Item: item
    }).promise();
    
    return {
        statusCode: 201,
        body: JSON.stringify(item),
        headers: { 'Content-Type': 'application/json' }
    };
}

async function deleteServer(id) {
    await dynamodb.delete({
        TableName: process.env.SERVERS_TABLE,
        Key: { id }
    }).promise();
    
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Server deleted' }),
        headers: { 'Content-Type': 'application/json' }
    };
}

async function getStatus() {
    // Get all servers
    const servers = await dynamodb.scan({
        TableName: process.env.SERVERS_TABLE
    }).promise();
    
    // Get latest status for each server
    const statusPromises = servers.Items.map(async (server) => {
        const status = await dynamodb.query({
            TableName: process.env.STATUS_TABLE,
            KeyConditionExpression: 'serverId = :serverId',
            ExpressionAttributeValues: { ':serverId': server.id },
            ScanIndexForward: false,
            Limit: 1
        }).promise();
        
        return {
            ...server,
            status: status.Items[0] || { status: false, responseTime: 0 }
        };
    });
    
    const results = await Promise.all(statusPromises);
    
    return {
        statusCode: 200,
        body: JSON.stringify(results),
        headers: { 'Content-Type': 'application/json' }
    };
}

async function getHistory(serverId) {
    const result = await dynamodb.query({
        TableName: process.env.STATUS_TABLE,
        KeyConditionExpression: 'serverId = :serverId',
        ExpressionAttributeValues: { ':serverId': serverId },
        ScanIndexForward: false,
        Limit: 50
    }).promise();
    
    return {
        statusCode: 200,
        body: JSON.stringify(result.Items.reverse()),
        headers: { 'Content-Type': 'application/json' }
    };
}