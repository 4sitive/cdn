'use strict';
const querystring = require('querystring')
const AWS = require('aws-sdk')
const sharp = require('sharp')
const mime = require('mime-types')

exports.handler = async (event, context, callback) => {
    const {request, response} = event.Records[0].cf
    const filename = decodeURIComponent(request.uri).substring(1)
    const queries = querystring.parse(request.querystring)
    console.log(`filename: ${filename}, queries: ${JSON.stringify(queries)}`)

    if (response.status !== 200) {
        return callback(null, response)
    }

    let object, metadata, image, width, height, quality, format

    try {
        object = await new AWS.S3({
                           signatureVersion: 'v4'
                       }).getObject({Bucket: process.env.AWS_S3_BUCKET, Key: filename}).promise()
        if (!object.ContentType.startsWith('image/')) {
            return callback(null, response)
        }
        metadata = await sharp(object.Body).rotate().metadata()
    } catch (e) {
        return callback(null, response)
    }

    try {
        width = Math.min(Math.abs(parseInt(queries.w, 10)) || metadata.width, metadata.width)
        height = Math.min(Math.abs(parseInt(queries.h, 10)) || metadata.height, metadata.width)
        quality = Math.abs(parseInt(queries.q, 10)) || 100
        format = (format = (queries.f && queries.f.toLowerCase()) || metadata.format)
        do {
            console.log(`width: ${width}, height: ${height}, quality: ${quality}, format: ${format}`)
            image = await sharp(object.Body)
                .rotate()
                .resize(width, height)
                .toFormat(format, {quality})
                .toBuffer()
        } while (Buffer.byteLength(image, 'base64') >= 1048576 && (quality = quality - 10) > 0)
        if (Buffer.byteLength(image, 'base64') < 1048576) {
            response.status = 200
            response.statusDescription = 'OK'
            response.body = image.toString('base64')
            response.headers['content-type'] = [{key: 'Content-Type', value: mime.lookup(format)}]
            response.bodyEncoding = 'base64'
        }
    } catch (e) {
        console.log(e)
        return callback(null, response)
    }
    return callback(null, response)
};