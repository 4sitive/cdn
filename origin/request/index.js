'use strict';
const querystring = require('querystring')
const AWS = require('aws-sdk')
const md5 = require('md5')
const jwt = require('jsonwebtoken')
const S3 = new AWS.S3({signatureVersion: 'v4'})

exports.handler = async (event, context, callback) => {
    const {request, response} = event.Records[0].cf
    const uri = decodeURIComponent(request.uri)
    const queries = querystring.parse(request.querystring)
    console.log(`uri: ${uri}, queries: ${JSON.stringify(queries)}, name: ${process.env.AWS_LAMBDA_FUNCTION_NAME}`)

    const token = request.headers.authorization && request.headers.authorization[0].value
    if (token && (request.method === 'PUT' || request.method === 'DELETE')) {
        const [tokenType, tokenValue] = token.split(' ')
        if (tokenType) {
            let sub
            if (tokenType.toLowerCase().startsWith('bearer')) {
                try {
                    sub = jwt.verify(tokenValue, process.env.KEY || request.origin.s3.customHeaders['key'][0].value).sub
                    if (!sub) {
                        throw new Error('');
                    }
                } catch (e) {
                    callback(null, {
                        body: JSON.stringify({'error': e.message}),
                        status: '401',
                        statusDescription: 'Unauthorized',
                        headers: {
                            'www-authenticate': [{key: 'WWW-Authenticate', value: 'Bearer'}],
                            'content-type': [{key: 'Content-Type', value: 'application/json'}],
                            'content-encoding': [{key: 'Content-Encoding', value: 'UTF-8'}]
                        }
                    })
                }
            } else if (tokenType.toLowerCase().startsWith('basic')) {
                try {
                    const [username, password] = Buffer.from(tokenValue, 'base64').toString('ascii').split(':')
                    if (!username || !password || username !== (process.env.USERNAME || request.origin.s3.customHeaders['username'][0].value) || password !== (process.env.PASSWORD || request.origin.s3.customHeaders['password'][0].value)) {
                        throw new Error('');
                    }
                } catch (e) {
                    callback(null, {
                        body: JSON.stringify({'error': e.message}),
                        status: '401',
                        statusDescription: 'Unauthorized',
                        headers: {
                            'www-authenticate': [{key: 'WWW-Authenticate', value: 'Basic'}],
                            'content-type': [{key: 'Content-Type', value: 'application/json'}],
                            'content-encoding': [{key: 'Content-Encoding', value: 'UTF-8'}]
                        }
                    })
                }
            } else {
                callback(null, {status: '401', statusDescription: 'Unauthorized'})
            }
            try {
                if (request.method === 'PUT') {
                    sub = sub && (md5(sub) + '/') || ''
                    await S3.putObject({
                        Bucket: request.origin.s3.customHeaders['aws_s3_bucket'][0].value,
                        Key: sub + uri.substring(1).replace(/\+/g, ' '),
                        Body: Buffer.from(request.body.data, 'base64'),
                        ContentType: request.headers['content-type'][0].value
                    }).promise()
                    callback(null, {
                        status: '200',
                        statusDescription: 'OK',
                        headers: {
                            'content-location': [{
                                key: 'Content-Location',
                                value: '/' + sub + uri.substring(1).replace(/\+/g, ' ')
                            }]
                        }
                    })
                }
                if (request.method === 'DELETE') {
                    if (!sub || (sub && uri.startsWith('/' + md5(sub)))) {
                        await S3.deleteObject({
                            Bucket: request.origin.s3.customHeaders['aws_s3_bucket'][0].value,
                            Key: uri.substring(1).replace(/\+/g, ' ')
                        }).promise()
                    }
                    callback(null, {
                        status: '204',
                        statusDescription: 'No Content'
                    })
                }
            } catch (e) {
                callback(null, {
                    body: JSON.stringify({'error': e.message}),
                    status: '500',
                    statusDescription: 'Internal Server Error',
                    headers: {
                        'content-type': [{key: 'Content-Type', value: 'application/json'}],
                        'content-encoding': [{key: 'Content-Encoding', value: 'UTF-8'}]
                    }
                })
            }
        }
    }
    return callback(null, request)
};