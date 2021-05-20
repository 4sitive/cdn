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
    console.log(`uri: ${uri}, queries: ${JSON.stringify(queries)}`)

    const token = request.headers.authorization && request.headers.authorization[0].value
    if (request.method === 'PUT' && token) {
        let prefix
        const [tokenType, tokenValue] = token.split(' ')
        if (tokenType){
            if(tokenType.toLowerCase().startsWith('bearer')){
                try {
                    const decoded = jwt.verify(tokenValue, process.env.KEY)
                    if(decoded && decoded.sub){
                        prefix = decoded.sub
                    }else{
                        callback(null, {status: '401', statusDescription: 'Unauthorized', headers: {'www-authenticate': [{key: 'WWW-Authenticate', value:'Bearer'}]}})
                    }
                } catch(e) {
                    callback(null, {status: '401', statusDescription: 'Unauthorized', headers: {'www-authenticate': [{key: 'WWW-Authenticate', value:'Bearer'}]}})
                }
            } else if (tokenType.toLowerCase().startsWith('basic')){
                try {
                    const [username, password] = Buffer.from(tokenValue, 'base64').toString('ascii').split(':')
                    if (!username || !password || username !== process.env.USERNAME || password !== process.env.PASSWORD) {
                        callback(null, {status: '401', statusDescription: 'Unauthorized', headers: {'www-authenticate': [{key: 'WWW-Authenticate', value:'Basic'}]}})
                    }
                 } catch(e) {
                    callback(null, {status: '401', statusDescription: 'Unauthorized', headers: {'www-authenticate': [{key: 'WWW-Authenticate', value:'Basic'}]}})
                }
            } else {
                callback(null, {status: '401', statusDescription: 'Unauthorized'})
            }
            try {
                const result = await S3.upload({Bucket: process.env.AWS_S3_BUCKET, Key: (prefix ? (md5(prefix) + '/') : '') + uri.substring(1).replace(/\+/g, ' '), Body: Buffer.from(request.body.data, 'base64'), ContentType: request.headers['content-type'][0].value}).promise()
                callback(null, {status: '200', statusDescription: 'OK', headers: {'content-location': [{key: 'Content-Location', value: result.Location.replace(new RegExp('^' + S3.endpoint.href + result.Bucket, 'g'),'')}]}})
            } catch (e) {
                callback(null, {status: '500', statusDescription: 'Internal Server Error'})
            }
        }
    }
    return callback(null, request)
};