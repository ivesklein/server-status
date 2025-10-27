# Server Status Monitor

A serverless application that monitors server status using AWS Lambda, DynamoDB, S3, CloudFront, and SNS.

## Features

- **Automated Monitoring**: Pings servers every 5 minutes
- **Real-time Dashboard**: Shows current status of all servers
- **SLI Calculation**: Daily Service Level Indicator calculation with color-coded display
- **Data Export**: Download month of monitoring data as CSV
- **Interactive Charts**: 3-hour response time and activity charts with hover details
- **Admin Interface**: Add/remove servers and ping URLs
- **Alerts**: SNS notifications when servers go up/down
- **Serverless**: Fully managed AWS infrastructure

## Architecture

- **Lambda Functions**: 
  - `ping.js`: Monitors servers every 5 minutes
  - `api.js`: Handles CRUD operations and status queries
  - `sli.js`: Calculates daily SLI metrics for each server
- **DynamoDB Tables**: 
  - `status-app-servers`: Server configurations
  - `status-app-server-status`: Status history and metrics
  - `status_server_sli`: Service Level Indicator calculations
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
- **SLI Display**: Color-coded availability percentages (30-day)
- **Interactive Charts**: Hover for detailed metrics
- **Data Export**: Download CSV button for historical data
- Auto-refreshes every 30 seconds

### Admin Panel
- Add new servers with name and URL
- Remove existing servers
- Changes take effect on next ping cycle (within 5 minutes)

## API Endpoints

- `GET /api/status` - Get current status of all servers (includes SLI data when authenticated)
- `GET /api/servers` - List all configured servers
- `POST /api/servers` - Add a new server
- `DELETE /api/servers/{id}` - Remove a server
- `GET /api/history/{id}` - Get 3-hour history for charts
- `GET /api/download/{id}` - Download 30-day CSV data (authenticated)
- `POST /api/login` - Admin authentication

## Monitoring

- **Ping Frequency**: Every 5 minutes
- **SLI Calculation**: Daily at midnight
- **Missing Data Handling**: Gaps treated as downtime in SLI
- **Alerts**: SNS notifications on status changes
- **Data Retention**: All status data stored in DynamoDB
- **SLI Metrics**: 30-day availability percentage with expected vs actual checks

## Manual Deployment

To deploy code changes manually:

### Update Lambda Function
```bash
cd src
zip -r ../api-function-updated.zip .
cd ..
aws lambda update-function-code --function-name status-app-server-api --zip-file fileb://api-function-updated.zip --region us-east-1
```

### Update Frontend
```bash
aws s3 cp web/ s3://status.example.cl/ --region us-east-1 --recursive
```

```bash
aws cloudfront create-invalidation --distribution-id ID --paths "/*"
```

### Set Environment Variables
```bash
aws lambda update-function-configuration --function-name status-app-server-api --environment Variables='{SERVERS_TABLE=status-app-servers,STATUS_TABLE=status-app-server-status,SLI_TABLE=status_server_sli,JWT_SECRET=your-jwt-secret,ADMIN_PASSWORD=your-admin-password}' --region us-east-1

aws lambda update-function-configuration --function-name status-app-server-sli --environment Variables='{SERVERS_TABLE=status-app-servers,STATUS_TABLE=status-app-server-status,SLI_TABLE=status_server_sli}' --region us-east-1
```


# Issues:

403 Forbidden Error from cloudfront <Error> <Code>AccessDenied</Code> <Message>Access Denied</Message> </Error>
- Legacy cache settings
 Solution: Cache policy and origin request policy - All something

{"message":"Missing Authentication Token"}
- Cloudfront Path Pattern is only a filter, the path is passed unmodified so apigateway receiver the api part too
 Solution: modify the apigateway adding the api resourse at root