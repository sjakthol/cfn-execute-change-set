# Changelog

## 2.0.0 - 2024-05-19

- Bump minimum required Node version to v16 **BREAKING CHANGE**
- Convert package to ESM and update dependencies to latest versions

## 1.2.0 - 2024-01-31

- Update AWS SDK for JavaScript to version that includes a fix for [aws/aws-sdk-js-v3#4757](https://github.com/aws/aws-sdk-js-v3/issues/4757) and remove the local workaround for that.

## 1.1.2 - 2023-11-18

- Add workaround for a credential resolution issue in AWS SDK for Javascript v3 (https://github.com/aws/aws-sdk-js-v3/issues/4757)

## 1.1.1 - 2023-10-07

- Fix parsing of change set arn from stdin if stdin contains terminal control characters (e.g. colors)
- Fix error in handling changes to UpdateReplacePolicy field of a resource

## 1.1.0 - 2023-02-08

### Changed

- Allow change sets with no changes to be executed if it is executable (e.g. output only changes)

## 1.0.0 - 2022-01-14

### Changed

- Migrate to AWS SDK for JavaScript v3

### Fixed

- Ignore failed change sets with no changes
