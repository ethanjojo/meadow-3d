import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom has no native modal-dialog implementation; browser QA covers focus trapping.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
}

// Geometry scrolling is exercised in real-browser QA, not jsdom.
if (typeof HTMLElement !== 'undefined') HTMLElement.prototype.scrollIntoView = function () {}
