import base64
import boto3
import io
import mimetypes
import os
import urllib

from PIL import Image, ImageSequence, ImageOps

s3 = boto3.client("s3")

mimetypes.add_type("image/webp", ".webp")


def lambda_handler(event: dict, context) -> dict:
    record: dict = event["Records"][0]["cf"]
    request: dict = record["request"]
    response: dict = record["response"]
    uri: str = request["uri"]

    if int(response["status"]) != 200 or request["method"] != "GET":
        return response

    queries = dict(urllib.parse.parse_qsl(request["querystring"]))
    print("uri: {}, queries: {}, name: {}".format(uri, queries, os.environ["AWS_LAMBDA_FUNCTION_NAME"]))

    try:
        object = s3.get_object(Bucket=request.get("origin").get("s3").get("customHeaders")["aws_s3_bucket"][0]["value"],
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

    frames = [frame.copy() for frame in ImageSequence.Iterator(image)]
    format = "WEBP" if queries.get("f", image.format).upper() == "PNG" else queries.get("f", image.format).upper()
    quality = abs(int(queries.get("q", 100)))

    try:
        while quality > 0:
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
                                                                       subsampling=0,
                                                                       optimize=True,
                                                                       append_images=frames[1:])
                if output.tell() >= 1048576 and quality > 0:
                    quality = quality - 10
                    continue
                else:
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
