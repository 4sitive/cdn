###
1. Origin request
```
docker run --rm -v "$PWD":/var/task lambci/lambda:build-nodejs12.x npm install md5 jsonwebtoken uuid --prefix ./opt/nodejs
cat origin/request/event_put.json | docker run --env-file .env --rm -v "$PWD/origin/request":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
cat origin/request/event_delete.json | docker run --env-file .env --rm -v "$PWD/origin/request":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
cat origin/request/event_put_prefix.json | docker run --env-file .env --rm -v "$PWD/origin/request":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
cat origin/request/event_delete_prefix.json | docker run --env-file .env --rm -v "$PWD/origin/request":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
```
2. Origin response
```
docker run --rm -v "$PWD":/var/task lambci/lambda:build-python3.8 pip install Pillow prettyprinter --upgrade --target ./opt/python
cat origin/response/event.json | docker run --env-file .env --rm -v "$PWD/origin/response":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:python3.8 lambda_function.lambda_handler
```
3. API
```
cat api/event.json | docker run --env-file .env --rm -v "$PWD/api":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
```
3. API Authorizer
```
docker run --rm -v "$PWD":/var/task lambci/lambda:build-python3.8 pip install Pillow prettyprinter --upgrade --target ./opt/python
cat api/authorizer/event_put.json | docker run --env-file .env --rm -v "$PWD/api/authorizer":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
cat api/authorizer/event_put_prefix.json | docker run --env-file .env --rm -v "$PWD/api/authorizer":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
cat api/authorizer/event_delete.json | docker run --env-file .env --rm -v "$PWD/api/authorizer":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
cat api/authorizer/event_delete_prefix.json | docker run --env-file .env --rm -v "$PWD/api/authorizer":/var/task:ro,delegated -v "$PWD/opt":/opt:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler
```
3.
```
docker run --rm -it -v "$PWD":/var/task lambci/lambda:build-python3.8 bash
docker run --rm -it -v "$PWD":/var/task lambci/lambda:build-nodejs12.x bash
```

### Amazon S3
1. cdn.4sitive.com
2. Bucket Versioning - Enable

### API Gateway
1. HTTP API
2. Routes - ANY /api/{proxy+}
3. Authorization - Lambda Auth
4. Integrations - AWS Lambda

### CloudFront
1. Origin Domain Name - cdn.4sitive.com.s3.amazonaws.com, {id}.execute-api.us-east-1.amazonaws.com
2. Origin ID - S3-cdn.4sitive.com
3. Origin Custom Headers - KEY
3. Allowed HTTP Methods - GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
4. Cache Policy - Create a new policy (CachingOptimizedForQuery - Query strings[ALL])
5. Alternate Domain Names(CNAMEs) - cdn.4sitive.com
6. SSL Certificate - Custom SSL Certificate (Request or Import a Certificate with ACM)
7. Behaviors - /api/*

### Identity and Access Management(IAM)
1. Access management - Policies - Create policy
```
aws iam create-policy --policy-name AmazonS3ReadWriteAccess --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:*Object",
                "s3:List*"
            ],
            "Resource": "*"
        }
    ]
}'
```
2. Access management - Roles - Create role
```
aws iam create-role --role-name ServiceRoleForLambda --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": [
          "lambda.amazonaws.com",
          "edgelambda.amazonaws.com"
        ]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}'
```
```
aws iam attach-role-policy --role-name ServiceRoleForLambda --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name ServiceRoleForLambda --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-role-policy --role-name ServiceRoleForLambda --policy-arn arn:aws:iam::aws:policy/CloudFrontFullAccess
```

### AWS Lambda
1. Functions - Create function (Change default execution role - Use an existing role)
2. Functions - Layers - Add a layer - Custom layers
3. Functions - Actions - Publish new version
4. Functions - Actions - Deploy to Lambda@Edge
