'use strict'
const lo = {
  groupBy: require('lodash.groupby')
}

/**
 * Analyze the changes included in the changeset.
 *
 * @param {AWS.CloudFormation.DescribeChangeSetOutput} data - the data object returned by describe-change-set
 */
function analyzeResourceChanges (data) {
  const changes = data.Changes
  const added = []
  const removed = []
  const modified = []

  changes.forEach(function (change) {
    if (change.ResourceChange.Action === 'Add') {
      added.push(change.ResourceChange)
    } else if (change.ResourceChange.Action === 'Remove') {
      removed.push(change.ResourceChange)
    } else if (change.ResourceChange.Action === 'Modify') {
      modified.push(change.ResourceChange)
    } else {
      throw new Error('Unexpected change type: ' + change.ResourceChange.Action)
    }
  })

  return {
    added, removed, modified: analyzeModifications(modified)
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
 * Analyze changes made to stack tags.
 *
 * @param {AWS.CloudFormation.DescribeChangeSetOutput} changeset - changeset with new tags
 * @param {AWS.CloudFormation.Stack} stack - stack with old tags
 * @returns {KeyValueChanges} an object containing tag changes
 */
function analyzeTagChanges (changeset, stack) {
  const next = {}
  const prev = {}

  changeset.Tags.forEach(t => { next[t.Key] = t.Value })
  stack.Tags.forEach(t => { prev[t.Key] = t.Value })

  return generateKeyValueChanges(prev, next)
}

/**
 * Analyze changes made to stack parameters.
 *
 * @param {AWS.CloudFormation.DescribeChangeSetOutput} changeset - changeset with new parameters
 * @param {AWS.CloudFormation.Stack} stack - stack with current parameters
 * @returns {KeyValueChanges} an object containing changed params
 */
function analyzeParameterChanges (changeset, stack) {
  const prev = {}
  const next = {}

  stack.Parameters.forEach(p => { prev[p.ParameterKey] = p.ParameterValue })
  changeset.Parameters.forEach(p => {
    next[p.ParameterKey] = p.UsePreviousValue ? prev[p.ParameterKey] : p.ParameterValue
  })

  return generateKeyValueChanges(prev, next)
}

/**
 * Helper to compare contents of two objects. The method splits
 * changes into three arrays: added keys, removed keys and modified
 * keys.
 *
 * @param {Object} prev - old key-value pairs
 * @param {Object} next - new key-value pairs
 * @returns {KeyValueChanges}
 */
function generateKeyValueChanges (prev, next) {
  const nextKeys = Object.keys(next)
  const prevKeys = Object.keys(prev)

  const added = nextKeys
    .filter(k => !prev[k])
    .map(k => ({ Key: k, Value: next[k] }))

  const removed = prevKeys
    .filter(k => !next[k])
    .map(k => ({ Key: k, Value: prev[k] }))

  const modified = nextKeys
    .filter(k => prev[k] && next[k] && prev[k] !== next[k])
    .map(k => ({ Key: k, Value: next[k], OldValue: prev[k] }))

  return { added, removed, modified }
}

/**
 * Analyzes modifications of a changeset.
 *
 * @param {AWS.CloudFormation.ResourceChange[]} modified - list of resource changes for modified resources
 */
function analyzeModifications (modified) {
  for (const change of modified) {
    change.Details = analyzeChangeDetails(change.Details)
    for (const detail of change.Details) {
      detail.Summary = analyzeChangeDetail(detail)
      detail.Causes = analyzeChangeDetailCause(modified, detail)
    }
  }
  return modified
}

/**
 * @param {AWS.CloudFormation.ResourceChangeDetail[]} details
 * @returns {AWS.CloudFormation.ResourceChangeDetail[]}
 */
function analyzeChangeDetails (details) {
  if (details.length === 1) {
    // Fast path: only one change detail; nothing to be done
    return details
  }

  let result = details

  const detailsByTarget = lo.groupBy(details, d => `${d.Target.Attribute}.${d.Target.Name}`)

  for (const target of Object.keys(detailsByTarget)) {
    const detailsForTarget = detailsByTarget[target]
    if (detailsForTarget.length < 2) {
      // Fast path: all the analysis require at least two change details
      // for a single target
      continue
    }

    // Fixup #1: Parameter change causes two change details to be emitted:
    // one static ParameterReference and second dynamic DirectModification.
    // Let's combine these two to make things simpler
    const dynamicDirects = detailsForTarget.filter(d => d.ChangeSource === 'DirectModification' && d.Evaluation === 'Dynamic')
    const staticParameters = detailsForTarget.filter(d => d.ChangeSource === 'ParameterReference' && d.Evaluation === 'Static')
    if (dynamicDirects.length > 0 && staticParameters.length > 0) {
      result = result.filter(d => dynamicDirects.indexOf(d) === -1)
    }
  }

  return result
}

/**
 * Summarizes the given change detail.
 *
 * @param {AWS.CloudFormation.ResourceChangeDetail} detail - a single change detail
 * @return {String} a human readable summary of the change detail
 */
function analyzeChangeDetail (detail) {
  switch (detail.Target.Attribute) {
    case 'Properties':
      if (detail.Evaluation === 'Static') {
        return `resource property ${detail.Target.Name} will change`
      } else if (detail.Evaluation === 'Dynamic') {
        return `resource property ${detail.Target.Name} might change`
      }
      break

    case 'Metadata':
    case 'CreationPolicy':
    case 'UpdatePolicy':
    case 'DeletionPolicy':
    case 'Tags':
      return `resource ${formatTargetAttribute(detail.Target.Attribute)} changed`

    default:
      throw new Error(`Unknown change detail target attribute ${detail.Target.Attribute}`)
  }
}

/**
 * Analyzes the cause (the chain of changes) that triggers this change.
 *
 * @param {AWS.CloudFormation.ResourceChange[]} modified - list of resource changes for modified resources
 * @param {AWS.CloudFormation.ResourceChangeDetail} detail - a single change detail
 */
function analyzeChangeDetailCause (modified, detail) {
  if (detail.Causes) {
    // Been here already
    return detail.Causes
  }

  switch (detail.ChangeSource) {
    case 'DirectModification':
      return [
        `direct modification of resource ${formatTargetAttribute(detail.Target.Attribute)}`
      ]
    case 'Automatic':
      return [
        `automatic update of ${detail.CausingEntity}`
      ]
    case 'ParameterReference':
      return [
        `changed parameter value of ${detail.CausingEntity}`
      ]
    case 'ResourceReference':
    case 'ResourceAttribute':
      const parentChangeDetail = findChangeDetail(modified, detail.CausingEntity.split('.')[0])
      const parentChangeCauses = analyzeChangeDetailCause(modified, parentChangeDetail)
      return [
        `changed output value of ${detail.CausingEntity}`
      ].concat(parentChangeCauses)
    default:
      if (detail.ChangeSource === undefined && detail.Target.Attribute === 'Tags') {
        // Special case: tag changes made at stack level has
        // ChangeSource === null and Attribute === 'Tags'
        return [
          'changed stack tags'
        ]
      }

      throw new Error(`Unknown ChangeSource ${detail.ChangeSource}`)
  }
}

function findChangeDetail (modified, logicalId) {
  for (const change of modified) {
    if (change.LogicalResourceId === logicalId) {
      // TODO: Handle multiple changes to the same resource
      return change.Details[0]
    }
  }

  throw new Error(`Couldn't find changes to ${logicalId}`)
}

function formatTargetAttribute (attribute) {
  return attribute.replace('Policy', ' Policy').toLowerCase()
}

module.exports = {
  analyzeResourceChanges, analyzeTagChanges, analyzeParameterChanges, generateKeyValueChanges
}
