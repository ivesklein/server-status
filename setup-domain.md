# Domain Setup for status.gamelab.cl

## Deployment

The deploy script automatically finds your existing `*.gamelab.cl` certificate:
```bash
./deploy.sh
```

## DNS Configuration

After deployment, add CNAME record to your DNS:
```
status.gamelab.cl CNAME d1234567890.cloudfront.net
```

The CloudFront domain will be in the deployment outputs.