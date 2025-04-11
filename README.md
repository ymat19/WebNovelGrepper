# WebNovelGrepper

[![CI/CD(Demo Env)](https://github.com/ymat19/WebNovelGrepper/actions/workflows/cicd.yml/badge.svg)](https://github.com/ymat19/WebNovelGrepper/actions/workflows/cicd.yml)

[デモ環境](https://ymat19.com/WebNovelGrepper/)

Web小説サイトの全文検索を実現するアプリケーションです。

## アーキテクチャ概要

このアプリケーションは以下の3つのコンポーネントで構成されています：

1. **バッチ処理 (AWS Lambda)**
   - Web小説サイトから本文データを定期的にスクレイピング
   - BeautifulSoup4を使用してHTMLをパース
   - 取得したデータをDynamoDBに保存

2. **バックエンド (AWS Lambda)**
   - フロントエンドからのクエリを受け付け
   - DynamoDBに対して全文検索を実行
   - 大きな検索結果はS3にキャッシュ
   - APIレスポンスサイズは6MB以下に制限

3. **フロントエンド (React + Vite + TypeScript)**
   - 検索クエリの入力UI
   - 検索結果の表示
   - 検索文字列のハイライト表示
   - 設定情報の表示（About画面）
   - レスポンシブデザイン（Chakra UI）

## 主な機能

- 指定した作品内での全文検索
- 複数キーワードのAND検索
- 検索結果は本文の行単位で表示
- 検索結果内のキーワードをハイライト表示
- デモモード対応
- 検索中のローディング表示
- アプリケーション情報の表示（About画面）
- 要望送信機能

## 技術スタック

### フロントエンド

- React
- TypeScript
- Vite
- Chakra UI
- ESLint

### バックエンド

- Python
- AWS Lambda
- Amazon DynamoDB
- Amazon S3

### バッチ処理

- Python
- AWS Lambda
- BeautifulSoup4
- Amazon DynamoDB
- Amazon S3

### インフラ

- Terraform

## システム構成図

### アプリケーションの流れ

```mermaid
graph TB
    User((ユーザー))
    FE[Webフロントエンド<br/>React + TypeScript]
    BE[バックエンドAPI<br/>AWS Lambda]
    BATCH[バッチ処理<br/>AWS Lambda]
    Novel[Web小説サイト]
    DB[(DynamoDB)]
    S3[(S3)]

    User -->|検索| FE
    FE -->|検索クエリ| BE
    BE -->|検索| DB
    BE -->|キャッシュ| S3
    BATCH -->|スクレイピング| Novel
    BATCH -->|保存| DB
    S3 -->|キャッシュ読込| BE
    BE -->|検索結果| FE
    FE -->|表示| User
```

### AWSインフラ構成

```mermaid
graph TB
    subgraph "Frontend"
        CloudFront
        S3_Static[S3<br/>静的コンテンツ]
    end

    subgraph "Backend"
        APIGW[API Gateway]
        Lambda_BE[Lambda<br/>バックエンド]
        Lambda_Batch[Lambda<br/>バッチ]
        DDB[DynamoDB<br/>本文データ]
        S3_Cache[S3<br/>検索キャッシュ]
        
        EventBridge -->|定期実行| Lambda_Batch
        APIGW -->|/search| Lambda_BE
        Lambda_BE -->|検索| DDB
        Lambda_BE -->|キャッシュ| S3_Cache
        Lambda_Batch -->|保存| DDB
    end

    CloudFront -->|配信| S3_Static
    CloudFront -->|API| APIGW
```

## ライセンス情報

- [backend](licenses/backend.txt)
- [batch](licenses/batch.txt)
- [frontend](licenses/front.csv)
