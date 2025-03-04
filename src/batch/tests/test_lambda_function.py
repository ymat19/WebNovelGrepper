import pytest
from unittest.mock import patch, MagicMock

from bs4 import BeautifulSoup
from batch.lambda_function import (
    get_root_element,
    get_all_li_elements,
    get_episodes,
    get_body_lines,
    put_records_to_dynamodb,
    lambda_handler,
    Episode,
    Line,
    Record
)

###############################################################################
# get_root_element のテスト
###############################################################################
@patch("requests.get")
def test_get_root_element_success(mock_get, tmp_path):
    """requests.get が成功した場合のテスト"""

    # モックの設定
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"<html><body><p>Hello World</p></body></html>"
    mock_get.return_value = mock_response

    url = "https://example.com"
    root_element = get_root_element(url)

    assert isinstance(root_element, BeautifulSoup)
    assert root_element.find("p").text == "Hello World"


@patch("requests.get")
def test_get_root_element_raise_for_status(mock_get):
    """requests.get がエラーを返す場合のテスト"""

    # モックの設定
    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = Exception("Error")
    mock_get.return_value = mock_response

    url = "https://example.com"
    with pytest.raises(Exception, match="Error"):
        get_root_element(url)


###############################################################################
# get_all_li_elements のテスト
###############################################################################
def test_get_all_li_elements():

    # BeautifulSoupのテスト用HTML
    html_content = """
    <html>
      <body>
        <ol class="widget-toc-items">
          <li class="widget-toc-chapter"><span>Chapter1</span></li>
          <li><span>Episode1</span></li>
          <li><span>Episode2</span></li>
        </ol>
      </body>
    </html>
    """
    soup = BeautifulSoup(html_content, "html.parser")
    li_elements = get_all_li_elements(soup)

    # li 要素が3つあるはず
    assert len(li_elements) == 3


###############################################################################
# get_episodes のテスト
###############################################################################
def test_get_episodes_chapter():
    """章タイトルを更新する場合のテスト"""

    # ダミーのli要素(章)
    chapter_li = BeautifulSoup(
        '<li class="widget-toc-chapter"><span>Prologue</span></li>', "html.parser"
    ).find("li")

    acc_in = ("", [])
    acc_out = get_episodes(acc_in, chapter_li)

    # 章タイトルのみ更新され、episodes は空のまま
    assert acc_out[0] == "Prologue"
    assert acc_out[1] == []


def test_get_episodes_episode():
    """エピソードを追加する場合のテスト"""

    # ダミーのli要素(エピソード)
    episode_li = BeautifulSoup(
        """
        <li>
          <span>Episode 1</span>
          <a href="https://example.com/episodes/12345/episode/67890">Link</a>
        </li>
        """,
        "html.parser",
    ).find("li")

    acc_in = ("Prologue", [])
    acc_out = get_episodes(acc_in, episode_li)

    assert acc_out[0] == "Prologue"  # 章は変わらない
    episodes = acc_out[1]
    assert len(episodes) == 1
    assert isinstance(episodes[0], Episode)
    assert episodes[0].work_id == 12345
    assert episodes[0].episode_id == 67890
    assert episodes[0].sub_title == "Prologue"
    assert episodes[0].number == "Episode 1"


###############################################################################
# get_body_lines のテスト
###############################################################################
def test_get_body_lines():

    # ダミーHTML
    html_content = """
    <html>
      <body>
        <div class="widget-episodeBody">
          <p id="L1">Hello</p>
          <p id="L2">World</p>
          <p>Invalid</p>
        </div>
      </body>
    </html>
    """
    soup = BeautifulSoup(html_content, "html.parser")
    lines = list(get_body_lines(soup))

    assert len(lines) == 2
    assert all(isinstance(line, Line) for line in lines)
    assert lines[0].number == 1
    assert lines[0].body == "Hello"
    assert lines[1].number == 2
    assert lines[1].body == "World"


