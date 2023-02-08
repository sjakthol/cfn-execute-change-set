#!/usr/bin/env node
'use strict'

const readline = require('readline')

const chalk = require('chalk')
let ttys = null
try {
  ttys = require('ttys')
} catch (e) {
  console.log('Note: Cannot prompt for input. Assuming YES after timeout!')
}

const analysis = require('./lib/analysis')
const cfn = require('./lib/cfn')
const helpers = require('./lib/helpers')
const renderers = require('./lib/renderers')

let chain = Promise.resolve(true)

function queueChangeSet (input) {
  chain = chain.then(() => maybeReviewChangeSet(input))
}

/**
 * Checks the given input for CloudFormation changeset ARN and
 * starts review if one is found.
 *
 * @param {String} input the input to parse
 * @param {Boolean} [skipExec=false] set to true to skip execution of change set (for tests)
 */
async function maybeReviewChangeSet (input, skipExec = false) {
  const info = helpers.getChangeSetInfoFromInput(input)
  if (!info) {
    return
  }

  const data = await cfn.describeChangeSet(info)

  const stack = data.changeset.StackName
  const name = data.changeset.ChangeSetName
  console.log(chalk.bold('Summary'))
  console.log(`- Stack Name: ${stack}`)
  console.log(`- Change Set Name: ${name}`)
  console.log()

  if (!data.changeset.Changes || !data.changeset.Changes.length) {
    if (data.changeset.ExecutionStatus === 'UNAVAILABLE') {
      console.log(chalk.bold('No changes'), data.changeset.StatusReason)
      return
    } else {
      console.log(chalk.bold('No resource, parameter or tag changes.'), 'Outputs may change but changes to outputs cannot be reviewed.')
    }
  }

  const resourceChanges = analysis.analyzeResourceChanges(data.changeset)
  printResourceChanges(resourceChanges)

  const tagChanges = analysis.analyzeTagChanges(data.changeset, data.stack)
  printKeyValueChanges(tagChanges, 'Tag Changes')

  const parameterChanges = analysis.analyzeParameterChanges(data.changeset, data.stack)
  printKeyValueChanges(parameterChanges, 'Parameter Changes')

  if (!skipExec) {
    return promptAndExecuteChanges(data.changeset)
  }
}

/**
 * @typedef KeyValueChange
 * @property {String} Key
 * @property {String} Value
 * @property {String} [OldValue]
 */

/**
 * @typedef KeyValueChanges
 * @property {KeyValueChange[]} added
 * @property {KeyValueChange[]} removed
 * @property {KeyValueChange[]} modified
 */

/**
 * @param {KeyValueChanges} changes
 */
function printKeyValueChanges (changes, title) {
  if (!changes.added.length && !changes.removed.length && !changes.modified.length) {
    // No tag changes!
    return
  }

  console.log() // Print empty line to separate this from previous section
  console.log(chalk.bold(title))
  /**
   * @param {String} action
   * @param {KeyValueChange[]} changes
   */
  function _printKeyValueChanges (action, changes) {
    for (const change of changes) {
      const type = renderers.renderAction({ Action: action })
      const summary = renderers.renderKeyValueChange(change)
      console.log(`${type} ${summary}`)
    }
  }

  _printKeyValueChanges('Add', changes.added)
  _printKeyValueChanges('Remove', changes.removed)
  _printKeyValueChanges('Modify', changes.modified)
}

/**
 * @param {Object} changes
 * @param {import('@aws-sdk/client-cloudformation').ResourceChange[]} changes.added
 * @param {import('@aws-sdk/client-cloudformation').ResourceChange[]} changes.removed
 * @param {import('@aws-sdk/client-cloudformation').ResourceChange[]} changes.modified
 */
function printResourceChanges (changes) {
  /**
   * @param {import('@aws-sdk/client-cloudformation').ResourceChange[]} changes
   */
  function _printResources (changes) {
    for (const change of changes) {
      const type = renderers.renderAction(change)
      const resource = renderers.renderResourceSummary(change)
      const replacement = renderers.renderReplacement(change)
      console.log(`${type} ${resource}${replacement}`)

      for (const detail of change.Details) {
        const recreation = renderers.renderRecreation(detail)
        console.log(`    - ${detail.Summary}${recreation}`)
        for (const cause of (detail.Causes || [])) {
          console.log(`        caused by ${cause}`)
        }
      }
    }
  }

  if (!changes.added.length && !changes.removed.length && !changes.modified.length) {
    // No resource changes!
    return
  }

  console.log(chalk.bold('Resource Changes'))
  _printResources(changes.added)
  _printResources(changes.removed)
  _printResources(changes.modified)
}

/**
 * @param {import('@aws-sdk/client-cloudformation').DescribeChangeSetOutput} changeset
 * @param {Number} wait - wait time in seconds
 */
async function waitAndExecuteChanges (changeset, wait) {
  while (wait > 0) {
    process.stderr.write(wait + '. ')
    await new Promise(resolve => setTimeout(resolve, 1000))
    wait -= 1
  }

  console.log('Executing change set')
  return cfn.executeChangeSet(changeset)
}

/**
 * @param {import('@aws-sdk/client-cloudformation').DescribeChangeSetOutput} changeset
 */
async function promptAndExecuteChanges (changeset) {
  if (!ttys) {
    console.log('Executing changeset in 10 seconds. Press CTRL+C to abort!')
    return waitAndExecuteChanges(changeset, 10)
  }
  const i = readline.createInterface(ttys.stdin, ttys.stdout)
  console.log() // Empty line

  const answer = process.env.PROMPT_ANSWER || await new Promise(resolve => i.question('Execute change set [y/N]? ', resolve))
  i.close()
  if (answer === 'y') {
    console.log('Executing change set...')
    return cfn.executeChangeSet(changeset)
  } else {
    console.log('Skipping change set execution')
    return true
  }
}

// See if we have a changeset ARN(s) given as command line argument(s)
if (process.argv.length > 2) {
  for (const input of process.argv.slice(2)) {
    queueChangeSet(input)
  }
}

// Also check if we have been piped some input and detect changeset
// IDs from there
if (!process.stdin.isTTY) {
  const rl = readline.createInterface({
    input: process.stdin
  })

  rl.on('line', line => {
    // echo to stdout
    console.log(line)
    queueChangeSet(line)
  })

  rl.on('close', () => {
    chain.then(() => process.exit(0))
  })
}

// For testing
module.exports = {
  maybeReviewChangeSet
}
