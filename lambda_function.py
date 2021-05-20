from PIL import Image, ImageSequence, ImageOps
import boto3
import urllib
import mimetypes
import base64
import io
import os

def lambda_handler(event: dict, context) -> dict:
    record: dict = event["Records"][0]["cf"]
    request: dict = record["request"]
    response: dict = record["response"]
    uri: str = request["uri"]

    if int(response["status"]) != 200:
        return response

    queries = dict(urllib.parse.parse_qsl(request["querystring"]))
    print("uri: {}, queries: {}".format(uri, queries))

    try:
        object = boto3.client("s3").get_object(Bucket=os.environ["AWS_S3_BUCKET"], Key=urllib.parse.unquote(uri[1:]))
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
    format = queries.get("f", image.format).upper()
    quality = abs(int(queries.get("q", 100)))

    while quality > 0:
        with io.BytesIO() as output:
            for frame in frames:
                width = round(abs(int(queries.get("w", frame.width))) * (quality / 100 if format == "GIF" else 1))
                height = round(abs(int(queries.get("h", frame.height))) * (quality / 100 if format == "GIF" else 1))
                frame.thumbnail((width, height), Image.ANTIALIAS)
            print("width: {}, height: {}, quality: {}, format: {}".format(width, height, quality, format))
            ImageOps.exif_transpose(frames[0]).convert("RGBA").save(output, format=format, compress_level=round(100 % quality / 10) + 1, quality=quality, save_all=format == "GIF" and len(frames) > 1, subsampling=0, optimize=True, append_images=frames[1:])
            print(output.tell())
            if output.tell() >= 1048576 and quality > 0:
                quality = quality - 10
                continue
            else:
                if output.tell() < 1048576:
                    response["status"] = 200
                    response["statusDescription"] = "OK"
                    response["body"] = base64.standard_b64encode(output.getvalue()).decode()
                    response["bodyEncoding"] = "base64"
                    response["headers"]["content-type"] = [{"key": "Content-Type", "value": mimetypes.guess_type(format+"."+format)[0]}]
            break
    return response