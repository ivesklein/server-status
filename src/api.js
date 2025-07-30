const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    const { httpMethod, path, pathParameters, body } = event;
    
    try {
        if (httpMethod === 'GET' && (path === '/servers' || path === '/api/servers')) {
            return await getServers();
        }
        if (httpMethod === 'POST' && (path === '/servers' || path === '/api/servers')) {
            return await addServer(JSON.parse(body));
        }
        if (httpMethod === 'DELETE' && (path.startsWith('/servers/') || path.startsWith('/api/servers/'))) {
            return await deleteServer(pathParameters.id);
        }
        if (httpMethod === 'GET' && (path === '/status' || path === '/api/status')) {
            return await getStatus();
        }
        if (httpMethod === 'GET' && (path.startsWith('/history/') || path.startsWith('/api/history/'))) {
            return await getHistory(pathParameters.id);
        }
        
        return { statusCode: 404, body: `Not found ${httpMethod} ${path}` };
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
    const result = await dynamodb.send(new ScanCommand({
        TableName: process.env.SERVERS_TABLE
    }));
    
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
    
    await dynamodb.send(new PutCommand({
        TableName: process.env.SERVERS_TABLE,
        Item: item
    }));
    
    return {
        statusCode: 201,
        body: JSON.stringify(item),
        headers: { 'Content-Type': 'application/json' }
    };
}

async function deleteServer(id) {
    await dynamodb.send(new DeleteCommand({
        TableName: process.env.SERVERS_TABLE,
        Key: { id }
    }));
    
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Server deleted' }),
        headers: { 'Content-Type': 'application/json' }
    };
}

async function getStatus() {
    // Get all servers
    const servers = await dynamodb.send(new ScanCommand({
        TableName: process.env.SERVERS_TABLE
    }));
    
    // Get latest status for each server
    const statusPromises = servers.Items.map(async (server) => {
        const status = await dynamodb.send(new QueryCommand({
            TableName: process.env.STATUS_TABLE,
            KeyConditionExpression: 'serverId = :serverId',
            ExpressionAttributeValues: { ':serverId': server.id },
            ScanIndexForward: false,
            Limit: 1
        }));
        
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
    const result = await dynamodb.send(new QueryCommand({
        TableName: process.env.STATUS_TABLE,
        KeyConditionExpression: 'serverId = :serverId',
        ExpressionAttributeValues: { ':serverId': serverId },
        ScanIndexForward: false,
        Limit: 50
    }));
    
    return {
        statusCode: 200,
        body: JSON.stringify(result.Items.reverse()),
        headers: { 'Content-Type': 'application/json' }
    };
}