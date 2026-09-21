import boto3
import json
import hashlib
import os
import re
from boto3.dynamodb.conditions import Attr, ConditionBase
from functools import reduce
from typing import Generator

# 注　ジェネレータなので使い切り
def get_records(table, **kwargs) -> Generator[dict, None, None]:
    while True:
        response = table.scan(**kwargs)
        for item in response["Items"]:
            yield item
        if "LastEvaluatedKey" not in response:
            break
        kwargs.update(ExclusiveStartKey=response["LastEvaluatedKey"])


# 話数順に並べるためのキー
def episode_sort_key(record: dict) -> tuple[int, int]:
    matched = re.search(r"\d+", record["number"])
    return (int(matched.group()) if matched else 0, int(record["line"]))


def lambda_handler(event, context):
    TABLE_NAME: str = os.environ.get("TABLE_NAME")
    BUCKET_NAME: str = os.environ.get("BUCKET_NAME")

    query_params: dict = event.get("queryStringParameters", {})
    words_string: str = query_params.get("words", "")
    work_id: int = int(query_params.get("work_id", 0))
    request: str = query_params.get("request", "")

    if request:
        # 要望ならログはいて終わり
        print(f"Request: {request}")
        return {"statusCode": 200, "body": "OK"}
    if not words_string:
        return {"statusCode": 400, "body": "words is required"}
    if not work_id:
        return {"statusCode": 400, "body": "work_id is required"}

    # log query
    print(f"Query: {words_string}")

    # get words from the query
    words: list[str] = query_params["words"].split(",")

    # mapでAttr.eq条件を作成
    conditions: iter[ConditionBase] = map(lambda v: Attr("body").contains(v), words)

    # reduceで全条件をANDで結合
    combined_condition: ConditionBase = reduce(lambda acc, cond: acc & cond, conditions) & Attr("work_id").eq(work_id)

    dynamodb = boto3.resource("dynamodb")
    records: Generator[dict, None, None] = get_records(
        dynamodb.Table(TABLE_NAME), FilterExpression=combined_condition
    )

    # episode_id は使わない。取得元の採番方式が途中で変わり、
    # 新しい話のIDが古い話より小さくなる（桁数も不揃い）ため投稿順と一致しない。
    sorted_records: list[dict] = sorted(records, key=episode_sort_key)

    # 作品ID、話数IDがjsのnumberで扱いきれないのでDBのNumberは全部文字列にしてしまう
    json_string = json.dumps(sorted_records, default=lambda obj: str(obj))

    binary_size = len(json_string.encode("utf-8"))
    print(f"Binary size: {binary_size} bytes")

    # save json cache to S3 (50MB超えてるなら様子がおかしいので保存しない)
    if binary_size < 50 * 1024 * 1024:
        hash_object = hashlib.sha256()
        hash_object.update(words_string.encode('utf-8'))
        words_hash: str = hash_object.hexdigest()
        s3 = boto3.client("s3")
        s3.put_object(Bucket=BUCKET_NAME, Key=f"cache/{work_id}/{words_hash}.json", Body=json_string)
    else:
        print("Too large response. Not save to S3")

    # 6MBを超えるならエラー
    if binary_size > 6 * 1024 * 1024 - 100:
        return {"statusCode": 503, "body": "Too large response"}

    return {"statusCode": 200, "body": json_string}


if __name__ == "__main__":
    lambda_handler({"words": "ブロッコリー"}, None)
