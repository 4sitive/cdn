'use strict';
const querystring = require('querystring')
const AWS = require('aws-sdk')
const md5 = require('md5')
const jwt = require('jsonwebtoken')
const url = require('url')
const S3 = new AWS.S3({signatureVersion: 'v4'})

exports.handler = async (event, context, callback) => {
    const {request, response} = event.Records[0].cf
    const uri = decodeURIComponent(request.uri)
    const queries = querystring.parse(request.querystring)
    console.log(`uri: ${uri}, queries: ${JSON.stringify(queries)}, name: ${process.env.AWS_LAMBDA_FUNCTION_NAME}`)

    const token = request.headers.authorization && request.headers.authorization[0].value
    if (request.method === 'PUT' && token) {
        const [tokenType, tokenValue] = token.split(' ')
        if (tokenType) {
            let prefix
            if (tokenType.toLowerCase().startsWith('bearer')) {
                try {
                    const decoded = jwt.verify(tokenValue, process.env.KEY || request.origin.s3.customHeaders['key'][0].value)
                    if (decoded && decoded.sub) {
                        prefix = decoded.sub
                    } else {
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
                    if (!username || !password || username !== request.origin.s3.customHeaders['username'][0].value || password !== request.origin.s3.customHeaders['password'][0].value) {
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
                const result = await S3.upload({
                    Bucket: request.origin.s3.customHeaders['aws_s3_bucket'][0].value,
                    Key: (prefix ? (md5(prefix) + '/') : '') + uri.substring(1).replace(/\+/g, ' '),
                    Body: Buffer.from(request.body.data, 'base64'),
                    ContentType: request.headers['content-type'][0].value
                }).promise()
                callback(null, {
                    status: '200',
                    statusDescription: 'OK',
                    headers: {
                        'content-location': [{
                            key: 'Content-Location',
                            value: url.parse(result.Location).pathname.replace(new RegExp('^/' + result.Bucket, 'g'), '')
                        }]
                    }
                })
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