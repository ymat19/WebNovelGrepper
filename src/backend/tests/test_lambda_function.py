import json
import pytest
from unittest.mock import patch, MagicMock
from backend.lambda_function import lambda_handler


@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    """すべてのテストで環境変数をセット"""
    monkeypatch.setenv("TABLE_NAME", "TestTable")
    monkeypatch.setenv("BUCKET_NAME", "TestBucket")


@patch("boto3.resource")
@patch("boto3.client")
def test_missing_words(mock_boto3_client, mock_boto3_resource):
    """wordsが指定されなかった場合のテスト"""
    event = {
        "queryStringParameters": {
            "work_id": "123",
        }
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 400
    assert "words is required" in response["body"]


@patch("boto3.resource")
@patch("boto3.client")
def test_missing_work_id(mock_boto3_client, mock_boto3_resource):
    """work_idが指定されなかった場合のテスト"""
    event = {
        "queryStringParameters": {
            "words": "テスト,サンプル",
        }
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 400
    assert "work_id is required" in response["body"]


@patch("boto3.resource")
@patch("boto3.client")
def test_request_present(mock_boto3_client, mock_boto3_resource):
    """requestパラメータがある場合のテスト"""
    event = {
        "queryStringParameters": {
            "request": "Some request",
            "words": "テスト,サンプル",  # あってもなくてもよい
            "work_id": "999"
        }
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    assert response["body"] == "OK"


@patch("boto3.resource")
@patch("boto3.client")
def test_normal_case(mock_boto3_client, mock_boto3_resource):
    """
    通常ケース: 
      - words, work_idあり
      - DynamoDB scanが1回で完了
      - レスポンスが小さい(6MB以下)ので 200 を返却し、S3に保存される。
    """
    # DynamoDB Table モック
    mock_table = MagicMock()
    # scan が1回だけ呼ばれる -> LastEvaluatedKey は返さずループ終了
    mock_table.scan.return_value = {
        "Items": [
            {"episode_id": "1", "line": 10, "body": "テスト"},
            {"episode_id": "1", "line": 2,  "body": "サンプル"},
        ]
        # "LastEvaluatedKey": ... を返さない
    }
    mock_boto3_resource.return_value.Table.return_value = mock_table

    # S3クライアント モック
    mock_s3 = MagicMock()
    mock_boto3_client.return_value = mock_s3

    event = {
        "queryStringParameters": {
            "words": "テスト,サンプル",
            "work_id": "123"
        }
    }

    response = lambda_handler(event, None)
    assert response["statusCode"] == 200

    body = json.loads(response["body"])
    # line順でソート (2 -> 10)
    assert body[0]["line"] == 2
    assert body[1]["line"] == 10

    # S3へのput_objectが呼ばれたことを検証
    mock_s3.put_object.assert_called_once()
    called_args, called_kwargs = mock_s3.put_object.call_args
    assert called_kwargs["Bucket"] == "TestBucket"
    assert "cache/123/" in called_kwargs["Key"]  # ファイル名にwork_id
    s3_body_str = called_kwargs["Body"]
    s3_body_data = json.loads(s3_body_str)
    # DBのデータがそのままJSON化されているか
    assert s3_body_data[0]["body"] == "サンプル"


@patch("boto3.resource")
@patch("boto3.client")
def test_too_large_response_under_50mb(mock_boto3_client, mock_boto3_resource):
    """
    6MBより大きいが50MB未満のケース:
      - コード上、先にS3へputしてから503を返す
      - 結果: "Too large response" かつ S3 put_objectは呼ばれる
    """
    # 7MB相当の文字列（6MBを超えるが50MB未満）
    # 1文字=1byteと簡単に仮定（実際はUTF-8でマルチバイトの場合があるので注意）
    large_body = "a" * (7 * 1024 * 1024)

    mock_table = MagicMock()
    mock_table.scan.return_value = {
        "Items": [
            {"episode_id": "1", "line": 1, "body": large_body}
        ]
    }
    mock_boto3_resource.return_value.Table.return_value = mock_table

    mock_s3 = MagicMock()
    mock_boto3_client.return_value = mock_s3

    event = {
        "queryStringParameters": {
            "words": "大きいデータ",
            "work_id": "99999"
        }
    }

    response = lambda_handler(event, None)
    assert response["statusCode"] == 503
    assert "Too large response" in response["body"]

    # この場合(元のコード仕様では) put_object が呼ばれている
    mock_s3.put_object.assert_called_once()


@patch("boto3.resource")
@patch("boto3.client")
def test_over_50mb_response(mock_boto3_client, mock_boto3_resource):
    """
    50MBを超えるケース:
      - コード上、'Too large response. Not save to S3' のログを出し、put_objectは呼ばない
      - ただし最終的には 6MB超えているのでステータス 503
        (元コードのロジック通り)
    """
    # 60MB相当の文字列
    large_body = "b" * (60 * 1024 * 1024)

    mock_table = MagicMock()
    mock_table.scan.return_value = {
        "Items": [
            {"episode_id": "1", "line": 1, "body": large_body}
        ]
    }
    mock_boto3_resource.return_value.Table.return_value = mock_table

    mock_s3 = MagicMock()
    mock_boto3_client.return_value = mock_s3

    event = {
        "queryStringParameters": {
            "words": "更に大きいデータ",
            "work_id": "88888"
        }
    }

    response = lambda_handler(event, None)
    # 6MB超 → 503が返る
    assert response["statusCode"] == 503
    assert "Too large response" in response["body"]

    # 50MB超過したら保存しない
    mock_s3.put_object.assert_not_called()
