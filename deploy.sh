#!/bin/bash

# Build and deploy the serverless application
echo "Building SAM application..."
sam build

echo "Getting certificate ARN for *.example.com..."
CERT_ARN=$(aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?DomainName==`*.example.com`].CertificateArn' --output text)

if [ -z "$CERT_ARN" ]; then
  echo "Error: *.example.com certificate not found in us-east-1"
  exit 1
fi

echo "Found certificate: $CERT_ARN"
echo "Deploying application..."
sam deploy --stack-name statusApp --parameter-overrides CertificateArn=$CERT_ARN --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --resolve-s3 --confirm-changeset --region us-east-1

# Use the domain name as bucket name
BUCKET_NAME="status.example.com"

echo "Uploading website files to S3..."
aws s3 sync web/ s3://$BUCKET_NAME/

echo "Deployment complete!"
echo "Check CloudFormation outputs for URLs"