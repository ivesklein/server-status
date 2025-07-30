# Domain Setup for status.example.com

## Deployment

The deploy script automatically finds your existing `*.example.cl` certificate:
```bash
./deploy.sh
```

## DNS Configuration

After deployment, add CNAME record to your DNS:
```
status.example.com CNAME d1234567890.cloudfront.net
```

The CloudFront domain will be in the deployment outputs.