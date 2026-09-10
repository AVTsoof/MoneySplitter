import bidiFactory from 'bidi-js'

export type ReportRow = {
  description: string
  counterparty: string
  amount: string
}

export type PdfReport = {
  content: string[]
}

const bidi = bidiFactory()
const containsHebrew = (text: string) => /[\u0590-\u05ff]/.test(text)

export function formatPdfText(text: string): string {
  if (!containsHebrew(text)) return text
  return bidi.getReorderedString(text, bidi.getEmbeddingLevels(text, 'rtl'))
}

export function buildPdfReport(groupName: string, rows: ReportRow[]): PdfReport {
  return {
    content: [
      'MoneySplitter',
      formatPdfText(groupName),
      'Bills',
      ...rows.flatMap((row) => [row.description, row.counterparty, row.amount].map(formatPdfText)),
    ],
  }
}

export async function downloadPdfReport(groupName: string, rows: ReportRow[]): Promise<void> {
  const [pdfmakeModule, pdfFontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
  const pdfmake = pdfmakeModule.default
  pdfmake.addVirtualFileSystem(pdfFontsModule.default)
  pdfmake.createPdf(buildPdfReport(groupName, rows)).download(`${groupName}.pdf`)
}
