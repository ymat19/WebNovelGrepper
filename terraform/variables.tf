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
  description = "api endpoint path"
  type        = string
}

variable "title" {
  description = "web page title"
  type        = string
}

variable "about" {
  description = "about this page"
  type        = string
}

variable "license_notice" {
  description = "license notice"
  type        = string
}

variable "technology_about" {
  description = "about technology"
  type        = string
}

variable "contact_email" {
  description = "email address"
  type        = string
}

variable "contact_x" {
  description = "x account"
  type        = string
}
