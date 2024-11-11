resource "aws_dynamodb_table" "lines" {
  name           = var.table_name
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20

  hash_key  = "episode_id"
  range_key = "line"
  attribute {
    name = "episode_id"
    type = "N"
  }
  attribute {
    name = "line"
    type = "N"
  }
}

# create lambda execution role
resource "aws_iam_role" "lambda_role" {
  name = "lambda_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "lambda_policy"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "dynamodb:*",
          "s3:*"
        ],
        Resource = "*"
      }
    ]
  })
}

# upload batch lambda function
# null_resource to update pip package
resource "null_resource" "batch" {
  triggers = {
    always_run = timestamp()
  }
  provisioner "local-exec" {
    command = "pip install -r ../src/batch/requirements.txt -t ../src/batch/package && cp ../src/batch/lambda_function.py ../src/batch/package"
  }
}

# lambda source data
data "archive_file" "batch" {
  depends_on  = [null_resource.batch]
  type        = "zip"
  source_dir  = "../src/batch/package"
  output_path = "batch.zip"
}

# create python lambda function
resource "aws_lambda_function" "batch" {
  depends_on       = [data.archive_file.batch]
  function_name    = "batch"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.10"
  filename         = data.archive_file.batch.output_path
  source_code_hash = data.archive_file.batch.output_base64sha256
  timeout          = 900
  architectures    = ["arm64"]
  environment {
    variables = {
      WORK_URLS   = var.work_urls
      TABLE_NAME  = var.table_name
      BUCKET_NAME = "${var.site_prefix}${data.aws_caller_identity.current.account_id}"
    }
  }
}

# batch sheduling
resource "aws_cloudwatch_event_rule" "weekly_lambda_trigger" {
  name                = "weekly-lambda-trigger"
  schedule_expression = "cron(0 20 ? * FRI *)" # 毎週金曜の20:00 UTC
  description         = "Trigger Lambda every Saturday early morning (JST)"
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule = aws_cloudwatch_event_rule.weekly_lambda_trigger.name
  arn  = aws_lambda_function.batch.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeToInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.batch.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_lambda_trigger.arn
}

# upload backend lambda function
# null_resource to update pip package
resource "null_resource" "backend" {
  triggers = {
    always_run = timestamp()
  }
  provisioner "local-exec" {
    command = "pip install -r ../src/backend/requirements.txt -t ../src/backend/package && cp ../src/backend/lambda_function.py ../src/backend/package"
  }
}

# lambda source data
data "archive_file" "backend" {
  depends_on  = [null_resource.backend]
  type        = "zip"
  source_dir  = "../src/backend/package"
  output_path = "backend.zip"
}


# create python lambda function
resource "aws_lambda_function" "backend" {
  depends_on       = [data.archive_file.backend]
  function_name    = "backend"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.10"
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256
  timeout          = 120
  architectures    = ["arm64"]
  environment {
    variables = {
      TABLE_NAME  = var.table_name
      BUCKET_NAME = "${var.site_prefix}${data.aws_caller_identity.current.account_id}"
    }
  }
}

resource "aws_apigatewayv2_api" "http_api" {
  name          = "novel-grep-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]   # どのオリジンからも許可
    allow_methods = ["GET"] # GETメソッドを許可
    allow_headers = ["*"]   # 必要に応じてヘッダーも許可
    max_age       = 3600    # オプション: CORSキャッシュの秒数
  }
}

resource "aws_lambda_permission" "allow_api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.backend.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /${var.path}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_rate_limit  = 1
    throttling_burst_limit = 10
  }
}

provider "aws" {
  region = "ap-northeast-1"
  assume_role {
    role_arn = var.deploy_role_arn
  }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "vite_project" {
  bucket = "${var.site_prefix}${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_object" "front_config" {
  bucket = aws_s3_bucket.vite_project.bucket
  key    = "front_config.json"
  content = jsonencode({
    api_endpoint_url = "https://${aws_apigatewayv2_api.http_api.id}.execute-api.ap-northeast-1.amazonaws.com/${var.path}"
    work_urls        = var.work_urls
    title            = var.title
    about            = var.about
    license_notice   = var.license_notice
    technology_about = var.technology_about
    contact_email    = var.contact_email
    contact_x        = var.contact_x
  })
  content_type = "application/json"
}

resource "aws_s3_bucket_public_access_block" "vite_project" {
  bucket = aws_s3_bucket.vite_project.bucket

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "vite_project" {
  bucket     = aws_s3_bucket.vite_project.id
  depends_on = [aws_iam_role.lambda_role]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.vite_project.arn}/*"
      },
      {
        Sid    = "AllowLambdaPutObject"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.lambda_role.arn
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.vite_project.arn}/*"
      }
    ]
  })
}

# null_resource to build front
resource "null_resource" "front" {
  triggers = {
    always_run = timestamp()
  }
  provisioner "local-exec" {
    working_dir = "../src/front/vite-project"
    command     = "npm run build"
  }
}

module "distribution_files" {
  depends_on = [null_resource.front]
  source     = "hashicorp/dir/template"         # 固定
  base_dir   = "../src/front/vite-project/dist" # ファイルを読み取るディレクトリ
}

resource "aws_s3_object" "vite_project" {
  depends_on   = [module.distribution_files]
  bucket       = aws_s3_bucket.vite_project.id
  for_each     = module.distribution_files.files
  key          = each.key
  source       = each.value.source_path
  content_type = each.value.content_type
  etag         = filemd5(each.value.source_path)
}

resource "aws_s3_bucket_website_configuration" "vite_project" {
  bucket = aws_s3_bucket.vite_project.id
  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "vite_project" {
  bucket = aws_s3_bucket.vite_project.id
  rule {
    id     = "ExpireObjectsUnderSpecificPrefix"
    status = "Enabled"

    filter {
      prefix = "cache/" # このプレフィックス配下のオブジェクトに適用
    }

    expiration {
      days = 1 # 7日間でオブジェクトを削除
    }
  }
}

output "s3_website_url" {
  value       = aws_s3_bucket_website_configuration.vite_project.website_endpoint
  description = "S3バケットの静的ホスティングURL"
}
