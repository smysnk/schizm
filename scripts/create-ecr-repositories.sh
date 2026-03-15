#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY="${ECR_REPOSITORY:-schizm}"
LIFECYCLE_POLICY='{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Expire untagged images after 14 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 14
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}'

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required" >&2
  exit 1
fi

if aws ecr describe-repositories \
  --repository-names "$ECR_REPOSITORY" \
  --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "ECR repository already exists: $ECR_REPOSITORY"
else
  echo "Creating ECR repository: $ECR_REPOSITORY"
  aws ecr create-repository \
    --repository-name "$ECR_REPOSITORY" \
    --image-scanning-configuration scanOnPush=true \
    --image-tag-mutability MUTABLE \
    --region "$AWS_REGION" >/dev/null
fi

aws ecr put-lifecycle-policy \
  --repository-name "$ECR_REPOSITORY" \
  --lifecycle-policy-text "$LIFECYCLE_POLICY" \
  --region "$AWS_REGION" >/dev/null

repository_uri="$(
  aws ecr describe-repositories \
    --repository-names "$ECR_REPOSITORY" \
    --region "$AWS_REGION" \
    --query 'repositories[0].repositoryUri' \
    --output text
)"

echo "Repository ready: $repository_uri"
