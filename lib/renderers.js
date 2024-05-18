'use strict'
import chalk from 'chalk'

/**
 * Renders a label that indicates if the given resource will be
 * replaced.
 *
 * @param {import('@aws-sdk/client-cloudformation').ResourceChange} change
 * @return {String}
 */
function renderReplacement (change) {
  switch (change.Replacement) {
    case 'True':
      return ` ${chalk.yellow('[Replacement: True]')}`
    case 'Conditional':
      return ` ${chalk.yellow('[Replacement: Conditional]')}`
    case 'False':
    case undefined: // not a modify
      return ''
    default:
      throw new Error(`Unknown value for replacement ${change.Replacement}`)
  }
}

/**
 * Renders a label that indicates the action made to the given resource.
 *
 * @param {import('@aws-sdk/client-cloudformation').ResourceChange} change
 * @return {String}
 */
function renderAction (change) {
  switch (change.Action) {
    case 'Add':
      return chalk.green('[+]')
    case 'Remove':
      return chalk.red('[-]')
    case 'Modify':
      return chalk.yellow('[*]')
    default:
      throw new Error(`Unknown action ${change.Action}`)
  }
}

/**
 * Renders a summary of the resource the given change touches.
 *
 * @param {import('@aws-sdk/client-cloudformation').ResourceChange} change
 * @return {String}
 */
function renderResourceSummary (change) {
  if (change.PhysicalResourceId) {
    return `${change.LogicalResourceId} - ${change.PhysicalResourceId} (${change.ResourceType})`
  } else {
    return `${change.LogicalResourceId} (${change.ResourceType})`
  }
}

/**
 * Renders a label that indicates if the given change requires the resource
 * to be recreated.
 *
 * @param {import('@aws-sdk/client-cloudformation').ResourceChangeDetail} detail
 * @return {String}
 */
function renderRecreation (detail) {
  switch (detail.Target.RequiresRecreation) {
    case 'Always':
      return ` ${chalk.yellow('[Recreation: Always]')}`
    case 'Conditionally':
      return ` ${chalk.yellow('[Recreation: Conditional]')}`
    case 'Never':
      return ''
    default:
      throw new Error(`Unknown value for RequiresRecreation ${detail.Target.RequiresRecreation}`)
  }
}

/**
 * Render a KeyValueChange object.
 *
 * @param {Object} change
 * @param {String} change.Key - changed key
 * @param {String} change.Value - new value of the key
 * @param {String} [change.OldValue] - old value of the key
 */
function renderKeyValueChange (change) {
  if (change.OldValue) {
    return `${change.Key}: ${change.OldValue} --> ${change.Value}`
  } else {
    return `${change.Key}: ${change.Value}`
  }
}

export default {
  renderAction, renderResourceSummary, renderReplacement, renderRecreation, renderKeyValueChange
}
