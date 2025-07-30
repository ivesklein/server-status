#!/bin/bash

# Build and deploy the serverless application
echo "Building SAM application..."
sam build

echo "Getting certificate ARN for *.gamelab.cl..."
CERT_ARN=$(aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?DomainName==`*.gamelab.cl`].CertificateArn' --output text)

if [ -z "$CERT_ARN" ]; then
  echo "Error: *.gamelab.cl certificate not found in us-east-1"
  exit 1
fi

echo "Found certificate: $CERT_ARN"
echo "Deploying application..."
sam deploy --stack-name statusApp --parameter-overrides CertificateArn=$CERT_ARN --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --resolve-s3 --confirm-changeset --region us-east-1

# Use the domain name as bucket name
BUCKET_NAME="status.gamelab.cl"

echo "Uploading website files to S3..."
aws s3 sync web/ s3://$BUCKET_NAME/

echo "Deployment complete!"
echo "Check CloudFormation outputs for URLs"