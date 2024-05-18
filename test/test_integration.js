'use strict'
/* eslint-env mocha */
import crypto from 'crypto'
import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  CloudFormationClient,
  CreateChangeSetCommand,
  CreateStackCommand,
  DeleteStackCommand,
  waitUntilStackCreateComplete
} from '@aws-sdk/client-cloudformation'

const RUN_ID = Date.now() + '-' + crypto.randomBytes(4).toString('hex')
const cfn = new CloudFormationClient({})
const stacks = []

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CASE_DIR = path.join(__dirname, 'test_cases')

/**
 * Helper to create a CloudFormation stack and change set for a test case.
 *
 * Creates
 * * a CloudFormation stack from initial.yaml template of given test case
 * * a CloudFormation change set with updated.yaml template of given test case
 *
 * @param {string} testcase - Test case name
 * @return {Promise<string>} Change set ID / ARN of the change set created from updated.yaml template
 */
async function createTestStackAndChangeSet (testcase) {
  const StackName = `cfn-execute-change-set-${testcase}-${RUN_ID}-${crypto.randomBytes(4).toString('hex')}`
  console.error(`Creating stack ${StackName}`)

  const TemplateBody = fs.readFileSync(path.join(CASE_DIR, testcase, 'initial.yaml'), { encoding: 'utf-8' })
  const cmd = new CreateStackCommand({
    StackName,
    OnFailure: 'DELETE',
    TemplateBody
  })
  const stack = await cfn.send(cmd).catch(function (err) {
    if (err.message === 'Region is missing') {
      console.error(`Skipping test: ${err.message}`)
      return
    }
    const skipOnErrors = new Set(['ExpiredToken', 'CredentialsError', 'AccessDenied'])
    if (skipOnErrors.has(err.Code)) {
      console.error(`Skipping test: ${err.Code}`)
      return
    }

    throw err
  })

  if (!stack) {
    return
  }

  stacks.push(stack.StackId)
  await waitUntilStackCreateComplete({ client: cfn, maxWaitTime: 120 }, { StackName: stack.StackId })

  console.error(`Creating change set for ${StackName}`)
  const updatedTemplate = fs.readFileSync(path.join(CASE_DIR, testcase, 'updated.yaml'), { encoding: 'utf-8' })
  const chgset = await cfn.send(new CreateChangeSetCommand({
    ChangeSetName: 'integration-test',
    StackName: stack.StackId,
    TemplateBody: updatedTemplate
  }))

  return chgset.Id
}

describe('integration test', function () {
  after(async () => {
    await Promise.all(stacks.map(async stack => {
      console.error(`Deleting stack ${stack}`)
      await cfn.send(new DeleteStackCommand({ StackName: stack }))
    }))
  })

  this.timeout(120000)

  it('should analyze change set without crashing', async function () {
    const changeSetId = await createTestStackAndChangeSet('01-common-changes')
    if (!changeSetId) {
      return this.skip()
    }
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`)
    await index.maybeReviewChangeSet(changeSetId, true)
  })

  it('should execute a change set correctly', async function () {
    const changeSetId = await createTestStackAndChangeSet('01-common-changes')
    if (!changeSetId) {
      return this.skip()
    }
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`)
    process.env.PROMPT_ANSWER = 'y'
    await index.maybeReviewChangeSet(changeSetId)
  })

  it('should skip execution if negative answer is given', async function () {
    const changeSetId = await createTestStackAndChangeSet('01-common-changes')
    if (!changeSetId) {
      return this.skip()
    }
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`)
    process.env.PROMPT_ANSWER = 'N'
    await index.maybeReviewChangeSet(changeSetId)
  })

  it('should handle change sets with no changes', async function () {
    const changeSetId = await createTestStackAndChangeSet('02-no-changes')
    if (!changeSetId) {
      return this.skip()
    }
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`)
    await index.maybeReviewChangeSet(changeSetId, true)
  })

  it('should handle change sets with output only changes', async function () {
    const changeSetId = await createTestStackAndChangeSet('03-output-only-changes')
    if (!changeSetId) {
      return this.skip()
    }
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`)
    await index.maybeReviewChangeSet(changeSetId, true)
  })

  it('should handle change sets with metadata only changes', async function () {
    const changeSetId = await createTestStackAndChangeSet('04-metadata-changes')
    if (!changeSetId) {
      return this.skip()
    }
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`)
    await index.maybeReviewChangeSet(changeSetId, true)
  })
})
