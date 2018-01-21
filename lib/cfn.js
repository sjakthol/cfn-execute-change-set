'use strict'
const AWS = require('aws-sdk')
const helpers = require('./helpers')

/**
 * Describe the given changeset & stack. Waits for creation to complete
 * before returning a value.
 *
 * @param {Object} info parsed changeset info object
 * @param {Function} callback callback function to call
 */
function describeChangeSet (info, callback) {
  const cfn = new AWS.CloudFormation({ region: info.region })
  function getChangeSetDetails () {
    cfn.describeChangeSet({ ChangeSetName: info.arn }, function (err, data) {
      if (err) {
        return callback(new Error('DescribeChangeSet failed: ' + JSON.stringify(err, null, 2)))
      }

      if (data.Status === 'FAILED') {
        return callback(new Error('Failed to create change set: ' + data.StatusReason))
      }

      if (data.Status === 'CREATE_IN_PROGRESS') {
        console.log('Changeset is being created. Waiting...')
        return setTimeout(getChangeSetDetails, 1000)
      }

      cfn.describeStacks({ StackName: data.StackId }, function (err, stackData) {
        if (err) {
          return callback(new Error('DescribeStacks failed: ' + JSON.stringify(err, null, 2)))
        }

        callback(null, { stack: stackData.Stacks[0], changeset: data })
      })
    })
  }

  getChangeSetDetails()
}

/**
 * @param {AWS.CloudFormation.DescribeChangeSetOutput} changeset
 */
function executeChangeSet (changeset) {
  const info = helpers.getChangeSetInfoFromInput(changeset.ChangeSetId)
  const cfn = new AWS.CloudFormation({ region: info.region })
  cfn.executeChangeSet({ ChangeSetName: info.arn }, function (err, data) {
    if (err) throw new Error(`Failed to execute change set: ${JSON.stringify(err, null, 2)}`)

    console.log('Stack update started:')
    console.log(`- Change Set ARN: ${changeset.ChangeSetId}`)
    console.log(`- Stack ARN: ${changeset.StackId}`)

    process.exit(0)
  })
}

module.exports = {
  describeChangeSet, executeChangeSet
}