###############################################################################
# put_records_to_dynamodb のテスト
###############################################################################
@patch("boto3.resource")
def test_put_records_to_dynamodb(mock_boto3):

    # ダミーのテーブルモック
    mock_table = MagicMock()
    mock_batch_writer = MagicMock()
    mock_table.batch_writer.return_value.__enter__.return_value = mock_batch_writer
    mock_dynamodb = MagicMock()
    mock_dynamodb.Table.return_value = mock_table
    mock_boto3.return_value = mock_dynamodb

    # テスト用の records
    recs = [
        Record(
            Episode(work_id=123, sub_title="Prologue", number="Ep1", episode_id=999),
            Line(number=1, body="Hello"),
        ),
        Record(
            Episode(work_id=123, sub_title="Prologue", number="Ep1", episode_id=999),
            Line(number=2, body="World"),
        ),
    ]
    put_records_to_dynamodb(recs)

    # batch.put_item がちゃんと呼ばれているか
    assert mock_batch_writer.put_item.call_count == 2
    # 第一引数の呼び出し内容を確認してみる
    first_call_args = mock_batch_writer.put_item.call_args_list[0]
    item = first_call_args[1]["Item"]
    assert item["work_id"] == 123
    assert item["episode_id"] == 999
    assert item["line"] == 1
    assert item["body"] == "Hello"


###############################################################################
# lambda_handler のテスト
###############################################################################
@patch("time.sleep", return_value=None)
@patch("boto3.resource")
@patch("requests.get")
def test_lambda_handler(
    mock_requests_get, mock_boto3_resource, mock_time_sleep
):
    """
    lambda_handler の大枠のテスト
    - requests.get
    - boto3.resource
    をモックし、外部リソースとの連携部分をスキップ
    """

    # -----------------------------
    # 1. サイドバー(episode_sidebar)用 HTML のモック設定
    # -----------------------------
    sidebar_html = """
    <html>
      <body>
        <ol class="widget-toc-items">
          <li class="widget-toc-chapter"><span>Chapter1</span></li>
          <li><span>Ep1</span><a href="https://test.com/episodes/123/episode/111">ep1</a></li>
          <li class="widget-toc-chapter"><span>Chapter2</span></li>
          <li><span>Ep2</span><a href="https://test.com/episodes/123/episode/222">ep2</a></li>
        </ol>
      </body>
    </html>
    """
    # -----------------------------
    # 2. 各エピソード本文用 HTML のモック設定
    # -----------------------------
    episode_body_html = """
    <html>
      <body>
        <div class="widget-episodeBody">
          <p id="L1">Line1</p>
          <p id="L2">Line2</p>
          <p id="L3"></p>
        </div>
      </body>
    </html>
    """

    # requests.get() の返り値を制御するためのサイドエフェクト
    def mock_requests_side_effect(url, *args, **kwargs):
        mock_resp = MagicMock()
        # サイドバー
        if "episode_sidebar" in url:
            mock_resp.status_code = 200
            mock_resp.content = sidebar_html.encode("utf-8")
            return mock_resp
        # エピソード本文
        elif "episodes/" in url:
            mock_resp.status_code = 200
            mock_resp.content = episode_body_html.encode("utf-8")
            return mock_resp
        else:
            # デフォルト: 404
            mock_resp.status_code = 404
            return mock_resp

    mock_requests_get.side_effect = mock_requests_side_effect

    # boto3.resource のモック
    mock_dynamodb = MagicMock()
    mock_table = MagicMock()
    mock_dynamodb.Table.return_value = mock_table
    mock_boto3_resource.return_value = mock_dynamodb

    # S3 側のモック
    mock_s3_bucket = MagicMock()
    mock_s3_bucket.objects.filter.return_value = []
    mock_dynamodb.Bucket.return_value = mock_s3_bucket

    # -----------------------------
    # 環境変数
    # -----------------------------
    import os
    os.environ["WORK_URLS"] = "https://test.com/episodes/123"
    os.environ["TABLE_NAME"] = "DummyTable"
    os.environ["BUCKET_NAME"] = "DummyBucket"

    # -----------------------------
    # テスト実行
    # -----------------------------
    event = {"target_rate": 100}  # 100%対象にする
    lambda_handler(event, None)

    # -----------------------------
    # 検証
    # -----------------------------
    # put_item がちゃんと呼ばれたこと
    assert mock_table.batch_writer.return_value.__enter__.return_value.put_item.call_count == 4
    # エピソード2話分 × 各話に2行(空文字は除外される) = 4アイテム
    # S3キャッシュ削除が呼ばれたこと
    mock_s3_bucket.objects.filter.assert_called_once_with(Prefix="cache/")
