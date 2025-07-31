const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-in-production';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    const { httpMethod, path, pathParameters, body, headers } = event;
    const authHeader = headers.Authorization || headers.authorization || headers['Authorization'] || headers['authorization'];
    const token = authHeader?.replace('Bearer ', '');
    const isAuthenticated = verifyToken(token);
    
    try {
        if (httpMethod === 'POST' && (path === '/login' || path === '/api/login')) {
            return await login(JSON.parse(body));
        }
        if (httpMethod === 'GET' && (path === '/servers' || path === '/api/servers')) {
            return requireAuth(isAuthenticated, () => getServers());
        }
        if (httpMethod === 'POST' && (path === '/servers' || path === '/api/servers')) {
            return requireAuth(isAuthenticated, () => addServer(JSON.parse(body)));
        }
        if (httpMethod === 'DELETE' && (path.startsWith('/servers/') || path.startsWith('/api/servers/'))) {
            return requireAuth(isAuthenticated, () => deleteServer(pathParameters.id));
        }
        if (httpMethod === 'GET' && (path === '/status' || path === '/api/status')) {
            return await getStatus(isAuthenticated);
        }
        if (httpMethod === 'GET' && (path.startsWith('/history/') || path.startsWith('/api/history/'))) {
            return requireAuth(isAuthenticated, () => getHistory(pathParameters.id));
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

function verifyToken(token) {
    if (!token) {
        console.log('Token verification failed: no token');
        return false;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Token verified successfully:', decoded);
        return true;
    } catch (error) {
        console.log('Token verification failed:', error.message);
        return false;
    }
}

function requireAuth(isAuthenticated, callback) {
    if (!isAuthenticated) {
        console.log('Auth required but user not authenticated');
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Unauthorized' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
    console.log('Auth check passed');
    return callback();
}

async function login(credentials) {
    if (credentials.password !== ADMIN_PASSWORD) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid password' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
    
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return {
        statusCode: 200,
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
    };
}

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

async function getStatus(isAuthenticated) {
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
        
        const serverData = {
            id: server.id,
            name: server.name,
            status: status.Items[0]?.status || false,
            timestamp: status.Items[0]?.timestamp
        };
        
        // Add full data only for authenticated users
        if (isAuthenticated) {
            serverData.url = server.url;
            serverData.responseTime = status.Items[0]?.responseTime || 0;
            if (status.Items[0]?.activity !== undefined) serverData.activity = status.Items[0].activity;
            if (status.Items[0]?.activeGames !== undefined) serverData.activeGames = status.Items[0].activeGames;
            if (status.Items[0]?.runningMatches !== undefined) serverData.runningMatches = status.Items[0].runningMatches;
        }
        
        return serverData;
    });
    
    const results = await Promise.all(statusPromises);
    
    return {
        statusCode: 200,
        body: JSON.stringify(results),
        headers: { 'Content-Type': 'application/json' }
    };
}

async function getHistory(serverId) {
    const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
    
    const result = await dynamodb.send(new QueryCommand({
        TableName: process.env.STATUS_TABLE,
        KeyConditionExpression: 'serverId = :serverId AND #timestamp >= :threeHoursAgo',
        ExpressionAttributeNames: { '#timestamp': 'timestamp' },
        ExpressionAttributeValues: { 
            ':serverId': serverId,
            ':threeHoursAgo': threeHoursAgo
        },
        ScanIndexForward: false
    }));
    
    return {
        statusCode: 200,
        body: JSON.stringify(result.Items.reverse()),
        headers: { 'Content-Type': 'application/json' }
    };
}