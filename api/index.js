'use strict'
const AWS = require('aws-sdk')
const util = require('util')
const {v4: uuidv4} = require('uuid')
const S3 = new AWS.S3()
const CloudFront = new AWS.CloudFront()

exports.handler = async (event) => {
    const proxy = decodeURIComponent(event.pathParameters.proxy).replace(/\+/g, ' ')
    const prefix = event.requestContext.authorizer.lambda.prefix
    const key = event.requestContext.http.method === 'DELETE' ? proxy : prefix + proxy;
    console.log(JSON.stringify(event, function (key, value) {
        return key === 'body' ? undefined : value
    }))
    console.log(util.inspect(process.env, {breakLength: Infinity}))
    let response = {
        'statusCode': 404,
        'headers': {'Content-Type': 'application/json'},
        'body': '{}'
    }

    try {
        const object = await S3.headObject({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key
        }).promise().catch(err => {
            if (err.statusCode !== 404 && err.code !== 'NotFound') throw err
        })
        switch (event.requestContext.http.method) {
            case 'PUT':
                console.log(await S3.getSignedUrl('putObject', {Bucket: process.env.AWS_S3_BUCKET, Key: key})) //'curl --request PUT --upload-file ./text.txt "' + SignedUrl + '"'
                console.log(await S3.putObject({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: key,
                    Body: Buffer.from(event.body, 'base64'),
                    ContentType: event.headers['content-type']
                }).promise())
                response.statusCode = object ? 200 : 201
                response.headers['Content-Location'] = '/' + key
                break;
            case 'DELETE':
                console.log(await S3.deleteObject({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: key
                }).promise())
                response.statusCode = 204
                break;
            default:
        }
        if ((response.statusCode / 100 === 2) && object) {
            console.log(await CloudFront.createInvalidation({
                DistributionId: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
                InvalidationBatch: {
                    CallerReference: event.requestContext.requestId || uuidv4(),
                    Paths: {
                        Quantity: 2,
                        Items: ['/' + key, '/' + key + '?*']
                    }
                }
            }).promise())
        }
    } catch (e) {
        console.log(e)
        response.statusCode = 500
        response.body = JSON.stringify({'message': e.message})
    }
    return response;
}