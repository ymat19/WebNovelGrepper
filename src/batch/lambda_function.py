import requests
import os
import time
import boto3
import re
from bs4 import BeautifulSoup, Tag
from functools import reduce
from dataclasses import dataclass
from dotenv import load_dotenv


# 定数類
load_dotenv()
WORK_URLS: list[str] = os.environ.get("WORK_URLS", "").split(",")
DFAULT_TARGET_RATE: int = 5
TABLE_NAME: str = os.environ.get("TABLE_NAME")
BUCKET_NAME: str = os.environ.get("BUCKET_NAME")


# 作品のサイドバーから得られる情報
@dataclass(frozen=True)
class Episode:
    # 作品ID
    work_id: int
    # 章タイトル
    sub_title: str
    # 話タイトル(話数ではない作品もあるが、簡単のため話数扱い)
    number: str
    # 話数の一意な値（URLの後ろ）
    episode_id: int


# 作品の本文(行ごと)
@dataclass(frozen=True)
class Line:
    number: int
    body: str


# 実際に永続化されるレコード
@dataclass(frozen=True)
class Record:
    episode: Episode
    line: Line


# URLからHTMLを取得し、root要素を取り出す
def get_root_element(url: str) -> Tag:
    response = requests.get(url)
    response.raise_for_status()
    return BeautifulSoup(response.content, "html.parser")


# サイドバーのli要素を全て取り出す
def get_all_li_elements(root_element: Tag) -> list[Tag]:
    return root_element.find("ol", class_="widget-toc-items").find_all("li")


# サイドバーのli要素群からエピソードリストを生成する畳み込み関数
def get_episodes(
    acc: tuple[str, list[Episode]], li_element
) -> tuple[str, list[Episode]]:
    sub_title, episodes = acc
    if "widget-toc-chapter" in (li_element.get("class") or []):
        return (li_element.find("span").get_text(), episodes)
    else:
        number = li_element.find("span").get_text()
        # 話数IDと作品IDをURLから取得
        work_id = int(li_element.find("a").get("href").split("/")[-3])
        episode_id = int(li_element.find("a").get("href").split("/")[-1])
        return (
            sub_title,
            [*episodes, Episode(work_id, sub_title, number, episode_id)],
        )


# 本文を１行づつ取り出す
def get_body_lines(root_element: Tag) -> list[Line]:
    episode_body = root_element.find(class_="widget-episodeBody")

    def get_number(p: Tag) -> str:
        return re.search(r"\d+", p.get("id")).group()

    line_elms = filter(
        lambda p: p.get("id") and get_number(p), episode_body.find_all("p")
    )
    return map(lambda line: Line(int(get_number(line)), line.get_text()), line_elms)


# DynamoDBにレコードを追加する
def put_records_to_dynamodb(records: list[Record]):
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(TABLE_NAME)
    with table.batch_writer() as batch:
        for record in records:
            # display progress
            print(f"Putting {record.episode.number} l:{record.line.number}")
            batch.put_item(
                Item={
                    "work_id": record.episode.work_id,
                    "sub_title": record.episode.sub_title,
                    "number": record.episode.number,
                    "episode_id": record.episode.episode_id,
                    "line": record.line.number,
                    "body": record.line.body,
                }
            )


# 処理実体
def lambda_handler(event, context):
    # 最新何%ぐらいを処理するか
    target_rate: int = (
        event.get("target_rate", DFAULT_TARGET_RATE) if event else DFAULT_TARGET_RATE
    )

    for url in WORK_URLS:
        side_bar_url: str = url + "/episode_sidebar"

        # episodeリストの取得
        side_bar_root_element: Tag = get_root_element(side_bar_url)
        li_elements: list[Tag] = get_all_li_elements(side_bar_root_element)
        _, episodes = reduce(
            get_episodes, li_elements, ("", [])
        )  # 分割代入と型ヒントは両立できないらしい

        # 処理対象のエピソード数
        start_episode_num: int = len(episodes) * (100 - target_rate) // 100

        # レコード群を生成する畳み込み関数
        url_prefix = url.split("/episodes/")[0] + "/episodes/"

        def get_records(acc: list[Record], episode: Episode) -> list[Record]:
            # ちょっと待つ
            time.sleep(0.5)
            # display progress
            print(f"Processing {episode.number}")
            # linesを取得し、episode左結合 累積リストに追加　(空行は無視)
            lines = get_body_lines(
                get_root_element(url_prefix + str(episode.episode_id))
            )
            valid_lines = filter(lambda line: line.body.strip(), lines)
            return [*acc, *map(lambda line: Record(episode, line), valid_lines)]

        # recordリストの取得
        records: list[Record] = reduce(get_records, episodes[start_episode_num:], [])

        # DynamoDBに永続化
        put_records_to_dynamodb(records)

    # remove cache from S3
    s3 = boto3.resource("s3")
    bucket = s3.Bucket(BUCKET_NAME)
    for obj in bucket.objects.filter(Prefix="cache/"):
        obj.delete()


# Example usage
if __name__ == "__main__":
    lambda_handler(None, None)
