import base64
import boto3
import io
import mimetypes
import os
import re
import urllib
import pprint
import json

from PIL import Image, ImageSequence, ImageOps

s3 = boto3.client("s3")

mimetypes.add_type("image/webp", ".webp")


def lambda_handler(event: dict, context) -> dict:
    cf: dict = event["Records"][0]["cf"]
    request: dict = cf["request"]
    response: dict = cf["response"]
    uri: str = request["uri"]

    if int(response["status"]) != 200 or request["method"] != "GET":
        return response

    queries = dict(urllib.parse.parse_qsl(request["querystring"]))
    print("uri: {}, queries: {}, cf: {}".format(uri, json.dumps(queries), pprint.pformat(cf, depth=2)))
    print(os.environ)

    try:
        object = s3.get_object(
            Bucket=re.sub(".s3.amazonaws.com$", "", request.get("origin").get("s3").get("domainName")),
            Key=urllib.parse.unquote_plus(uri[1:]))
    except Exception as e:
        print(e)
        return response

    if not object["ContentType"].startswith("image/"):
        return response

    try:
        image: Image = Image.open(object["Body"])
    except Exception as e:
        print(e)
        return response

    try:
        frames = [frame.copy() for frame in ImageSequence.Iterator(image)]
        format = "WEBP" if queries.get("f", image.format).upper() == "PNG" else queries.get("f", image.format).upper()
        quality = abs(int(queries.get("q", 100)))
        while True:
            with io.BytesIO() as output:
                for frame in frames:
                    width = round(abs(int(queries.get("w", frame.width))) * (quality / 100 if format == "GIF" else 1))
                    height = round(abs(int(queries.get("h", frame.height))) * (quality / 100 if format == "GIF" else 1))
                    frame.thumbnail((width, height), Image.ANTIALIAS)
                print("width: {}, height: {}, quality: {}, format: {}".format(width, height, quality, format))
                ImageOps.exif_transpose(frames[0]).convert("RGB").save(output,
                                                                       format=format,
                                                                       quality=quality,
                                                                       save_all=format == "GIF" and len(frames) > 1,
                                                                       optimize=True,
                                                                       append_images=frames[1:])
                if output.tell() >= 1048576 and quality > 0:
                    quality = quality - 10
                    continue
                if output.tell() < 1048576:
                    response["status"] = 200
                    response["statusDescription"] = "OK"
                    response["body"] = base64.standard_b64encode(output.getvalue()).decode()
                    response["bodyEncoding"] = "base64"
                    response["headers"]["content-type"] = [
                        {"key": "Content-Type", "value": mimetypes.guess_type(format + "." + format)[0]}
                    ]
                break
    except Exception as e:
        print(e)
        return response
    return response
