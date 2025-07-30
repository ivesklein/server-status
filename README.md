# Server Status Monitor

A serverless application that monitors server status using AWS Lambda, DynamoDB, S3, CloudFront, and SNS.

## Features

- **Automated Monitoring**: Pings servers every 5 minutes
- **Real-time Dashboard**: Shows current status of all servers
- **Admin Interface**: Add/remove servers and ping URLs
- **Alerts**: SNS notifications when servers go up/down
- **Serverless**: Fully managed AWS infrastructure

## Architecture

- **Lambda Functions**: 
  - `ping.js`: Monitors servers every 5 minutes
  - `api.js`: Handles CRUD operations and status queries
- **DynamoDB**: Stores server configurations and status history
- **S3 + CloudFront**: Hosts the web dashboard
- **SNS**: Sends email alerts for status changes

## Deployment

1. Install AWS SAM CLI and configure AWS credentials
2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```
3. Provide your email for SNS notifications when prompted
4. Access the dashboard via the CloudFront URL from outputs

## Usage

### Dashboard
- View real-time status of all monitored servers
- See response times and last check timestamps
- Auto-refreshes every 30 seconds

### Admin Panel
- Add new servers with name and URL
- Remove existing servers
- Changes take effect on next ping cycle (within 5 minutes)

## API Endpoints

- `GET /api/status` - Get current status of all servers
- `GET /api/servers` - List all configured servers
- `POST /api/servers` - Add a new server
- `DELETE /api/servers/{id}` - Remove a server

## Monitoring

- Servers are pinged every 5 minutes
- Status changes trigger SNS notifications
- All status data is stored in DynamoDB for history