docker run --rm -v "$PWD":/var/task lambci/lambda:build-python3.8 pip3 install -r requirements.txt --upgrade --target .

cat event.json | docker run --env-file .env --rm -v "$PWD":/var/task:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:python3.8 lambda_function.lambda_handler


docker run --rm -v "$PWD":/var/task lambci/lambda:build-nodejs12.x npm install --only=prod

cat event.json | docker run --env-file .env --rm -v "$PWD":/var/task:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x lambda.handler

[comment]: <> (cdn_4sitive_com-origin_response)
###
```console
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

aws iam create-role --role-name lambda-ex --assume-role-policy-document '{"Version": "2012-10-17","Statement": [{ "Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]}'
$ aws iam attach-role-policy --role-name lambda-ex --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

```AmazonS3ReadWriteAccess
{
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
}
```