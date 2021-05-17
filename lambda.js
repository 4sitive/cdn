'use strict';
const querystring = require('querystring')
const AWS = require('aws-sdk')
const sharp = require('sharp')
const mime = require('mime-types')
const auth = require('basic-auth')
const md5 = require('md5');

const users = [{ username: 'username', password: 'password' }];

exports.handler = async (event, context, callback) => {
    const {request, response} = event.Records[0].cf
    const uri = decodeURIComponent(request.uri)
    const queries = querystring.parse(request.querystring)
    console.log(`uri: ${uri}, queries: ${JSON.stringify(queries)}`)
    const s3 = event.Records[0].s3
    if(s3) {
        console.log(`bucket: ${s3.bucket.name}, object.key: ${s3.object.key.replace(/\+/g, ' ')}`)
    }
//    Content-Location
    if (request.method === 'PUT' && request.headers.authorization) {
        let username
        if (request.headers.authorization[0].value.startsWith('Basic ')){
            let credentials = auth.parse(request.headers.authorization[0].value)
            console.log(credentials)
            username = users.filter(user => user.username === credentials.name && user.password === credentials.pass).map(user => user.username).find(user => true)
            console.log(username);
            console.log(username);
            if(!username){
                callback(null, {status: '401', statusDescription: 'Unauthorized', headers: {'www-authenticate': [{key: 'WWW-Authenticate', value:'Basic'}]}})
            }
        }else{
            callback(null, {status: '401', statusDescription: 'Unauthorized'})
        }

        let key = md5(username) + '/' + uri.substring(1);

        try {
            const result = await new AWS.S3({signatureVersion: 'v4'})
            .upload({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: key,
                Body: Buffer.from(request.body.data, 'base64'),
                ContentType: request.headers['content-type'][0].value
            }).promise();
            console.log(result)
            callback(null, {status: '200', statusDescription: 'OK', headers: {'content-location': [{key: 'Content-Location', value:'/'+key}]}})
        } catch (e) {
        console.log(e)
        }
    }
    return callback(null, request)
};