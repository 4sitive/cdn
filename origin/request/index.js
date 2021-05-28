'use strict'
const querystring = require('querystring')
const AWS = require('aws-sdk')
const md5 = require('md5')
const jwt = require('jsonwebtoken')
const {v4: uuidv4} = require('uuid')
const S3 = new AWS.S3()
const CloudFront = new AWS.CloudFront()

exports.handler = async (event, context, callback) => {
    const cf = event.Records[0].cf
    const {config, request, response} = cf
    const uri = decodeURIComponent(request.uri)
    const queries = querystring.parse(request.querystring)
    console.log('uri: %s, queries: %s, env: %O, cf: %O', uri, JSON.stringify(queries), process.env, cf)
    console.log(jwt.sign({sub: request.origin.s3.customHeaders['key'][0].value}, request.origin.s3.customHeaders['key'][0].value, {expiresIn: '1y'}))
    const token = request.headers.authorization && request.headers.authorization[0].value
    if (token && (request.method === 'PUT' || request.method === 'DELETE')) {
        const [tokenType, tokenValue] = token.split(' ')
        if (tokenType) {
            if (tokenType.toLowerCase().startsWith('bearer')) {
                try {
                    let prefix = tokenValue === request.origin.s3.customHeaders['key'][0].value ? '' : md5(jwt.verify(tokenValue, request.origin.s3.customHeaders['key'][0].value).sub) + '/'
                    try {
                        if (request.method === 'PUT') {
                            console.log(await S3.putObject({
                                Bucket: request.origin.s3.domainName.replace(/.s3.amazonaws.com$/g, ''),
                                Key: prefix + uri.substring(1).replace(/\+/g, ' '),
                                Body: Buffer.from(request.body.data, 'base64'),
                                ContentType: request.headers['content-type'][0].value
                            }).promise())
                            console.log(await CloudFront.createInvalidation({
                                DistributionId: config.distributionId,
                                InvalidationBatch: {
                                    CallerReference: config.requestId || uuidv4(),
                                    Paths: {
                                        Quantity: 2,
                                        Items: [
                                            uri.replace(/\+/g, ' '),
                                            uri.replace(/\+/g, ' ') + '?*',
                                        ]
                                    }
                                }
                            }).promise())
                            callback(null, {
                                status: '200',
                                statusDescription: 'OK',
                                headers: {
                                    'content-location': [{
                                        key: 'Content-Location',
                                        value: '/' + prefix + uri.substring(1).replace(/\+/g, ' ')
                                    }]
                                }
                            })
                        }
                        if (request.method === 'DELETE') {
                            if (uri.startsWith('/' + prefix)) {
                                console.log(await S3.deleteObject({
                                    Bucket: request.origin.s3.domainName.replace(/.s3.amazonaws.com$/g, ''),
                                    Key: uri.substring(1).replace(/\+/g, ' ')
                                }).promise())
                                console.log(await CloudFront.createInvalidation({
                                    DistributionId: config.distributionId,
                                    InvalidationBatch: {
                                        CallerReference: config.requestId || uuidv4(),
                                        Paths: {
                                            Quantity: 2,
                                            Items: [
                                                uri.replace(/\+/g, ' '),
                                                uri.replace(/\+/g, ' ') + '?*'
                                            ]
                                        }
                                    }
                                }).promise())
                            }
                        }
                        callback(null, {
                            status: '204',
                            statusDescription: 'No Content'
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
            } else {
                callback(null, {status: '401', statusDescription: 'Unauthorized'})
            }
        }
    }
    return callback(null, request)
}