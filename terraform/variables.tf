variable "deploy_role_arn" {
  description = "ARN of the Terraform execution role"
  type        = string
}

variable "work_urls" {
  description = "target urls"
  type        = string
}

variable "table_name" {
  description = "table name"
  type        = string
}

variable "path" {
  description = "endpoint path"
  type        = string
}

variable "title" {
  description = "web page title"
  type        = string
}

variable "about" {
  description = "endpoint path"
  type        = string
}

variable "license_notice" {
  description = "web page title"
  type        = string
}

variable "technology_about" {
  description = "web page title"
  type        = string
}

variable "site_prefix" {
  description = "web page title"
  type        = string
}
