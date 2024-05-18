'use strict'

import { CloudFormationClient } from '@aws-sdk/client-cloudformation'

const CHGSET_ARN_RGX = /arn:aws:cloudformation:([^:]+):\d+:changeSet\/([a-zA-Z][-a-zA-Z0-9]*)\/[-a-zA-Z0-9:/]+/

/**
 * @typedef {Object} ChangeSetInfo
 * @property {string} arn the ARN of the change set
 * @property {string} name the name of the change set
 * @property {string} region the region the change set belongs to
 */

/**
 * Parse the CloudFormation changeset ARN from the input data.
 *
 * @param {string} input the input data to parse
 * @return {ChangeSetInfo} changeset information object or null if a changeset ARN
 * was not found from the input
 */
function getChangeSetInfoFromInput (input) {
  const match = input.match(CHGSET_ARN_RGX)
  if (!match) {
    return null
  }

  return { arn: match[0], region: match[1], name: match[2] }
}

/**
 * Create a CloudFormation client with some defaults and the given
 * configuration.
 *
 * @param {import('@aws-sdk/client-cloudformation').CloudFormationClientConfig} config
 * @returns {CloudFormationClient} a CloudFormation client
 */
function getCloudFormationClient (config) {
  return new CloudFormationClient({ maxAttempts: 10, ...config })
}

export default {
  getChangeSetInfoFromInput,
  getCloudFormationClient
}
