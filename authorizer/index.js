'use strict'
const util = require('util')
const md5 = require('md5')
const jwt = require('jsonwebtoken')

exports.handler = async (event) => {
    console.log(JSON.stringify(event))
    console.log(util.inspect(process.env, {breakLength: Infinity}))
    console.log(jwt.sign({sub: process.env.KEY}, process.env.KEY, {expiresIn: '1y'}))
    let response = {
        'isAuthorized': false,
        'context': {}
    }
    try {
        const [tokenType, tokenValue] = event.identitySource[0].split(' ')
        if (tokenType.toLowerCase().startsWith('bearer')) {
            let prefix = tokenValue === process.env.KEY ? '' : md5(jwt.verify(tokenValue, process.env.KEY).sub) + '/'
            response.isAuthorized = event.requestContext.http.method === 'DELETE' ? event.pathParameters.proxy.startsWith(prefix) : true
            response.context['prefix'] = prefix
        }
    } catch (e) {
        console.log(e)
        response.context['error'] = e.message
    }
    return response
}