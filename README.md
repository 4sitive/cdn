docker run --rm -v "$PWD":/var/task lambci/lambda:build-python3.8 pip3 install -r requirements.txt --upgrade --target .

cat event.json | docker run --env-file .env --rm -v "$PWD":/var/task:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:python3.8 lambda_function.lambda_handler


docker run --rm -v "$PWD":/var/task lambci/lambda:build-nodejs12.x npm install --only=prod

cat event.json | docker run --env-file .env --rm -v "$PWD":/var/task:ro,delegated -i -e DOCKER_LAMBDA_USE_STDIN=1 lambci/lambda:nodejs12.x index.handler