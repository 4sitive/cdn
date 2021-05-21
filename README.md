###
1. cdn.4sitive.com - Origin request
```
docker run --rm -v "$PWD":/var/task lambci/lambda:build-python3.8 pip3 install -r requirements.txt --upgrade --target .
cat cdn.4sitive.com-origin_request.json | docker run --env-file .env --rm -v "$PWD":/var/task:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:python3.8 lambda_function.lambda_handler
```
2. cdn.4sitive.com - Origin response
```
docker run --rm -v "$PWD":/var/task lambci/lambda:build-nodejs12.x npm install --only=prod
cat cdn.4sitive.com-origin_response.json | docker run --env-file .env --rm -v "$PWD":/var/task:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x lambda.handler
```
3.
```
docker run --rm -it -v "$PWD":/var/task lambci/lambda:build-python3.8 bash
docker run --rm -it -v "$PWD":/var/task lambci/lambda:build-nodejs12.x bash
```

### Amazon S3
1. cdn.4sitive.com

### CloudFront
1. Origin Domain Name - cdn.4sitive.com.s3.amazonaws.com
2. Origin ID - S3-cdn.4sitive.com
3. Origin Custom Headers - 
3. Allowed HTTP Methods - GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
4. Cache Policy - Create a new policy (CachingOptimizedForQuery - Query strings[ALL])
5. Alternate Domain Names(CNAMEs) - cdn.4sitive.com
6. SSL Certificate - Custom SSL Certificate (Request or Import a Certificate with ACM)


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
```

### AWS Lambda
1. Functions - Create function (Change default execution role - Use an existing role)
2. Functions - Function overview - Configuration - Environment variables (AWS_S3_BUCKET, KEY)
3. Actions - Deploy to Lambda@Edge