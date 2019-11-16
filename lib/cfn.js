'use strict'
const AWS = require('aws-sdk')
const helpers = require('./helpers')

/**
 * Describe the given changeset & stack. Waits for creation to complete
 * before returning a value.
 *
 * @param {Object} info parsed changeset info object
 */
async function describeChangeSet (info) {
  const cfn = new AWS.CloudFormation({ region: info.region })
  while (true) {
    const data = await cfn.describeChangeSet({ ChangeSetName: info.arn }).promise()
    if (data.Status === 'FAILED') {
      return Promise.reject(new Error('Failed to create change set: ' + data.StatusReason))
    }

    if (data.Status === 'CREATE_COMPLETE') {
      const stackData = await cfn.describeStacks({ StackName: data.StackId }).promise()
      return { stack: stackData.Stacks[0], changeset: data }
    }

    console.log('Changeset is being created. Waiting...')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
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
