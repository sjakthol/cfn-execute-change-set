'use strict'
const {
  CloudFormationClient,
  DescribeChangeSetCommand,
  DescribeStacksCommand,
  ExecuteChangeSetCommand
} = require('@aws-sdk/client-cloudformation')

const helpers = require('./helpers')

// Workaround for https://github.com/aws/aws-sdk-js-v3/issues/4757.
//
// resolveProfileData is unable to resolve credentials for an SSO profile that uses the sso_session
// option. This is because resolveProfileData does not resolve parameteters from the linked
// sso-session.
//
// Here we monkeypatch the resolveProfileData method, catch errors that occur during its execution
// and check if the error looks sso_session related. If so, we try to load credentials for the profile
// with the fromSSO() method that also loads parameters from the linked sso-session.
const { fromSSO } = require('@aws-sdk/credential-provider-sso')
const resolveProfileDataModule = require('@aws-sdk/credential-provider-ini/dist-cjs/resolveProfileData.js')
const resolveProfileData = resolveProfileDataModule.resolveProfileData
resolveProfileDataModule.resolveProfileData = async (profileName, profiles, options, visitedProfiles = {}) => {
  try {
    return (await resolveProfileData(profileName, profiles, options, visitedProfiles))
  } catch (e) {
    if (/Profile is configured with invalid SSO credentials. Required parameters/.test(e.message)) {
      // resolveProfileData() failed as an SSO profile profile being an SSO profile with some parameters being
      // defined via sso-session. Try to load credentials with fromSSO() instead as that can resolve
      // parameters from the linked sso-session.
      return fromSSO({ profile: profileName })()
    }

    throw e
  }
}

/**
 * Describe the given changeset & stack. Waits for creation to complete
 * before returning a value.
 *
 * @param {Object} info parsed changeset info object
 */
async function describeChangeSet (info) {
  const cfn = new CloudFormationClient({ region: info.region })
  while (true) {
    const data = await cfn.send(new DescribeChangeSetCommand({ ChangeSetName: info.arn }))
    if (data.Status === 'FAILED') {
      if (data.StatusReason.match(/didn't contain changes/)) {
        const stackData = await cfn.send(new DescribeStacksCommand({ StackName: data.StackId }))
        return { stack: stackData.Stacks[0], changeset: data }
      }
      return Promise.reject(new Error('Failed to create change set: ' + data.StatusReason))
    }

    if (data.Status === 'CREATE_COMPLETE') {
      const stackData = await cfn.send(new DescribeStacksCommand({ StackName: data.StackId }))
      return { stack: stackData.Stacks[0], changeset: data }
    }

    console.log('Changeset is being created. Waiting...')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

/**
 * @param {import('@aws-sdk/client-cloudformation').DescribeChangeSetOutput} changeset
 */
async function executeChangeSet (changeset) {
  const info = helpers.getChangeSetInfoFromInput(changeset.ChangeSetId)
  const cfn = new CloudFormationClient({ region: info.region })
  try {
    await cfn.send(new ExecuteChangeSetCommand({ ChangeSetName: info.arn }))
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
