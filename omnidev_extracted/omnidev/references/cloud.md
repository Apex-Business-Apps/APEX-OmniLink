# Cloud Architecture Reference

Copyright (c) 2025 APEX Business Systems Ltd. | https://apexbusiness-systems.com

## Service Mapping

| Need | AWS | GCP | Azure |
|------|-----|-----|-------|
| Compute | EC2, ECS, Lambda | GCE, GKE, Cloud Run | VMs, AKS, Functions |
| Database | RDS, Aurora, DynamoDB | Cloud SQL, Spanner, Firestore | SQL DB, Cosmos DB |
| Storage | S3, EFS | Cloud Storage, Filestore | Blob, Files |
| Queue | SQS, SNS | Pub/Sub, Cloud Tasks | Service Bus |
| CDN | CloudFront | Cloud CDN | Azure CDN |
| DNS | Route 53 | Cloud DNS | Azure DNS |
| Auth | Cognito | Identity Platform | Azure AD B2C |
| Secrets | Secrets Manager | Secret Manager | Key Vault |
| Monitoring | CloudWatch | Cloud Monitoring | Azure Monitor |
| Logs | CloudWatch Logs | Cloud Logging | Log Analytics |

---

## AWS Patterns

### VPC Design

```hcl
# Terraform
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
}
```

### ECS Fargate

```hcl
resource "aws_ecs_task_definition" "app" {
  family                   = "app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "${aws_ecr_repository.app.repository_url}:latest"
    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}
```

### Lambda

```python
import json
import boto3

def handler(event, context):
    # Parse event (API Gateway, S3, SQS, etc.)
    body = json.loads(event.get('body', '{}'))
    
    # Process
    result = process(body)
    
    # Return API Gateway format
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(result)
    }
```

---

## GCP Patterns

### Cloud Run

```yaml
# service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: app
spec:
  template:
    spec:
      containers:
      - image: gcr.io/project/app:latest
        resources:
          limits:
            memory: 512Mi
            cpu: "1"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
```

```bash
gcloud run deploy app \
  --image gcr.io/project/app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Cloud Functions

```python
import functions_framework
from flask import jsonify

@functions_framework.http
def handler(request):
    data = request.get_json(silent=True) or {}
    result = process(data)
    return jsonify(result), 200
```

---

## Infrastructure as Code

### Terraform Structure

```
infrastructure/
├── environments/
│   ├── prod/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── staging/
├── modules/
│   ├── vpc/
│   ├── ecs/
│   └── rds/
└── shared/
    └── backend.tf
```

### Terraform Best Practices

```hcl
# Always use remote state
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# Use data sources for existing resources
data "aws_vpc" "existing" {
  id = var.vpc_id
}

# Tag everything
locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}
```

---

## Cost Optimization

| Strategy | Savings |
|----------|---------|
| Reserved Instances (1yr) | 30-40% |
| Spot Instances | 60-90% |
| Right-sizing | 20-40% |
| Auto-scaling | Variable |
| S3 lifecycle policies | 50%+ |
| Delete unused resources | 100% |

---

## Security Checklist

| Area | AWS | GCP |
|------|-----|-----|
| IAM | Least privilege, no root | Service accounts, no owner |
| Encryption | KMS, S3 default encryption | CMEK, default encryption |
| Network | Security groups, NACLs | Firewall rules, VPC |
| Secrets | Secrets Manager | Secret Manager |
| Audit | CloudTrail | Cloud Audit Logs |
| Compliance | Config, Security Hub | Security Command Center |
