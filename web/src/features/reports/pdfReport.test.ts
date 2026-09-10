import { describe, expect, it } from 'vitest'
import { buildPdfReport, formatPdfText } from './pdfReport'

describe('buildPdfReport', () => {
  it('includes the group title and transaction rows', () => {
    const report = buildPdfReport('Weekend trip', [
      { description: 'Dinner', counterparty: 'Paid by Alice', amount: '30.00 EUR' },
      { description: 'Taxi', counterparty: 'Bob paid Alice', amount: '10.00 EUR' },
    ])

    expect(report.content).toContain('Weekend trip')
    expect(report.content).toContain('Dinner')
    expect(report.content).toContain('30.00 EUR')
  })

  it('reorders Hebrew text for PDF rendering without changing English text', () => {
    expect(formatPdfText('Dinner')).toBe('Dinner')
    expect(formatPdfText('שלום עולם')).not.toBe('שלום עולם')
  })
})
