'use strict'
/* eslint-env mocha */
const AWS = require('aws-sdk')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const cfn = new AWS.CloudFormation({ region: 'eu-north-1' })
const RUN_ID = Date.now() + '-' + crypto.randomBytes(4).toString('hex')

describe('integration test', function () {
  beforeEach(() => {
    delete require.cache[require.resolve('../index')]
  })

  this.timeout(120000)

  const CASE_DIR = path.join(__dirname, 'test_cases')
  const CASES = fs.readdirSync(CASE_DIR)

  for (const testcase of CASES) {
    const StackName = `cfn-execute-change-set-${testcase}-${RUN_ID}`

    describe(testcase, function () {
      /**
       * @type {AWS.CloudFormation.CreateStackOutput}
       */
      let stack

      /**
       * @type {AWS.CloudFormation.CreateChangeSetOutput}
       */
      let chgset

      beforeEach(async function () {
        const suite = this
        console.log(`[${testcase}] SETUP: Creating stack ${StackName}`)
        const TemplateBody = fs.readFileSync(path.join(CASE_DIR, testcase, 'initial.yaml'), { encoding: 'utf-8' })
        stack = await cfn.createStack({
          OnFailure: 'DELETE',
          StackName,
          TemplateBody
        }).promise()
          .catch(function (err) {
            const skipOnErrors = new Set(['ExpiredToken', 'CredentialsError', 'AccessDenied'])
            if (skipOnErrors.has(err.code)) {
              console.log('Skipping integration test (no valid credentials available)')
              suite.skip()
            }
          })

        await cfn.waitFor('stackCreateComplete', { StackName: stack.StackId }).promise()
        console.log(`[${testcase}] SETUP: Stack ${StackName} ready`)

        const updatedTemplate = fs.readFileSync(path.join(CASE_DIR, testcase, 'updated.yaml'), { encoding: 'utf-8' })
        chgset = await cfn.createChangeSet({
          ChangeSetName: 'integration-test',
          StackName: stack.StackId,
          TemplateBody: updatedTemplate
        }).promise()
      })

      afterEach(async () => {
        if (stack) {
          console.log(`[${testcase}] CLEANUP: Deleting stack ${StackName}`)
          await cfn.deleteStack({ StackName: stack.StackId }).promise()
          await cfn.waitFor('stackDeleteComplete', { StackName: stack.StackId }).promise()
          console.log(`[${testcase}] CLEANUP: Stack ${StackName} deleted`)
        }
      })

      it('should analyze change set without crashing', async function () {
        const index = require('../index')
        await index.maybeReviewChangeSet(chgset.Id, true)
      })

      it('should execute a change set correctly', async function () {
        const index = require('../index')
        process.env.PROMPT_ANSWER = 'y'
        await index.maybeReviewChangeSet(chgset.Id)
        await cfn.waitFor('stackUpdateComplete', { StackName: stack.StackId }).promise()
      })

      it('should skip execution if negative answer is given', async function () {
        const index = require('../index')
        process.env.PROMPT_ANSWER = 'N'
        await index.maybeReviewChangeSet(chgset.Id)
      })
    })
  }
})
