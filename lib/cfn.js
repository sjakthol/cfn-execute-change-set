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
async function executeChangeSet (changeset) {
  const info = helpers.getChangeSetInfoFromInput(changeset.ChangeSetId)
  const cfn = new AWS.CloudFormation({ region: info.region })
  try {
    await cfn.executeChangeSet({ ChangeSetName: info.arn }).promise()
  } catch (err) {
    console.error(`Failed to execute change set: ${JSON.stringify(err, null, 2)}`)
    return false
  }

  console.log('Stack update started:')
  console.log(`- Change Set ARN: ${changeset.ChangeSetId}`)
  console.log(`- Stack ARN: ${changeset.StackId}`)

  return true
}

module.exports = {
  describeChangeSet, executeChangeSet
}
