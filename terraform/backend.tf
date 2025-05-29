terraform {
  backend "s3" {
    region         = "ap-northeast-1"
    bucket         = "tf-state-147997146783"
    key            = "terraform.tfstate"
    dynamodb_table = "tf-state-147997146783"
  }
}
