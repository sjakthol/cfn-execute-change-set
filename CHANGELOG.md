# Changelog

## 1.1.1 - 2023-10-07

* Fix parsing of change set arn from stdin if stdin contains terminal control characters (e.g. colors)
* Fix error in handling changes to UpdateReplacePolicy field of a resource

## 1.1.0 - 2023-02-08

### Changed

* Allow change sets with no changes to be executed if it is executable (e.g. output only changes)

## 1.0.0 - 2022-01-14

### Changed

* Migrate to AWS SDK for JavaScript v3

### Fixed

* Ignore failed change sets with no changes