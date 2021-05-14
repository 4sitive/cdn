'use strict';
const querystring = require('querystring');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const mime = require('mime-types');

exports.handler = async (event, context, callback) => {
    const {request, response} = event.Records[0].cf;
    const {uri} = request;
    const filename = decodeURIComponent(uri).substring(1);
    const params = querystring.parse(request.querystring);
    const {w, h, q, f} = params
    console.log(`filename: ${filename}, params: ${JSON.stringify(params)}`);

    let object, metadata, image, width, height, quality, format;

    try {
        object = await new AWS.S3({
                           signatureVersion: 'v4'
                       }).getObject({Bucket: process.env.AWS_S3_BUCKET, Key: filename}).promise();
        metadata = await sharp(object.Body).rotate().metadata();
    } catch (e) {
        return callback(null, response);
    }

    try {
        width = Math.min(Math.abs(parseInt(w, 10)) || metadata.width, metadata.width);
        height = Math.min(Math.abs(parseInt(h, 10)) || metadata.height, metadata.width);
        quality = Math.abs(parseInt(q, 10)) || 100;
        format = (format = (f && f.toLowerCase()) || metadata.format);
        do {
            console.log(`width: ${width}, height: ${height}, quality: ${quality}, format: ${format}`)
            image = await sharp(object.Body)
                .rotate()
                .resize(width, height)
                .toFormat(format, {quality})
                .toBuffer();
        } while (Buffer.byteLength(image, 'base64') >= 1048576 && (quality = quality - 10) > 0);
        response.status = 200;
        response.statusDescription = 'OK';
        response.body = image.toString('base64');
        response.headers['content-type'] = [{key: 'Content-Type', value: mime.lookup(format)}];
        response.bodyEncoding = 'base64';
        return callback(null, response);
    } catch (e) {
        console.log(e);
        return callback(null, response);
    }
};